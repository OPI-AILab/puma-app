import io
import os
import json
import logging
from itertools import permutations

import numpy as np
import panflute as pf
from pypandoc import convert_text
from rust_fst import Map
from scipy.optimize import linear_sum_assignment
import regex as re
import html

from .parallel import parallel_process
from .utils import wer
from abc import ABC
from dataclasses import dataclass, field, asdict
from typing import Dict, Any, List, Optional, Type, Union, Tuple
from joblib import load
from server.evaluation import EvalSample
from server import Condition, default_lang
from server.evaluation.utils import TEDS


@dataclass
class ValidationResult:
    hard_score: float
    soft_score: float
    meta: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self, condition: Condition) -> Dict[str, Any]:
        result: Dict = {"type": condition.type.value, "hard_score": self.hard_score, "soft_score": self.soft_score}
        if self.meta is not None and len(self.meta) > 0:
            result["meta"] = self.meta
        return result

@dataclass
class TableScore:
    table_index: int
    score: float

@dataclass
class OCRDebugMeta:
    text_score: float
    table_scores: List[TableScore] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {"text_score": self.text_score, "table_scores": [asdict(val) for val in self.table_scores]}

@dataclass
class SingleScoreResult:
    avg_score: float
    text_score: float
    table_scores: list[TableScore]


class Lemmatizer:

    def __init__(self, data_path: str):
        self.lemmatizer = Map(path=f"{data_path}.fst")
        self.lemmas = load(f"{data_path}_lemmas.bin")

    def lemma(self, word: str):
        word = word.lower()
        if word in self.lemmatizer:
            return self.lemmas[self.lemmatizer[word]]
        else:
            return word

    def process(self, text: str) -> str:
        words = re.split(r"[\W_]+", text, flags=re.MULTILINE)
        words = [self.lemma(word) for word in words if word]
        res = " ".join(words)
        res = (res.replace("kujawsko pomorskie", "kujawsko-pomorskie")
               .replace("warmińsko mazurskie", "warmińsko-mazurskie"))
        return res

    def is_word(self, word: str):
        return word.lower() in self.lemmatizer


class MultiLemmatizer:

    def __init__(self):
        self.lemmatizers: Dict[str, Lemmatizer] = {}

    def _get_lemmatizer(self, lang: str):
        if lang not in self.lemmatizers:
            current_dir = os.path.dirname(os.path.abspath(__file__))
            data_path = os.path.join(current_dir, f"resources/{lang}_lemmatizer_lower")
            logging.info(f"Loading lemmatizer {data_path}")
            self.lemmatizers[lang] = Lemmatizer(data_path)
        return self.lemmatizers[lang]

    def process(self, text: str, lang: str):
        lemmatizer = self._get_lemmatizer(lang)
        return lemmatizer.process(text)


class Validator(ABC):

    def score(self, sample: EvalSample, condition: Condition) -> ValidationResult:
        raise NotImplementedError()


class LemmatizingValidator(Validator):

    def __init__(self, lemmatizer: MultiLemmatizer):
        self.lemmatizer = lemmatizer

    def _find_indexes(self, sample: EvalSample, condition: Condition) -> List[int]:
        lang = default_lang()
        lem = condition.params.get("lemmatize", True)
        answer = self.lemmatizer.process(sample.answer, lang) if lem else sample.answer.lower()
        results = []
        conditions = condition.expected
        matches = {}
        for entry in conditions:
            if isinstance(entry, str):
                phrase = self.lemmatizer.process(entry, lang) if lem else entry.lower()
                pos = (matches[phrase.lower()] + 1) if phrase.lower() in matches else 0
                idx = self._find_index(answer, phrase, lem, pos)
                if idx >= 0:
                    matches[phrase.lower()] = idx
                results.append(idx)
            elif isinstance(entry, list):
                options = [self.lemmatizer.process(val, lang) if lem else val.lower() for val in entry]
                idx = -1
                for option in options:
                    pos = (matches[option.lower()] + 1) if option.lower() in matches else 0
                    found_idx = self._find_index(answer, option, lem, pos)
                    if idx == -1 and found_idx >= 0:
                        idx = found_idx
                        matches[option.lower()] = idx
                        break
                results.append(idx)
        return results

    def _find_index(self, text: str, search_str: str, whole_words: bool, pos: int = 0) -> int:
        if whole_words:
            match = re.search(
                fr"(\s|^)({re.escape(search_str)})(\s|$)", text, flags=re.IGNORECASE | re.MULTILINE, pos=pos
            )
            return match.start(2) if match else -1
        else:
            return text.find(search_str, pos)


