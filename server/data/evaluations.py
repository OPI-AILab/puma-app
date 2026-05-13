import json
import uuid
from datetime import datetime
from typing import Optional, Dict, Any, List, Literal
from sqlmodel import SQLModel, Field, Session, select, delete, func

from server.data import transactional


EvaluationStatus = Literal["pending", "running", "completed", "failed", "cancelled"]

INACTIVE_STATUSES = ("pending", "failed", "cancelled")


class Evaluation(SQLModel, table=True):
    __tablename__ = "evaluation"

    id: str = Field(primary_key=True)
    name: Optional[str] = Field(default=None)
    model_configuration: Optional[str] = Field(default=None)  # JSON
    categories: Optional[str] = Field(default=None)  # JSON
    status: str = Field(default="pending")
    created_at: datetime = Field(default_factory=datetime.now)
    started_at: Optional[datetime] = Field(default=None)
    completed_at: Optional[datetime] = Field(default=None)
    created_by: Optional[str] = Field(default=None)
    total_tasks: int = Field(default=0)
    completed_tasks: int = Field(default=0)
    error_count: int = Field(default=0)
    category_scores: Optional[str] = Field(default=None)  # JSON
    error_message: Optional[str] = Field(default=None)
    error_task_id: Optional[str] = Field(default=None)


class EvaluationEntry(SQLModel, table=True):
    __tablename__ = "evaluation_entry"

    id: Optional[int] = Field(default=None, primary_key=True)
    evaluation_id: Optional[str] = Field(default=None, foreign_key="evaluation.id", index=True)
    task_id: Optional[str] = Field(default=None)
    category: Optional[str] = Field(default=None)
    file: Optional[str] = Field(default=None)
    question: Optional[str] = Field(default=None)
    answer: Optional[str] = Field(default=None)
    score: Optional[float] = Field(default=None)
    soft_score: Optional[float] = Field(default=None)
    scores: Optional[str] = Field(default=None)  # JSON
    error: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.now)


def _evaluation_to_dict(evaluation: Evaluation) -> Dict[str, Any]:
    return {
        "id": evaluation.id,
        "name": evaluation.name,
        "model_configuration": json.loads(evaluation.model_configuration) if evaluation.model_configuration else None,
        "categories": json.loads(evaluation.categories) if evaluation.categories else None,
        "status": evaluation.status,
        "created_at": evaluation.created_at.isoformat() if evaluation.created_at else None,
        "started_at": evaluation.started_at.isoformat() if evaluation.started_at else None,
        "completed_at": evaluation.completed_at.isoformat() if evaluation.completed_at else None,
        "created_by": evaluation.created_by,
        "total_tasks": evaluation.total_tasks,
        "completed_tasks": evaluation.completed_tasks,
        "error_count": evaluation.error_count,
        "category_scores": json.loads(evaluation.category_scores) if evaluation.category_scores else None,
        "error_message": evaluation.error_message,
        "error_task_id": evaluation.error_task_id,
    }


def _entry_to_dict(entry: EvaluationEntry) -> Dict[str, Any]:
    return {
        "id": entry.id,
        "evaluation_id": entry.evaluation_id,
        "task_id": entry.task_id,
        "category": entry.category,
        "file": entry.file,
        "question": entry.question,
        "answer": entry.answer,
        "score": entry.score,
        "soft_score": entry.soft_score,
        "scores": json.loads(entry.scores) if entry.scores else None,
        "error": entry.error,
        "created_at": entry.created_at.isoformat() if entry.created_at else None,
    }


