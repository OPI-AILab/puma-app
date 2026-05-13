import logging
import random
import time
from multiprocessing.pool import ThreadPool
from typing import Union, List, Dict, Iterable, Optional
from openai import OpenAI, AuthenticationError
from pydantic import BaseModel
from server.evaluation import EvalModel, EvalSample, EvalFile, EvalFileType


class TranscribeConfig(BaseModel):
    model: str
    api_base: Union[str, List[str]] = None
    temperature: float = 0.0
    language: str = "pl"
    api_key: str = None
    threads: int = 1
    max_retries: int = 3
    sleep_time: int = 10


class TranscribeModel(EvalModel):

    def __init__(self, config: Dict):
        self.config = TranscribeConfig.model_validate(config)
        self._cancellation_token = None

    def generate(self, batch: List[EvalSample], cancellation_token=None) -> Iterable[EvalSample]:
        self._cancellation_token = cancellation_token
        with ThreadPool(processes=self.config.threads) as pool:
            iterator = pool.imap_unordered(self.generate_one, batch)
            for val in iterator:
                yield val
                if cancellation_token is not None and cancellation_token.is_cancelled:
                    pool.terminate()
                    break

    def generate_one(self, doc: EvalSample):
        api_base = self.config.api_base
        if api_base and isinstance(api_base, list):
            api_base = random.choice(api_base)
        retry = 0
        client = OpenAI(api_key=self.config.api_key or "-", base_url=api_base)
        token = self._cancellation_token
        while retry < self.config.max_retries:
            if token is not None and token.is_cancelled:
                break
            try:
                audio_file = self._find_audio_file(doc)
                if audio_file is None:
                    doc.last_exception = "Incorrect input, missing audio file"
                    doc.answer = ""
                    return doc
                with open(audio_file.path, "rb") as input_file:
                    transcript = client.audio.transcriptions.create(
                        model=self.config.model,
                        language=self.config.language,
                        file=input_file,
                        temperature=self.config.temperature
                    )
                doc.answer = transcript.text or ""
                doc.last_exception = None
                return doc
            except Exception as e:
                logging.error(repr(e))
                doc.last_exception = repr(e)
                if isinstance(e, AuthenticationError):
                    return doc
                if token is not None:
                    token.wait(self.config.sleep_time)
                else:
                    time.sleep(self.config.sleep_time)
                retry += 1
        client.close()
        return doc

    def _find_audio_file(self, doc: EvalSample) -> Optional[EvalFile]:
        for message in doc.messages:
            content = message["content"]
            if isinstance(content, str):
                continue
            for part in content:
                part_type = part["type"]
                if part_type == "file":
                    file: EvalFile = part["file"]
                    file_type = file.file_type
                    if file_type == EvalFileType.AUDIO:
                        return file
        return None

    def properties(self, category: str) -> Dict:
        return self.config.model_dump()