class IncludeValidator(LemmatizingValidator):

    def __init__(self, lemmatizer: MultiLemmatizer):
        super().__init__(lemmatizer)

    def score(self, sample: EvalSample, condition: Condition) -> ValidationResult:
        condition_names = [repr(val) for val in condition.expected] if condition.expected else []
        found_idx = self._find_indexes(sample, condition)
        not_found_errors = []
        for pos, idx in enumerate(found_idx):
            if idx < 0:
                not_found_errors.append("not found: " + condition_names[pos])
        num_found = len([idx for idx in found_idx if idx >= 0])
        include_min: Optional[int] = condition.params.get("include_min", None)
        if include_min == 0: include_min = None
        include_max: Optional[int] = condition.params.get("include_max", None)
        if include_max == 0: include_max = None
        if include_min is not None or include_max is not None:
            matches_min = (num_found >= include_min) if include_min else True
            matches_max = (num_found <= include_max) if include_max else True
            errors = []
            if not matches_min:
                errors.extend(not_found_errors)
            if not matches_max:
                errors.extend(f"found phrases ({num_found}) > include_max ({include_max})")
            score = 1.0 if (matches_min and matches_max) else 0.0
            return ValidationResult(score, score, {"errors": errors})
        else:
            hard_score = 1.0 if len(found_idx) == num_found else 0.0
            soft_score = (num_found / len(found_idx)) if len(found_idx) > 0 else 0.0
            return ValidationResult(hard_score, soft_score, {"errors": not_found_errors})


class ExcludeValidator(LemmatizingValidator):

    def __init__(self, lemmatizer: MultiLemmatizer):
        super().__init__(lemmatizer)

    def score(self, sample: EvalSample, condition: Condition) -> ValidationResult:
        condition_names = [repr(val) for val in condition.expected] if condition.expected else []
        found_idx = self._find_indexes(sample, condition)
        errors = []
        for pos, idx in enumerate(found_idx):
            if idx >= 0:
                errors.append("found: " + condition_names[pos])
        num_found = len([idx for idx in found_idx if idx >= 0])
        hard_score = 1.0 if num_found == 0 else 0.0
        soft_score = (1.0 - (num_found / len(found_idx))) if len(found_idx) > 0 else 0.0
        return ValidationResult(hard_score, soft_score, {"errors": errors})


class OrderValidator(LemmatizingValidator):

    def __init__(self, lemmatizer: MultiLemmatizer):
        super().__init__(lemmatizer)

    def score(self, sample: EvalSample, condition: Condition) -> ValidationResult:
        condition_names = [repr(val) for val in condition.expected] if condition.expected else []
        errors = []
        found_idx = self._find_indexes(sample, condition)
        for pos, idx in enumerate(found_idx):
            if idx < 0:
                errors.append("not found: " + condition_names[pos])
        num_found = len([idx for idx in found_idx if idx >= 0])
        is_sorted_pairs = [found_idx[i] <= found_idx[i + 1] for i in range(len(found_idx) - 1)]
        sorted_pairs, all_pairs = 0, 0
        for i in range(len(found_idx) - 1):
            error_logged = False
            for j in range(i + 1, len(found_idx)):
                all_pairs += 1
                idx1 = found_idx[i]
                idx2 = found_idx[j]
                if idx1 < 0 or idx2 < 0:
                    continue
                is_sorted_pair = idx1 <= idx2
                if is_sorted_pair:
                    sorted_pairs += 1
                else:
                    if not error_logged:
                        errors.append(f"wrong order: {condition_names[i]} is after {condition_names[j]}")
                        error_logged = True
        is_sorted = all(is_sorted_pairs)
        hard_score = 1.0 if len(found_idx) == num_found and is_sorted else 0.0
        soft_score = (sorted_pairs / all_pairs) if all_pairs > 0 else hard_score
        return ValidationResult(hard_score, soft_score, {"errors": errors})


