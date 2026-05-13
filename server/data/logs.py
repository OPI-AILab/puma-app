import json
import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlmodel import SQLModel, Field, Session, select, delete, func


class LogImport(SQLModel, table=True):
    __tablename__ = "log_import"
    
    id: str = Field(primary_key=True)
    name: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.now)
    total_entries: int = Field(default=0)
    avg_score: float = Field(default=0.0)


class LogEntry(SQLModel, table=True):
    __tablename__ = "log_entry"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    import_id: Optional[str] = Field(default=None, foreign_key="log_import.id", index=True)
    task_id: Optional[str] = Field(default=None)
    file: Optional[str] = Field(default=None)
    question: Optional[str] = Field(default=None)
    answer: Optional[str] = Field(default=None)
    category: Optional[str] = Field(default=None)
    score: Optional[float] = Field(default=None)
    scores: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.now)


def _entry_to_dict(entry: LogEntry) -> Dict[str, Any]:
    return {
        "id": entry.id,
        "import_id": entry.import_id,
        "task_id": entry.task_id,
        "file": entry.file,
        "question": entry.question,
        "answer": entry.answer,
        "category": entry.category,
        "score": entry.score,
        "scores": json.loads(entry.scores) if entry.scores else None,
        "created_at": entry.created_at.isoformat() if entry.created_at else None
    }


class LogsDAO:

    def __init__(self, engine):
        self.engine = engine

    def create_log_import(self, name: str) -> str:
        import_id = str(uuid.uuid4())
        with Session(self.engine) as session:
            log_import = LogImport(
                id=import_id,
                name=name,
                created_at=datetime.now(),
                total_entries=0,
                avg_score=0.0
            )
            session.add(log_import)
            session.commit()
        return import_id

    def add_log_entries(self, import_id: str, entries: List[Dict[str, Any]]) -> None:
        with Session(self.engine) as session:
            total_score = 0.0
            score_count = 0
            
            for entry in entries:
                scores_json = json.dumps(entry.get("scores")) if entry.get("scores") else None
                log_entry = LogEntry(
                    import_id=import_id,
                    task_id=entry.get("id"),
                    file=entry.get("file"),
                    question=entry.get("question"),
                    answer=entry.get("answer"),
                    category=entry.get("category"),
                    score=entry.get("score"),
                    scores=scores_json,
                    created_at=datetime.now()
                )
                session.add(log_entry)
                
                if entry.get("score") is not None:
                    total_score += entry["score"]
                    score_count += 1
            
            session.commit()
            
            log_import = session.get(LogImport, import_id)
            if log_import:
                log_import.total_entries = len(entries)
                log_import.avg_score = total_score / score_count if score_count > 0 else 0.0
                session.commit()

    def get_log_import(self, import_id: str) -> Optional[Dict[str, Any]]:
        with Session(self.engine) as session:
            log_import = session.get(LogImport, import_id)
            if not log_import:
                return None
            return {
                "id": log_import.id,
                "name": log_import.name,
                "created_at": log_import.created_at.isoformat() if log_import.created_at else None,
                "total_entries": log_import.total_entries,
                "avg_score": log_import.avg_score
            }

    def get_log_entries(self, import_id: str, page: int = 1, limit: int = 50) -> Dict[str, Any]:
        with Session(self.engine) as session:
            offset = (page - 1) * limit
            
            total_query = select(func.count(LogEntry.id)).where(LogEntry.import_id == import_id)
            total = session.exec(total_query).one()
            
            query = select(LogEntry).where(LogEntry.import_id == import_id).offset(offset).limit(limit)
            entries = session.exec(query).all()
            
            return {
                "entries": [_entry_to_dict(entry) for entry in entries],
                "total": total,
                "page": page,
                "limit": limit,
                "pages": (total + limit - 1) // limit if total > 0 else 0
            }

    def get_log_entry(self, import_id: str, entry_id: int) -> Optional[Dict[str, Any]]:
        with Session(self.engine) as session:
            query = select(LogEntry).where(
                LogEntry.import_id == import_id,
                LogEntry.id == entry_id
            )
            entry = session.exec(query).first()
            if not entry:
                return None
            return _entry_to_dict(entry)

    def delete_log_import(self, import_id: str) -> bool:
        with Session(self.engine) as session:
            log_import = session.get(LogImport, import_id)
            if not log_import:
                return False
            
            session.exec(delete(LogEntry).where(LogEntry.import_id == import_id))
            session.delete(log_import)
            session.commit()
            return True
