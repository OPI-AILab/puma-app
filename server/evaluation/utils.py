import re
import os
import distance
import tempfile
import io
import logging
from apted import APTED, Config
from apted.helpers import Tree
from lxml import etree, html
from collections import deque
from .parallel import parallel_process
from tqdm import tqdm


class TableTree(Tree):
    def __init__(self, tag, colspan=None, rowspan=None, content=None, *children):
        self.tag = tag
        self.colspan = colspan
        self.rowspan = rowspan
        self.content = content
        self.children = list(children)

    def bracket(self):
        """Show tree using brackets notation"""
        if self.tag == 'td':
            result = '"tag": %s, "colspan": %d, "rowspan": %d, "text": %s' % \
                     (self.tag, self.colspan, self.rowspan, self.content)
        else:
            result = '"tag": %s' % self.tag
        for child in self.children:
            result += child.bracket()
        return "{{{}}}".format(result)


class CustomConfig(Config):
    @staticmethod
    def maximum(*sequences):
        """Get maximum possible value
        """
        return max(map(len, sequences))

    def normalized_distance(self, *sequences):
        """Get distance from 0 to 1
        """
        return float(distance.levenshtein(*sequences)) / self.maximum(*sequences)

    def rename(self, node1, node2):
        """Compares attributes of trees"""
        if (node1.tag != node2.tag) or (node1.colspan != node2.colspan) or (node1.rowspan != node2.rowspan):
            return 1.
        if node1.tag == 'td':
            if node1.content or node2.content:
                return self.normalized_distance(node1.content, node2.content)
        return 0.


class TEDS(object):
    ''' Tree Edit Distance basead Similarity
    '''

    def __init__(self, structure_only=False, n_jobs=1, ignore_nodes=None):
        assert isinstance(n_jobs, int) and (n_jobs >= 1), 'n_jobs must be an integer greather than 1'
        self.structure_only = structure_only
        self.n_jobs = n_jobs
        self.ignore_nodes = ignore_nodes
        self.__tokens__ = []

    def tokenize(self, node):
        ''' Tokenizes table cells
        '''
        self.__tokens__.append('<%s>' % node.tag)
        if node.text is not None:
            self.__tokens__ += list(node.text)
        for n in node.getchildren():
            self.tokenize(n)
        if node.tag != 'unk':
            self.__tokens__.append('</%s>' % node.tag)
        if node.tag != 'td' and node.tail is not None:
            self.__tokens__ += list(node.tail)

    def load_html_tree(self, node, parent=None):
        ''' Converts HTML tree to the format required by apted
        '''
        global __tokens__
        if node.tag == 'td':
            if self.structure_only:
                cell = []
            else:
                self.__tokens__ = []
                self.tokenize(node)
                cell = self.__tokens__[1:-1].copy()
            new_node = TableTree(node.tag,
                                 int(node.attrib.get('colspan', '1')),
                                 int(node.attrib.get('rowspan', '1')),
                                 cell, *deque())
        else:
            new_node = TableTree(node.tag, None, None, None, *deque())
        if parent is not None:
            parent.children.append(new_node)
        if node.tag != 'td':
            for n in node.getchildren():
                self.load_html_tree(n, new_node)
        if parent is None:
            return new_node

    def evaluate(self, pred, true):
        ''' Computes TEDS score between the prediction and the ground truth of a
            given sample
        '''
        if (not pred) or (not true):
            return 0.0
        parser = html.HTMLParser(remove_comments=True, encoding='utf-8')
        pred = html.fromstring(pred, parser=parser)
        true = html.fromstring(true, parser=parser)
        if pred.xpath('//table') and true.xpath('//table'):
            pred = pred.xpath('//table')[0]
            true = true.xpath('//table')[0]
            if self.ignore_nodes:
                etree.strip_tags(pred, *self.ignore_nodes)
                etree.strip_tags(true, *self.ignore_nodes)
            n_nodes_pred = len(pred.xpath(".//*"))
            n_nodes_true = len(true.xpath(".//*"))
            n_nodes = max(n_nodes_pred, n_nodes_true)
            tree_pred = self.load_html_tree(pred)
            tree_true = self.load_html_tree(true)
            distance = APTED(tree_pred, tree_true, CustomConfig()).compute_edit_distance()
            return 1.0 - (float(distance) / n_nodes)
        else:
            return 0.0

    def batch_evaluate(self, pred_json, true_json):
        ''' Computes TEDS score between the prediction and the ground truth of
            a batch of samples
            @params pred_json: {'FILENAME': 'HTML CODE', ...}
            @params true_json: {'FILENAME': {'html': 'HTML CODE'}, ...}
            @output: {'FILENAME': 'TEDS SCORE', ...}
        '''
        samples = true_json.keys()
        if self.n_jobs == 1:
            scores = [self.evaluate(pred_json.get(filename, ''), true_json[filename]['html']) for filename in
                      tqdm(samples)]
        else:
            inputs = [{'pred': pred_json.get(filename, ''), 'true': true_json[filename]['html']} for filename in
                      samples]
            scores = parallel_process(inputs, self.evaluate, use_kwargs=True, n_jobs=self.n_jobs, front_num=1)
        scores = dict(zip(samples, scores))
        return scores


