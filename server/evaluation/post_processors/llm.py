import re
import logging
from typing import List, Iterable, Dict, Optional
from pydantic import BaseModel
from tqdm import tqdm
from server.evaluation import EvalPostProcessor, EvalSample, EvalModel


class LLMPostProcessorConfig(BaseModel):
    prompt: str
    config: Dict
    activate_on_regex: Optional[str] = None


class LLMPostProcessor(EvalPostProcessor):

    def __init__(self, config: Dict, model: EvalModel):
        self.config = LLMPostProcessorConfig.model_validate(config)
        self.model = model

    def process(self, batch: List[EvalSample]) -> Iterable[EvalSample]:
        samples_by_id = {sample.id: sample for sample in batch}
        to_process = batch
        if self.config.activate_on_regex is not None:
            to_process = []
            for sample in batch:
                if re.search(self.config.activate_on_regex, sample.answer, re.MULTILINE | re.UNICODE):
                    to_process.append(sample)
        if len(to_process) == 0:
            return batch
        for sample in to_process:
            logging.info(f"Running post-processor for record {sample.id}")
        to_process = [self._create_sample(sample) for sample in to_process]
        to_process = [
            sample for sample in
            tqdm(
                self.model.generate(to_process),
                total=len(to_process),
                desc="Post-processing",
                disable=len(to_process) <= 1
            )
        ]
        for sample in to_process:
            original_sample = samples_by_id[sample.id]
            original_sample.answer = sample.answer
        return batch

    def _create_sample(self, sample: EvalSample) -> EvalSample:
        prompt = self.config.prompt.format(answer=sample.answer)
        return EvalSample(
            id=sample.id,
            model_id=sample.model_id,
            messages=[{"role": "user", "content": prompt}],
            category=sample.category
        )
