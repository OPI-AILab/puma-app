from multiprocessing.pool import ThreadPool
from typing import List, Iterable, Dict
from server.evaluation import EvalModel, EvalSample


class RouterModel(EvalModel):

    def __init__(self, models: Dict[str, EvalModel], threads: int):
        self.models = models
        self.threads = threads
        self._cancellation_token = None

    def generate(self, batch: List[EvalSample], cancellation_token=None) -> Iterable[EvalSample]:
        self._cancellation_token = cancellation_token
        for model in self.models.values():
            setattr(model, "_cancellation_token", cancellation_token)
        with ThreadPool(processes=self.threads) as pool:
            iterator = pool.imap_unordered(self.generate_one, batch)
            for val in iterator:
                yield val
                if cancellation_token is not None and cancellation_token.is_cancelled:
                    pool.terminate()
                    break

    def generate_one(self, sample: EvalSample) -> EvalSample:
        cat = sample.category or "default"
        model = self.models.get(cat, self.models.get("default"))
        return model.generate_one(sample)

    def properties(self, category: str) -> Dict:
        model = self.models.get(category or "default", self.models.get("default"))
        return model.properties(category)