class RegexValidator(LemmatizingValidator):

    def __init__(self, lemmatizer: MultiLemmatizer):
        super().__init__(lemmatizer)

    def score(self, sample: EvalSample, condition: Condition) -> ValidationResult:
        errors = []
        regex_min: int = condition.params.get("regex_min", 1)
        if regex_min == 0: regex_min = 1
        regex_max: Optional[int] = condition.params.get("regex_max", None)
        if regex_max == 0: regex_max = None
        matches = re.findall(condition.expected, sample.answer)
        is_min = len(matches) >= regex_min
        is_max = len(matches) <= regex_max if regex_max else True
        if not is_max:
            errors.append(f"matches ({len(matches)}) > regex_max ({regex_max})")
            return ValidationResult(0.0, 0.0, {"errors": errors})
        if not is_min:
            errors.append(f"matches ({len(matches)}) < regex_min ({regex_min})")
            return ValidationResult(0.0, 0.0, {"errors": errors})
        regex_match_length = condition.params.get("regex_match_length", None)
        if regex_match_length == 0: regex_match_length = None
        if regex_match_length and not all([len(val) == regex_match_length for val in matches]):
            errors.append(f"matches do not meet the required length ({regex_match_length})")
            return ValidationResult(0.0, 0.0, {"errors": errors})
        regex_match_word = condition.params.get("regex_match_word", None)
        if regex_match_word and not all([self.lemmatizer.is_word(val) for val in matches]):
            errors.append("matches are not proper words")
            return ValidationResult(0.0, 0.0, {"errors": errors})
        return ValidationResult(1.0, 1.0)


class WAccValidator(Validator):

    def score(self, sample: EvalSample, condition: Condition) -> ValidationResult:
        from jiwer import wer
        source_words = " ".join(re.split(r"[\W_]+", sample.answer, flags=re.MULTILINE)).lower()
        target_words = " ".join(re.split(r"[\W_]+", condition.expected, flags=re.MULTILINE)).lower()
        wer_value = wer(target_words, source_words)
        soft_score = max(0.0, 1 - wer_value)
        hard_score = 1.0 if soft_score >= 0.9 else 0.0
        return ValidationResult(hard_score, soft_score)


