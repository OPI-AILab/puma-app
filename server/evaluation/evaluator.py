import json
import logging
import mimetypes
import os
import numpy as np
import math
from collections import defaultdict
from datetime import datetime
from typing import Dict, List, Tuple, Optional, Set
from tqdm import tqdm
from server import (
    TaskDetails,
    ChatMessageType,
    ChatMessage,
    StructuredOutput,
    EvaluateRequest,
    Condition,
    CATEGORIES, default_lang
)
from server.evaluation import AutoEvalModel, EvalModel, EvalFile, EvalSample, EvalConsumer, EvalPostProcessor
import server.evaluation.validators as v


class FileEvalConsumer(EvalConsumer):

    def __init__(self, request: EvaluateRequest, tasks: List[TaskDetails], model_id: str, project_dir: str):
        super().__init__(request, tasks)
        self.model_id = model_id
        self.project_dir = project_dir
        self.progress = tqdm(total=len([task for task in tasks if task.matches(request)]))
        os.makedirs(os.path.join(self.project_dir, "logs"), exist_ok=True)
        log_name = "{}_{}.jsonl".format(datetime.now().strftime("%Y%m%d_%H%M%S"), model_id)
        self.log_path = request.continue_from if request.continue_from else os.path.join(project_dir, "logs", log_name)
        self.log_file = None

    def log_progress(self):
        self.progress.update(1)

    def log_sample(self, sample: Dict):
        if self.log_file is None:
            self.log_file = open(self.log_path, "a", encoding="utf-8")
        self.log_file.write(json.dumps(sample, ensure_ascii=False) + "\n")
        self.log_file.flush()

    def log_scores(self, scores: Dict):
        with open("scores.jsonl", "a", encoding="utf-8") as output_file:
            output_file.write(json.dumps(scores, ensure_ascii=False))
            output_file.write("\n")

    def load_previous_scores(self) -> Tuple[Dict, Dict, Set]:
        categories = set(self.request.categories)
        return self._load_previous_scores(self.log_path, categories)

    def close(self):
        self.progress.close()
        if self.log_file is not None:
            self.log_file.close()

    def _load_previous_scores(self, log_path: str, categories: Set[str]):
        hard_scores, soft_scores = defaultdict(list), defaultdict(list)
        task_ids = set()
        with open(log_path, "r", encoding="utf-8") as log_file:
            for line in log_file:
                value = json.loads(line)
                if value["category"] in categories:
                    hard_scores[value["category"]].append(value["score"])
                    soft_scores[value["category"]].append(value["soft_score"])
                    task_ids.add(value["id"])
        return hard_scores, soft_scores, task_ids


class SamplePreProcessor:

    def __init__(self, prompts: Dict):
        self.prompts = prompts

    def process(self, task: TaskDetails, json_schema: Optional[Dict]):
        lang = default_lang()
        category_prompts = self.prompts[lang]
        if task.category in category_prompts:
            prompt = category_prompts[task.category]
            if "{json_schema}" in prompt:
                prompt = prompt.format(json_schema=json.dumps(json_schema, indent=2))
            task = task.model_copy(deep=True)
            task.content.insert(0, ChatMessage(type=ChatMessageType.TEXT, text=prompt))
        return task


