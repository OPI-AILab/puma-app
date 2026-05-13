import json
from typing import Dict, List, Iterable
from server.evaluation import EvalModel, EvalSample


class FileModel(EvalModel):

    def __init__(self, path: str):
        self.path = path
        self.answers = self._load_file(path)

    def _load_file(self, path: str) -> Dict[str, str]:
        results = {}
        with open(path, "r", encoding="utf-8") as input_file:
            for line in input_file:
                value = json.loads(line)
                results[value["id"]] = value["answer"]
        return results

    def generate(self, batch: List[EvalSample], cancellation_token=None) -> Iterable[EvalSample]:
        return [self.generate_one(sample) for sample in batch]

    def generate_one(self, sample: EvalSample) -> EvalSample:
        assert sample.id in self.answers, f"{sample.id} not in answers"
        sample.answer = self.answers[sample.id]
        return sample

    def properties(self, category: str) -> Dict:
        return {"path": self.path}