class StructuredOutputValidator(Validator):

    def score(self, sample: EvalSample, condition: Condition) -> ValidationResult:
        expected_json = json.loads(condition.expected.strip())
        errors = []
        try:
            answer = sample.answer.strip(" \n\t`")
            answer = answer.removeprefix("json").strip()
            answer_json = json.loads(answer)
        except json.decoder.JSONDecodeError:
            return ValidationResult(0.0, 0.0)
        expected_json = self._normalize_json(expected_json)
        answer_json = self._normalize_json(answer_json)
        is_array = isinstance(expected_json, list)
        if is_array and isinstance(answer_json, dict):
            answer_json = [answer_json]
        if not is_array:
            res = self._compare_objects(answer_json, expected_json, "", errors)
        else:
            res = self._compare_arrays(answer_json, expected_json, errors)
        return ValidationResult(1.0 if res >= 1.0 else 0.0, res, {"errors": errors})

    def _normalize_json(self, value: Any):
        if isinstance(value, dict):
            return {k: self._normalize_json(v) for k, v in value.items()}
        elif isinstance(value, list):
            return [self._normalize_json(v) for v in value]
        elif isinstance(value, str):
            return self._normalize_text(value)
        else:
            return value

    def _normalize_text(self, text: str) -> str:
        if not isinstance(text, str):
            return text
        text = text.lower()
        text = re.sub(r"[^a-z0-9]", " ", text)
        text = re.sub(r"\s+", " ", text).strip()
        return text

    def _compare_arrays(self, source: List[Dict], target: List[Dict], errors: List):
        n = len(source)
        m = len(target)
        cost_matrix = np.zeros((n, m))
        for i, a in enumerate(source):
            for j, b in enumerate(target):
                similarity = self._compare_objects(a, b, "")
                cost_matrix[i, j] = -similarity
        row_ind, col_ind = linear_sum_assignment(cost_matrix)
        matches = []
        total_similarity = 0.0
        for i, j in zip(row_ind, col_ind):
            sim = -cost_matrix[i, j]
            _ = self._compare_objects(source[i], target[j], f"[{i}]", errors)
            matches.append((source[i], target[j], sim))
            total_similarity += sim
        return total_similarity / max(n, m)

    def _compare_objects(self, source: Dict, target: Dict, prefix: str, errors: List = None):
        source, target = self._flatten_dict(source), self._flatten_dict(target)
        all_keys = set(source.keys()) | set(target.keys())
        matches = 0.0
        for key in all_keys:
            source_val = source.get(key, None)
            target_val = target.get(key, None)
            sim = self._compare_values(source_val, target_val)
            if sim < 1.0 and errors is not None:
                errors.append(prefix + key)
            matches += sim
        return matches / len(all_keys)

    def _compare_values(self, val1: Any, val2: Any):
        if val1 is None and val2 is None:
            return 1.0
        elif val1 is None or val2 is None:
            return 0.0
        elif val1 == val2:
            return 1.0
        elif isinstance(val1, list) and isinstance(val2, list):
            return len(val1) == len(val2) and set(val1) == set(val2)
        else:
            return 0.0

    def _flatten_dict(self, value: Dict, parent_key="", sep="."):
        is_flat = all(not isinstance(val, Dict) for val in value.values())
        if is_flat:
            return value
        res = {}
        for k, v in value.items():
            new_key = f"{parent_key}{sep}{k}" if parent_key else k
            if isinstance(v, dict):
                res.update(self._flatten_dict(v, new_key, sep=sep))
            else:
                res[new_key] = v
        return res


