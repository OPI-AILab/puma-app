import json
import logging
import random
import time
from multiprocessing.pool import ThreadPool
from traceback import print_exc
from typing import Union, List, Optional, Dict, Iterable, Any
from openai import OpenAI, AuthenticationError, Omit
from pydantic import BaseModel

from server.evaluation import EvalModel, EvalSample, EvalFile, EvalFileType, ApiType


class RemoteLLMConfig(BaseModel):
    model: str
    api_base: Union[str, List[str]] = None
    max_tokens: int = None
    temperature: float = 0.0
    max_retries: int = 3
    threads: int = 1
    sleep_time: int = 10
    params: Optional[Dict] = None
    api_key: str = None
    # Model specific params
    wrap_json_array: bool = False
    basic_schema: bool = False
    max_file_bytes: Optional[int] = None
    reasoning_effort: Optional[str] = None


class RemoteLLMModel(EvalModel):

    def __init__(self, config: Dict):
        self.config = RemoteLLMConfig.model_validate(config)
        self.api_type: ApiType = ApiType(config.get("api_type", "openrouter"))
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
        temperature = self.config.temperature
        client = OpenAI(api_key=self.config.api_key or "-", base_url=api_base)
        token = self._cancellation_token
        while retry < self.config.max_retries:
            if token is not None and token.is_cancelled:
                break
            try:
                extra_body = {}
                if self.config.params:
                    extra_body.update(self.config.params)
                messages: Any = [self._get_message(msg) for msg in doc.messages]
                response_format = None
                if doc.json_schema:
                    response_format = {
                        "type": "json_schema",
                        "strict": True,
                        "json_schema": doc.json_schema
                    }
                logging.info(f"Sending request to {self.config.model} for record {doc.id}")
                response = client.chat.completions.create(
                    model=self.config.model,
                    messages=messages,
                    max_completion_tokens=self.config.max_tokens,
                    temperature=temperature,
                    stream=False,
                    response_format=response_format,
                    extra_body=extra_body,
                    timeout=3600,
                    reasoning_effort=self.config.reasoning_effort if self.config.reasoning_effort else Omit()
                )
                completion = response.choices[0] if response.choices is not None else None
                if completion is None:
                    temperature += 0.3
                    raise ValueError("Empty response object")
                if completion.finish_reason != "stop":
                    logging.warning(f"Finish reason for record {doc.id}: {completion.finish_reason}")
                content = completion.message.content
                if doc.json_schema and content:
                    try:
                        parsed = json.loads(content)
                        if doc.is_json_array and self.config.wrap_json_array:
                            parsed = parsed.get("items", parsed)
                        content = json.dumps(parsed, ensure_ascii=False, separators=(',', ':'))
                    except json.JSONDecodeError:
                        pass
                doc.answer = content
                if doc.answer is None or len(doc.answer.strip()) == 0:
                    temperature += 0.3
                    raise ValueError("Empty answer")
                doc.last_exception = None
                return doc
            except Exception as e:
                logging.error(f"Failed sample {doc.id}")
                print_exc()
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

    def _get_message(self, message: Dict):
        content = message["content"]
        if isinstance(content, str):
            return message
        inputs = []
        result = {"role": message["role"], "content": inputs}
        for part in content:
            part_type = part["type"]
            if part_type == "file":
                file: EvalFile = part["file"]
                file_type = file.file_type
                if self.config.max_file_bytes is not None and file_type == EvalFileType.IMAGE:
                    file = file.compress_image(self.config.max_file_bytes)
                assert file_type is not None, f"unknown file type: {file.path}"
                if file_type == EvalFileType.IMAGE and self.api_type == ApiType.INLINE:
                    encoded = f"<img src=\"data:{file.mime_type};base64,{file.base64()}\" />"
                    inputs.append({"type": "text", "text": encoded})
                elif file_type == EvalFileType.IMAGE:
                    encoded = f"data:{file.mime_type};base64,{file.base64()}"
                    inputs.append({"type": "image_url", "image_url": {"url": encoded}})
                elif file_type == EvalFileType.AUDIO and self.api_type in ApiType.INLINE:
                    encoded = f"<audio src=\"data:{file.mime_type};base64,{file.base64()}\" />"
                    inputs.append({"type": "text", "text": encoded})
                elif file_type == EvalFileType.AUDIO and self.api_type in ApiType.GEMINI:
                    encoded = f"data:{file.mime_type};base64,{file.base64()}"
                    inputs.append({"type": "file", "file_data": encoded})
                elif file_type == EvalFileType.AUDIO and self.api_type == ApiType.OPENROUTER:
                    b64 = file.base64()
                    inputs.append({"type": "input_audio", "input_audio": {"data": b64, "format": file.extension}})
                elif file_type == EvalFileType.VIDEO and self.api_type == ApiType.GEMINI:
                    encoded = f"data:{file.mime_type};base64,{file.base64()}"
                    inputs.append({"type": "file", "file_data": encoded})
                elif file_type == EvalFileType.VIDEO and self.api_type == ApiType.OPENROUTER:
                    encoded = f"data:{file.mime_type};base64,{file.base64()}"
                    inputs.append({"type": "video_url", "video_url": {"url": encoded}})
                elif file_type == EvalFileType.VIDEO:
                    logging.warning(f"Video not supported for API type {self.api_type}, skipping file: {file.path}")
            else:
                inputs.append(part)
        if self.api_type == ApiType.INLINE:
            texts = " ".join([val["text"] for val in inputs])
            return {"role": message["role"], "content": texts}
        return result

    def properties(self, category: str) -> Dict:
        return self.config.model_dump()
