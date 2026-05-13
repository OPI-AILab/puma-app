from collections import defaultdict
from typing import Dict, Set, Tuple, List

from server import EvaluateRequest, TaskDetails
from server.evaluation.api import EvalConsumer


class DatabaseEvalConsumer(EvalConsumer):

    def __init__(self, request: EvaluateRequest, tasks: List[TaskDetails], evaluation_id: str, evaluation_dao,
                 evaluation_name: str = None):
        super().__init__(request, tasks)
        self.evaluation_id = evaluation_id
        self.evaluation_dao = evaluation_dao
        self.evaluation_name = evaluation_name

    def load_previous_scores(self) -> Tuple[Dict, Dict, Set]:
        categories = set(self.request.categories or [])
        hard_scores, soft_scores = defaultdict(list), defaultdict(list)
        task_ids = set()
        page = 1
        limit = 1000
        while True:
            result = self.evaluation_dao.get_entries(self.evaluation_id, page=page, limit=limit)
            entries = result.get("entries", [])
            for entry in entries:
                if entry.get("category") not in categories:
                    continue
                if entry.get("score") is None:
                    continue
                hard_scores[entry["category"]].append(entry["score"])
                soft_scores[entry["category"]].append(entry.get("soft_score") or 0.0)
                task_ids.add(entry["task_id"])
            if page >= result.get("pages", 1):
                break
            page += 1
        return hard_scores, soft_scores, task_ids

    def log_progress(self):
        pass

    def log_sample(self, sample: Dict):
        self.evaluation_dao.add_entry(self.evaluation_id, sample)

    def log_scores(self, scores: Dict):
        if self.evaluation_name:
            result = {}
            for key, value in scores.items():
                result[key] = value
                if key == "model":
                    result["evaluation"] = self.evaluation_name
            scores = result
        self.evaluation_dao.update_evaluation(self.evaluation_id, category_scores=scores)

    def close(self):
        pass
