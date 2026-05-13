import base64
import json
import os
import mimetypes
from abc import ABC, abstractmethod
from dataclasses import dataclass
from enum import Enum
from typing import List, Dict, Optional, Iterable, Union, Tuple, Set
from pydantic import BaseModel
from server import EvaluateRequest, TaskDetails, expand_env_vars


class EvalSample(BaseModel):
    id: str
    model_id: Optional[str] = None
    messages: List[Dict]
    answer: str = None
    last_exception: Optional[str] = None
    scores: List[Dict] = None
    json_schema: Optional[Dict] = None
    is_json_array: bool = False
    category: str = None


class EvalFileType(str, Enum):
    AUDIO = "audio"
    IMAGE = "image"
    VIDEO = "video"


class ApiType(str, Enum):
    OPENROUTER = "openrouter"
    GEMINI = "gemini"
    VLLM = "vllm"
    INLINE = "inline"


@dataclass
class EvalFile:
    path: str
    mime_type: str
    extension: str

    def base64(self):
        with open(self.path, "rb") as input_file:
            return base64.b64encode(input_file.read()).decode("utf-8")

    @property
    def file_type(self) -> Optional[EvalFileType]:
        if self.extension in ("wav", "mp3", "aiff", "aac", "ogg", "flac"):
            return EvalFileType.AUDIO
        elif self.extension in ("png", "jpg", "jpeg", "webp", "heic", "heif"):
            return EvalFileType.IMAGE
        elif self.extension in ("mp4", "webm"):
            return EvalFileType.VIDEO
        return None

    def compress_image(self, max_size_bytes: int) -> "EvalFile":
        if os.path.getsize(self.path) <= max_size_bytes:
            return self
        from server.evaluation.utils import ImageCompressor
        compressor = ImageCompressor()
        output_path = compressor.compress(self.path, max_size_bytes)
        mime_type, encoding = mimetypes.guess_type(output_path)
        ext = os.path.splitext(output_path)[-1].lower().strip(".")
        assert mime_type is not None, f"mime type is none for file: {output_path}"
        return EvalFile(output_path, mime_type, ext)


class EvalModel(ABC):

    @abstractmethod
    def generate(self, batch: List[EvalSample], cancellation_token=None) -> Iterable[EvalSample]:
        raise NotImplementedError()

    @abstractmethod
    def generate_one(self, sample: EvalSample) -> EvalSample:
        raise NotImplementedError()

    @abstractmethod
    def properties(self, category: str) -> Dict:
        raise NotImplementedError()


class EvalPostProcessor(ABC):

    @abstractmethod
    def process(self, batch: List[EvalSample]) -> Iterable[EvalSample]:
        raise NotImplementedError()

    def process_one(self, sample: EvalSample) -> EvalSample:
        results = self.process([sample])
        return next(iter(results))


class EvalConsumer(ABC):

    def __init__(self, request: EvaluateRequest, tasks: List[TaskDetails]):
        self.request = request
        self.tasks = tasks
        self.last_task_id: Optional[str] = None

    @abstractmethod
    def load_previous_scores(self) -> Tuple[Dict, Dict, Set]:
        raise NotImplementedError()

    @abstractmethod
    def log_progress(self):
        raise NotImplementedError()

    @abstractmethod
    def log_sample(self, sample: Dict):
        raise NotImplementedError()

    @abstractmethod
    def log_scores(self, scores: Dict):
        raise NotImplementedError()

    @abstractmethod
    def close(self):
        raise NotImplementedError()


class AutoEvalModel:

    @staticmethod
    def from_config(config_path: Union[str, Dict]) -> EvalModel:
        assert isinstance(config_path, str) or isinstance(config_path, dict)
        config = config_path
        if isinstance(config_path, str):
            with open(config_path, "r", encoding="utf-8") as input_file:
                config = json.load(input_file)
        expand_env_vars(config, ["api_key"])
        model_type = config.get("type", "remote")
        if model_type == "remote":
            from server.evaluation.models.remote import RemoteLLMModel
            return RemoteLLMModel(config)
        elif model_type == "transcribe":
            from server.evaluation.models.transcribe import TranscribeModel
            return TranscribeModel(config)
        elif model_type == "file":
            from server.evaluation.models.file import FileModel
            return FileModel(config["path"])
        elif model_type == "router":
            model_configs: Dict[str, Dict] = config.get("models")
            routes: Dict[str, str] = config.get("routes")
            assert "default" in routes, "missing default route in model config"
            models: Dict[str, EvalModel] = {}
            for ref, model_config in model_configs.items():
                models[ref] = AutoEvalModel.from_config(model_config)
            threads = config.get("threads", 1)
            routed_models = {cat: models.get(ref) for cat, ref in routes.items()}
            from server.evaluation.models.router import RouterModel
            return RouterModel(routed_models, threads)
        else:
            raise AssertionError(f"unknown model type: {model_type}")


class AutoPostProcessor:

    @staticmethod
    def from_config(config_path: Union[str, Dict]) -> Optional[EvalPostProcessor]:
        assert isinstance(config_path, str) or isinstance(config_path, dict)
        if isinstance(config_path, str):
            with open(config_path, "r", encoding="utf-8") as input_file:
                config = json.load(input_file)
        pp_config = config.get("post_processor", None)
        if pp_config is None:
            return None
        if isinstance(pp_config, str):
            with open(pp_config, "r", encoding="utf-8") as input_file:
                pp_config = json.load(input_file)
        model_config = pp_config.get("config")
        model = AutoEvalModel.from_config(model_config)
        from server.evaluation.post_processors.llm import LLMPostProcessor
        return LLMPostProcessor(pp_config, model)