class TaskEvaluator:

    def __init__(self, project_dir: str, prompts: Dict, models: List[Dict]):
        self.project_dir = project_dir
        self.processor = SamplePreProcessor(prompts)
        self.models = self._load_models(models)
        self.validators = self._init_validators()
        mimetypes.add_type("image/webp", ".webp")
        mimetypes.add_type("video/mp4", ".mp4")
        mimetypes.add_type("video/webm", ".webm")

    def _load_models(self, models_configs: List[Dict]) -> Dict[str, EvalModel]:
        models = {}
        for config in models_configs:
            config_name, model = self._create_model(config)
            models[config_name] = model
            logging.info(f"Loaded model config {config_name}")
        return models

    def update_model(self, model_config: Dict):
        config_name, model = self._create_model(model_config)
        self.models[config_name] = model
        logging.info(f"Loaded model config {config_name}")

    def update_models(self, models_configs: List[Dict]):
        self.models = self._load_models(models_configs)

    def get_model(self, model_ref: str) -> Tuple[EvalModel, str]:
        if model_ref in self.models:
            # model_ref is model_id
            return self.models[model_ref], model_ref
        else:
            # model_ref is file path
            with open(model_ref, "r", encoding="utf-8") as config_file:
                model_config = json.load(config_file)
                model = self._create_model(model_config)[1]
                model_id = os.path.splitext(os.path.basename(model_ref))[0]
            return model, model_id

    def _create_model(self, model_config: Dict) -> Tuple[str, EvalModel]:
        assert "id" in model_config, "'id' field is required in model config"
        config_name = model_config["id"]
        model = AutoEvalModel.from_config(model_config)
        return config_name, model

    def _init_validators(self) -> Dict[str, v.Validator]:
        lemmatizer = v.MultiLemmatizer()
        validators = {
            "include": v.IncludeValidator(lemmatizer),
            "exclude": v.ExcludeValidator(lemmatizer),
            "order": v.OrderValidator(lemmatizer),
            "regex": v.RegexValidator(lemmatizer),
            "wacc": v.WAccValidator(),
            "struct": v.StructuredOutputValidator(),
            "ocr": v.OCRValidator()
        }
        return validators

    def validate(self, condition: Condition, sample: EvalSample):
        validator = self.validators[condition.type.value]
        return validator.score(sample, condition)

    def evaluate_full(self, model_id: str, model: EvalModel, post_processor: EvalPostProcessor, consumer: EvalConsumer, cancellation_token=None):
        if consumer.request.continue_from is not None:
            hard_scores, soft_scores, previous_ids = consumer.load_previous_scores()
        else:
            hard_scores, soft_scores, previous_ids = defaultdict(list), defaultdict(list), set()
        tasks = [task for task in consumer.tasks if task.matches(consumer.request) and task.id not in previous_ids]
        completed_tasks = [task for task in consumer.tasks if task.matches(consumer.request) and task.id in previous_ids]
        for _ in completed_tasks:
            consumer.log_progress()
        tasks_dict = {task.id: task for task in tasks}
        samples = []
        for task in tasks:
            consumer.last_task_id = task.id
            samples.append(self._create_sample(task, model, model_id))
        for sample in model.generate(samples, cancellation_token=cancellation_token):
            if cancellation_token and cancellation_token.is_cancelled:
                break
            consumer.last_task_id = sample.id
            consumer.log_progress()
            if post_processor is not None:
                sample = post_processor.process_one(sample)
            task = tasks_dict.get(sample.id)
            if sample.answer is None:
                task_scores = [(v.ValidationResult(0.0, 0.0, {"errors": ["model returned no answer"]}), condition)
                               for condition in task.conditions]
            else:
                task_scores = [(self.validate(condition, sample), condition) for condition in task.conditions]
            sample.scores = [score.to_dict(condition) for score, condition in task_scores]
            hard_score = min([score.hard_score for score, condition in task_scores])
            soft_score = math.prod([score.soft_score for score, condition in task_scores])
            hard_scores[task.category].append(hard_score)
            soft_scores[task.category].append(soft_score)
            self._log_sample(sample, task, hard_score, soft_score, consumer)
        score_dict = self._log_scores(model_id, hard_scores, soft_scores, consumer)
        return score_dict

    def _log_sample(self, sample: EvalSample, task: TaskDetails, hard_score: float, soft_score: float,
                    consumer: EvalConsumer):
        val = {
            "score": hard_score,
            "soft_score": soft_score,
            "file": task.first_file(),
            "question": task.first_text(),
            "answer": sample.answer,
            "scores": sample.scores,
            "id": sample.id,
            "category": task.category
        }
        consumer.log_sample(val)

    def _log_scores(self, model_id: str, hard_scores: Dict, soft_scores: Dict, consumer: EvalConsumer):
        all_hard, all_soft = [], []
        score_dict = {}
        print("=" * 42)
        categories = [cat.name for cat in CATEGORIES if cat.name in hard_scores]
        for key in categories:
            hard_score = np.mean(hard_scores[key]) * 100.0
            soft_score = np.mean(soft_scores[key]) * 100.0
            print(f"{key.ljust(22)} {hard_score:.2f}% {soft_score:.2f}% ({len(hard_scores[key])})")
            score_dict[key] = f"{hard_score:.2f}"
            score_dict[key + "_soft"] = f"{soft_score:.2f}"
            all_hard.extend(hard_scores[key])
            all_soft.extend(soft_scores[key])
        print("=" * 42)
        hard_score = np.mean(all_hard) * 100.0
        soft_score = np.mean(all_soft) * 100.0
        score_dict["total"] = f"{hard_score:.2f}"
        score_dict["total_soft"] = f"{soft_score:.2f}"
        print(f"{'total'.ljust(22)} {hard_score:.2f}% {soft_score:.2f}% ({len(all_hard)})")
        print("=" * 42)
        log_dict = {"model": model_id, "timestamp": datetime.now().strftime("%d/%m/%Y,%H:%M:%S"), **score_dict}
        consumer.log_scores(log_dict)
        return score_dict

    def evaluate(self, model_id: str, task: TaskDetails):
        assert model_id in self.models, f"model not found {model_id}"
        model = self.models[model_id]
        sample = self._create_sample(task, model, model_id)
        samples = [val for val in model.generate([sample])]
        scores = []
        for condition in task.conditions:
            validator = self.validators[condition.type.value]
            score = validator.score(sample, condition)
            scores.append(score.to_dict(condition))
        sample.scores = scores
        return samples[0]

    def _create_sample(self, task: TaskDetails, model: EvalModel, model_id: str) -> EvalSample:
        model_config = model.properties(task.category)
        wrap_json_array = "wrap_json_array" in model_config and model_config["wrap_json_array"]
        basic_schema = "basic_schema" in model_config and model_config["basic_schema"]
        json_schema = self._create_json_schema(task.structured_output, wrap_json_array, basic_schema)
        task = self.processor.process(task, json_schema)
        parts = []
        for message in task.content:
            if message.type == ChatMessageType.TEXT:
                parts.append({"type": "text", "text": message.text})
            elif message.type == ChatMessageType.FILE:
                parts.append({"type": "file", "file": self._create_file(message.file)})
        messages = [{"role": "user", "content": parts}]
        return EvalSample(
            id=task.id,
            model_id=model_id,
            messages=messages,
            category=task.category,
            json_schema=json_schema,
            is_json_array=task.structured_output.array if task.structured_output is not None else False
        )

    def _create_file(self, file_name: str) -> EvalFile:
        file_path = os.path.join(self.project_dir, "files", file_name)
        ext = os.path.splitext(file_path)[-1].lower().strip(".")
        assert os.path.exists(file_path), f"file path not found: {file_path}"
        mime_type, encoding = mimetypes.guess_type(file_path)
        assert mime_type is not None, f"mime type is none for file: {file_path}"
        return EvalFile(file_path, mime_type, ext)

    def _create_json_schema(self, structured_output: StructuredOutput | None,
                            wrap_json_array: bool, basic_schema: bool) -> Optional[Dict]:
        if structured_output is None:
            return None
        properties = {}
        required = []
        property_order = []
        for field in structured_output.fields:
            field_type = field.type
            desc = field.description
            required.append(field.name)
            property_order.append(field.name)
            if field_type.startswith("array"):
                inner_type = field_type.removeprefix("array").strip("[]")
                properties[field.name] = {"type": "array", "description": desc, "items": {"type": inner_type}}
            else:
                properties[field.name] = {"type": field_type, "description": desc}

        schema: Dict = {
            "strict": True
        }
        if basic_schema:
            del schema["strict"]
        if structured_output.array:
            array_schema: Dict = {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": properties,
                    "propertyOrder": property_order,
                    "required": required,
                    "additionalProperties": False
                }
            }
            if basic_schema:
                del array_schema["items"]["propertyOrder"]
            if wrap_json_array:
                schema["type"] = "object"
                schema["properties"] =  {"items": array_schema}
                if not basic_schema:
                    schema["propertyOrder"] = ["items"]
                schema["required"] = ["items"]
                schema["additionalProperties"] = False
            else:
                schema.update(array_schema)
        else:
            schema["type"] = "object"
            schema["properties"] = properties
            if not basic_schema:
                schema["propertyOrder"] = property_order
            schema["required"] = required
            schema["additionalProperties"] = False

        res: Dict = {
            "name": structured_output.name,
            "strict": True,
            "schema": schema
        }
        if basic_schema:
            del res["strict"]
        return res