class OCRValidator(Validator):

    def __init__(self):
        self.teds_metric = TEDS(ignore_nodes=['strong', 'em', 'b', 'mark', 'u', 'small'])

    def _normalize_expected(self, expected) -> List[str]:
        if isinstance(expected, str):
            return [expected]
        if isinstance(expected, list):
            return [str(block) for block in expected]
        return [str(expected)]

    def _score_single(self, pred_doc, expected_str: str) -> SingleScoreResult:
        expected_doc = self.to_doc(expected_str)

        text_score = wer(pred_doc.texts, expected_doc.texts)
        teds_score, teds_scores = self._teds(pred_doc.tables, expected_doc.tables)

        text_weight = sum(len(t) for t in expected_doc.texts)
        tables_weight = sum(len(t.text) for t in expected_doc.tables)

        if text_weight == 0 and tables_weight == 0:
            return SingleScoreResult(0.0, 0.0, [])

        table_scores = [
            TableScore(table_index=i, score=s)
            for i, s in enumerate(teds_scores)
        ]

        avg_score = float(np.average([text_score, teds_score], weights=[text_weight, tables_weight]))
        return SingleScoreResult(avg_score, text_score, table_scores)

    def score(self, sample: EvalSample, condition: Condition) -> ValidationResult:
        blocks = self._normalize_expected(condition.expected)

        if not blocks:
            meta = OCRDebugMeta(text_score=0.0, table_scores=[])
            return ValidationResult(0.0, 0.0, meta={"ocr_debug": meta})

        pred_doc = self.to_doc(sample.answer)
        best = SingleScoreResult(0.0, 0.0, [])
        for perm in permutations(blocks):
            combined = "\n\n".join(perm)
            result = self._score_single(pred_doc, combined)
            if result.avg_score > best.avg_score:
                best = result

        meta = OCRDebugMeta(
            text_score=best.text_score,
            table_scores=best.table_scores
        )

        return ValidationResult(
            1.0 if best.avg_score >= 0.9 else 0.0,
            best.avg_score,
            meta={"ocr_debug": meta.to_dict()}
        )

    def _html_blocks(self, elem, doc):
        html_blocks = []
        self._identify_elements(elem, pf.RawBlock, html_blocks, format='html',
                                extra_conds=[lambda a: a.text.lower().start_with('<table')
                                                       and a.text.lower().ends_with('</table>')])
        for html_block in html_blocks:
            html_block = self.convert_html_to_table(html_block)
            doc.tables.append(self.convert_table_to_simplified_html(html_block))

    def _texts(self, elem, doc):
        self._identify_elements(elem, [pf.Str], doc.texts, map_func=lambda t: t.text.lower())

    def _identify_elements(self, elem: pf.Element, elem_types: Union[Type, List[Type]], out: List[pf.Element],
                           format: str = None, map_func=None, **kwargs):
        elem_types = elem_types if isinstance(elem_types, list) else [elem_types]
        conditions = [any([isinstance(elem, elem_class) for elem_class in elem_types])]
        if format and hasattr(elem, 'format'):
            conditions.append(elem.format.lower() == format)
        conditions.extend(kwargs.get('extra_conds', []))
        if all(conditions):
            out.append(map_func(elem) if map_func else elem)

    def remove_breaks(self, elem, doc=None):
        if isinstance(elem, pf.LineBreak):
            return pf.Space()
        return None

    def remove_not_table_tags(self, elem, doc=None):
        allowed_types = (
            pf.Table, pf.TableCell, pf.Space, pf.TableRow,
            pf.TableBody, pf.TableHead, pf.TableFoot,
            pf.Plain, pf.Str, pf.Caption, pf.ListContainer
        )

        if not isinstance(elem, allowed_types) and hasattr(elem, 'content'):
            return self.remove_not_table_tags(elem.content)

        if isinstance(elem, pf.ListContainer):
            for child in elem:
                return self.remove_not_table_tags(child)

        return elem

    def convert_table_to_simplified_html(self, elem, doc=None):
        if not isinstance(elem, pf.Table):
            return None
        html_output = self.table_to_minimal_html(elem)
        return pf.RawBlock(html_output, format='html')

    def table_to_minimal_html(self, table: pf.Table):
        rows_html = []
        if table.head:
            for row in table.head.content:
                if isinstance(row, pf.TableRow):
                    cells = [
                        f"<td>{self.extract_cell_text(cell)}</td>"
                        for cell in row.content
                    ]
                    rows_html.append(f"<tr>{''.join(cells)}</tr>")

        for body in table.content:
            for row in body.content:
                if isinstance(row, pf.TableRow):
                    cells = [
                        f"<td>{self.extract_cell_text(cell)}</td>"
                        for cell in row.content
                    ]
                    rows_html.append(f"<tr>{''.join(cells)}</tr>")
        return f"<table>{''.join(rows_html)}</table>"

    def extract_cell_text(self, cell: pf.TableCell):
        parts = []
        for block in cell.content:
            if hasattr(block, "content"):
                text = self.extract_text(block).strip()
                if text:
                    parts.append(text)
        return html.escape(" ".join(parts).strip())

    def extract_text(self, elem):
        if isinstance(elem, pf.Str):
            return elem.text

        elif isinstance(elem, pf.Space):
            return " "

        elif hasattr(elem, "content"):
            return "".join(self.extract_text(child) for child in elem.content)

        return ""

    def strip_non_structural_attributes(self, elem: pf.Table, doc=None):
        if hasattr(elem, 'attributes'):
            elem.attributes = {}
        if hasattr(elem, 'colspec'):
            elem.colspec = [('AlignDefault', 'ColWidthDefault') for _ in elem.colspec]

        if isinstance(elem, pf.Table):
            self.strip_non_structural_attributes(elem.head)
            for body in elem.content:
                self.strip_non_structural_attributes(body)
            self.strip_non_structural_attributes(elem.foot)

        if isinstance(elem, (pf.Table, pf.TableRow, pf.TableBody, pf.TableCell, pf.TableHead, pf.TableFoot, pf.Plain)):
            elem.content = elem.content.walk(self.strip_non_structural_attributes)
        return elem

    def convert_html_to_table(self, raw_block: pf.RawBlock) -> Union[pf.Table, None]:
        try:
            pandoc_json = convert_text(raw_block.text, to='json', format='html')
        except Exception as e:
            logging.warning(f"Pandoc Exception: {e}")
            return None
        doc = pf.load(io.StringIO(pandoc_json))
        if doc.content and isinstance(doc.content[0], pf.Table):
            return self.strip_non_structural_attributes(doc.content[0])
        else:
            return None

    def to_doc(self, md_string: str) -> pf.Doc:
        # ensure two newlines before <html> and <table>
        md_string = re.sub(r'(?<!\n\n)(<(?:html|table)\b)', r'\n\n\1', md_string)
        json_ast = convert_text(md_string, 'json', 'md',
                                extra_args=['--from', 'markdown-markdown_in_html_blocks+raw_html'])
        doc = pf.load(io.StringIO(json_ast))
        # convert md tables to html
        pf.run_filter(self.convert_table_to_simplified_html, doc=doc)
        # extract text and html blocks
        filters = [self._texts, self._html_blocks]
        doc = pf.run_filters(filters, prepare=self._prepare, finalize=self._finalize, doc=doc)
        return doc

    def _prepare(self, doc: pf.Doc):
        for attr in ['tables', 'texts']:
            setattr(doc, attr, [])

    def _finalize(self, doc: pf.Doc):
        normalized = [re.sub(r'\s+', ' ', text) for text in doc.texts]
        doc.texts = ' '.join(normalized)

    def _teds(self, pred_tables: List, expected_tables: List):
        if not expected_tables:
            return 0.0, []
        teds_scores, teds_weights = self._cross_teds(pred_tables, expected_tables)
        return np.average(teds_scores, weights=teds_weights), teds_scores

    def _cross_teds(self, pred_tables: List[pf.RawBlock], expected_tables: List[pf.RawBlock]) -> Tuple[
        List[float], List[float]]:
        teds_scores, teds_weights = [0] * len(expected_tables), [0] * len(expected_tables)
        max_table_size = max(map(lambda t: len(t.text), expected_tables))

        for i, expected_table in enumerate(expected_tables):
            if self.teds_metric.n_jobs == 1:
                for pred_table in pred_tables:
                    if pred_table and expected_table:
                        teds_score = self.teds_metric.evaluate(pred_table.text, expected_table.text)
                        teds_scores[i] = max(teds_scores[i], teds_score)
            else:
                inputs = []
                for pred_table in pred_tables:
                    inputs.append({'pred': pred_table.text, 'true': expected_table.text})
                scores = parallel_process(inputs, self.teds_metric.evaluate, use_kwargs=True,
                                          n_jobs=self.teds_metric.n_jobs, front_num=1)
                teds_scores[i] = max(scores)
            teds_weights[i] = len(expected_table.text) / max_table_size

        return teds_scores, teds_weights
