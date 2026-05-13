import asyncio
import copy
import json
import logging
import threading
from datetime import datetime
from typing import Optional

from server import EvaluateRequest, TaskDetails, SearchRequest
from server.data.evaluations import INACTIVE_STATUSES
from server.evaluation.api import AutoEvalModel

logger = logging.getLogger(__name__)


class CancellationToken:
    def __init__(self):
        self._event = threading.Event()

    @property
    def is_cancelled(self) -> bool:
        return self._event.is_set()

    def cancel(self):
        self._event.set()

    def wait(self, timeout: float):
        self._event.wait(timeout)


from server.evaluation.consumer import DatabaseEvalConsumer


class EvaluationRunner:

    def __init__(self, evaluator, evaluation_dao, task_dao):
        self._evaluator = evaluator
        self._evaluation_dao = evaluation_dao
        self._task_dao = task_dao
        self._active_task: Optional[asyncio.Task] = None
        self._cancellation_token: Optional[CancellationToken] = None
        self._active_evaluation_id: Optional[str] = None
        self._lock = asyncio.Lock()

    def is_running(self) -> bool:
        return self._active_task is not None and not self._active_task.done()

    @property
    def active_evaluation_id(self) -> Optional[str]:
        return self._active_evaluation_id if self.is_running() else None

    async def start(self, evaluation_id: str, reset: bool = False):
        async with self._lock:
            await self._start_locked(evaluation_id, reset=reset)

    async def _start_locked(self, evaluation_id: str, reset: bool = False):
        if self.is_running():
            raise ValueError("Another evaluation is already running")

        evaluation = self._evaluation_dao.get_evaluation(evaluation_id)
        if evaluation is None:
            raise ValueError(f"Evaluation {evaluation_id} not found")

        status = evaluation.get("status")
        if status in ("running", "cancelling"):
            self._evaluation_dao.update_evaluation(
                evaluation_id,
                status="failed",
                error_message="Server restarted during evaluation",
            )
            evaluation["status"] = "failed"
            status = "failed"

        if status not in INACTIVE_STATUSES:
            raise ValueError(f"Cannot start evaluation with status '{status}'")

        if reset:
            self._evaluation_dao.reset_evaluation(evaluation_id)

        model_config = evaluation.get("model_configuration")
        categories = evaluation.get("categories")

        model = AutoEvalModel.from_config(copy.deepcopy(model_config))

        model_id = (model_config or {}).get("id") or f"eval_{evaluation_id[:8]}"
        evaluation_name = evaluation.get("name") or f"Evaluation {evaluation_id[:8]}"

        tasks = self._task_dao.get_tasks(SearchRequest())
        task_details = [TaskDetails.model_validate(task.details) for task in tasks]

        if categories:
            matching = [t for t in task_details if t.category in categories]
        else:
            matching = task_details
        total = len(matching)

        entries_result = self._evaluation_dao.get_entries(evaluation_id, page=1, limit=1)
        existing_entries = entries_result.get("total", 0)
        has_entries = existing_entries > 0

        request = EvaluateRequest(
            model=evaluation_id,
            categories=categories,
            continue_from=evaluation_id if has_entries else None,
        )

        consumer = DatabaseEvalConsumer(
            request, task_details, evaluation_id, self._evaluation_dao,
            evaluation_name=evaluation_name,
        )

        self._cancellation_token = CancellationToken()

        self._evaluation_dao.update_evaluation(
            evaluation_id,
            status="running",
            started_at=datetime.now(),
            total_tasks=total,
            completed_tasks=existing_entries,
            error_message=None,
            error_task_id=None,
        )

        self._active_evaluation_id = evaluation_id
        self._active_task = asyncio.create_task(
            self._run(evaluation_id, model, consumer, model_id)
        )

    async def _run(self, evaluation_id: str, model, consumer, model_id: str):
        try:
            await asyncio.to_thread(
                self._evaluator.evaluate_full,
                model_id,
                model,
                None,
                consumer,
                self._cancellation_token,
            )
            if self._cancellation_token and self._cancellation_token.is_cancelled:
                self._evaluation_dao.update_evaluation(evaluation_id, status="cancelled")
            else:
                self._evaluation_dao.update_evaluation(
                    evaluation_id,
                    status="completed",
                    completed_at=datetime.now(),
                )
        except Exception as e:
            logger.exception("Evaluation %s failed", evaluation_id)
            self._evaluation_dao.update_evaluation(
                evaluation_id,
                status="failed",
                error_message=str(e),
                error_task_id=consumer.last_task_id,
            )
        finally:
            consumer.close()
            self._active_task = None
            self._active_evaluation_id = None
            self._cancellation_token = None

    def cancel(self):
        if self._cancellation_token is None:
            return
        self._cancellation_token.cancel()
        if self._active_evaluation_id is not None:
            self._evaluation_dao.update_evaluation(
                self._active_evaluation_id,
                status="cancelling",
            )