class EvaluationDAO:

    def __init__(self, engine):
        self.engine = engine

    @transactional
    def create_evaluation(self, name: Optional[str], model_configuration: Optional[Dict],
                          categories: Optional[List[str]], user: Optional[str],
                          session: Session) -> str:
        evaluation_id = str(uuid.uuid4())
        evaluation = Evaluation(
            id=evaluation_id,
            name=name,
            model_configuration=json.dumps(model_configuration) if model_configuration is not None else None,
            categories=json.dumps(categories) if categories is not None else None,
            status="pending",
            created_at=datetime.now(),
            created_by=user,
        )
        session.add(evaluation)
        session.commit()
        return evaluation_id

    @transactional
    def get_evaluation(self, evaluation_id: str, session: Session) -> Optional[Dict[str, Any]]:
        evaluation = session.get(Evaluation, evaluation_id)
        if not evaluation:
            return None
        return _evaluation_to_dict(evaluation)

    @transactional
    def get_evaluations(self, page: int, limit: int, session: Session) -> Dict[str, Any]:
        offset = (page - 1) * limit
        total = session.exec(select(func.count(Evaluation.id))).one()
        query = (select(Evaluation)
                 .order_by(Evaluation.created_at.desc())
                 .offset(offset).limit(limit))
        evaluations = session.exec(query).all()
        return {
            "evaluations": [_evaluation_to_dict(e) for e in evaluations],
            "total": total,
            "page": page,
            "limit": limit,
            "pages": (total + limit - 1) // limit if total > 0 else 0,
        }

    @transactional
    def update_evaluation(self, evaluation_id: str, session: Session, **fields) -> bool:
        evaluation = session.get(Evaluation, evaluation_id)
        if not evaluation:
            return False
        for key, value in fields.items():
            if key == "category_scores" and isinstance(value, dict):
                value = json.dumps(value)
            setattr(evaluation, key, value)
        session.commit()
        return True

    @transactional
    def add_entry(self, evaluation_id: str, entry_data: Dict[str, Any], session: Session) -> None:
        scores_json = json.dumps(entry_data.get("scores")) if entry_data.get("scores") is not None else None
        entry = EvaluationEntry(
            evaluation_id=evaluation_id,
            task_id=entry_data.get("id"),
            category=entry_data.get("category"),
            file=entry_data.get("file"),
            question=entry_data.get("question"),
            answer=entry_data.get("answer"),
            score=entry_data.get("score"),
            soft_score=entry_data.get("soft_score"),
            scores=scores_json,
            error=entry_data.get("error"),
            created_at=datetime.now(),
        )
        session.add(entry)
        session.commit()

        evaluation = session.get(Evaluation, evaluation_id)
        if evaluation:
            evaluation.completed_tasks += 1
            if entry_data.get("error"):
                evaluation.error_count += 1
            session.commit()

    @transactional
    def get_entries(self, evaluation_id: str, page: int, limit: int, session: Session) -> Dict[str, Any]:
        offset = (page - 1) * limit
        total = session.exec(
            select(func.count(EvaluationEntry.id))
            .where(EvaluationEntry.evaluation_id == evaluation_id)
        ).one()
        query = (select(EvaluationEntry)
                 .where(EvaluationEntry.evaluation_id == evaluation_id)
                 .offset(offset).limit(limit))
        entries = session.exec(query).all()
        return {
            "entries": [_entry_to_dict(e) for e in entries],
            "total": total,
            "page": page,
            "limit": limit,
            "pages": (total + limit - 1) // limit if total > 0 else 0,
        }

    @transactional
    def get_entry(self, evaluation_id: str, entry_id: int, session: Session) -> Optional[Dict[str, Any]]:
        query = select(EvaluationEntry).where(
            EvaluationEntry.evaluation_id == evaluation_id,
            EvaluationEntry.id == entry_id,
        )
        entry = session.exec(query).first()
        if not entry:
            return None
        return _entry_to_dict(entry)

    @transactional
    def delete_evaluation(self, evaluation_id: str, session: Session) -> bool:
        evaluation = session.get(Evaluation, evaluation_id)
        if not evaluation:
            return False
        session.exec(delete(EvaluationEntry).where(EvaluationEntry.evaluation_id == evaluation_id))
        session.delete(evaluation)
        session.commit()
        return True

    @transactional
    def reset_evaluation(self, evaluation_id: str, session: Session) -> bool:
        evaluation = session.get(Evaluation, evaluation_id)
        if not evaluation:
            return False
        session.exec(delete(EvaluationEntry).where(EvaluationEntry.evaluation_id == evaluation_id))
        evaluation.completed_tasks = 0
        evaluation.error_count = 0
        evaluation.category_scores = None
        evaluation.error_message = None
        evaluation.error_task_id = None
        evaluation.started_at = None
        evaluation.completed_at = None
        session.commit()
        return True