def wer(answer, expected) -> float:
    from jiwer import wer
    source_words = " ".join(re.split(r"[\W_]+", answer, flags=re.MULTILINE)).lower()
    target_words = " ".join(re.split(r"[\W_]+", expected, flags=re.MULTILINE)).lower()
    wer_value = wer(target_words, source_words)
    return max(0.0, 1 - wer_value)


class ImageCompressor:

    def compress(self, image_path: str, max_size_bytes: int, max_dim: int | None = None) -> str:
        from PIL import Image

        if max_dim is not None and max_dim <= 0:
            raise ValueError("max_dim must be greater than 0.")

        exceeds_max_dim = False
        if max_dim is not None:
            with Image.open(image_path) as img:
                exceeds_max_dim = max(img.size) > max_dim

        if os.path.getsize(image_path) <= max_size_bytes and not exceeds_max_dim:
            return image_path

        img = self._prepare_image(image_path)
        temp_dir = tempfile.gettempdir()
        file_name = os.path.basename(image_path)
        base_name, _ = os.path.splitext(os.path.basename(image_path))
        output_path = os.path.join(temp_dir,  f"{base_name}_compressed.jpg")
        logging.info(f"Compressing image {file_name}...")

        scale = 1.0 if max_dim is None else min(1.0, max_dim / max(img.size))
        tries = 1
        while True:
            if scale < 1.0:
                new_width = int(img.width * scale)
                new_height = int(img.height * scale)
                if new_width == 0 or new_height == 0:
                    raise ValueError("Compression limits too low, impossible to compress.")
                logging.info(f"Compressing image {file_name}: iteration {tries}")
                tries += 1
                current_img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
            else:
                current_img = img

            temp_buf = io.BytesIO()
            logging.info(f"Compressing image {file_name}: iteration {tries}")
            tries += 1
            current_img.save(temp_buf, format="JPEG", quality=10)
            if temp_buf.tell() > max_size_bytes:
                scale *= 0.8
                continue

            low, high = 10, 95
            best_buffer = None
            while low <= high:
                mid = (low + high) // 2
                temp_buf = io.BytesIO()
                logging.info(f"Compressing image {file_name}: iteration {tries}")
                tries += 1
                current_img.save(temp_buf, format="JPEG", quality=mid)
                size = temp_buf.tell()
                if size <= max_size_bytes:
                    best_buffer = temp_buf
                    low = mid + 1
                else:
                    high = mid - 1

            if best_buffer is not None:
                with open(output_path, "wb") as f:
                    f.write(best_buffer.getvalue())
                return output_path

    def _prepare_image(self, image_path: str):
        from PIL import Image
        img = Image.open(image_path)
        if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
            background = Image.new("RGB", img.size, (255, 255, 255))
            img_rgba = img.convert("RGBA")
            background.paste(img_rgba, mask=img_rgba)
            img = background
        elif img.mode != "RGB":
            img = img.convert("RGB")
        return img
