import uuid
from datetime import datetime, timedelta
from typing import Optional, List, Any, Dict, Set
from collections import defaultdict
from sqlalchemy import JSON
from sqlmodel import SQLModel, Field, Column, Session, select, delete
from server import TaskDetails, SearchRequest
from server.data import transactional


class Task(SQLModel, table=True):
    id: str = Field(primary_key=True)
    details: Dict[str, Any] = Field(default=None, sa_column=Column(JSON, nullable=False))
    category: str = Field(nullable=False)
    user_added: str = Field(nullable=False)
    date_added: datetime = Field(nullable=False)
    user_modified: str = Field(nullable=False)
    date_modified: datetime = Field(nullable=False)


class TaskDAO:

    def __init__(self, engine):
        self.engine = engine

    @transactional
    def get_task(self, task_id: str, session: Session) -> Optional[Task]:
        query = select(Task).where(Task.id == task_id)
        return session.exec(query).first()

    @transactional
    def get_tasks(self, request: SearchRequest, session: Session) -> List[Task]:
        query = select(Task).offset(request.offset).limit(request.limit)
        return list(session.exec(query).all())

    @transactional
    def save(self, details: TaskDetails, user: str, session: Session) -> Task:
        task = self.get_task(details.id, session) if details.id is not None else None
        if details.id is None:
            details.id = str(uuid.uuid1())
        details_dict = details.model_dump()
        metadata = None
        if "metadata" in details_dict:
            metadata = details_dict["metadata"]
            del details_dict["metadata"]
        if task is None:
            task = Task(
                id=details.id,
                details=details_dict,
                category=details.category,
                user_added=user if not metadata else metadata.get("user_added", user),
                date_added=datetime.now() if not metadata else self._parse_date(metadata.get("date_added", None)),
                user_modified=user if not metadata else metadata.get("user_modified", user),
                date_modified=datetime.now() if not metadata else self._parse_date(metadata.get("date_modified", None))
            )
            session.add(task)
        else:
            task.details = details_dict
            task.category = details.category
            task.user_modified = user
            task.date_modified = datetime.now()
        session.commit()
        session.refresh(task)
        return task

    @transactional
    def delete(self, task_id: str, session: Session):
        assert task_id is not None
        result = session.exec(delete(Task).where(Task.id == task_id))
        session.commit()
        return result.rowcount

    @transactional
    def get_tags_by_category(self, category: str, session: Session) -> List[Dict[str, Any]]:
        query = select(Task).where(Task.category == category)
        tasks = session.exec(query).all()
        tag_counts: Dict[str, int] = {}
        for task in tasks:
            tags = task.details.get('tags', [])
            for tag in tags:
                tag_counts[tag] = tag_counts.get(tag, 0) + 1
        
        result = [{"name": tag, "count": count} for tag, count in tag_counts.items()]
        return sorted(result, key=lambda x: x['name'])

    @transactional
    def get_all_unique_tags(self, task_id: str, session: Session) -> List[str]:
        query = select(Task)
        tasks = session.exec(query).all()
        all_tags: Set[str] = set()
        current_task_tags: Set[str] = set()
        if task_id:
            current_task = self.get_task(task_id, session)
            if current_task:
                current_task_tags = set(current_task.details.get('tags', []))
        for task in tasks:
            tags = task.details.get('tags', [])
            all_tags.update(tags)
        all_tags -= current_task_tags
        return sorted(list(all_tags))

    @transactional
    def get_weekly_stats(self, session: Session) -> Dict:
        query = select(Task)
        tasks = list(session.exec(query).all())
        weekly_data: Dict[tuple, Dict[str, int]] = defaultdict(lambda: defaultdict(int))
        user_totals: Dict[str, int] = defaultdict(int)
        all_users: Set[str] = set()

        for task in tasks:
            user = task.user_added
            date = task.date_added
            all_users.add(user)
            user_totals[user] += 1
            year, week, _ = date.isocalendar()
            weekly_data[(year, week)][user] += 1
        
        weeks = []

        for (year, week), users_counts in sorted(weekly_data.items(), key=lambda x: x[0], reverse=True):
            start_date = datetime.strptime(f'{year}-W{week:02d}-1', '%G-W%V-%u').date()
            end_date = start_date + timedelta(days=6)
            weeks.append({
                "year": year,
                "week": week,
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "users": dict(users_counts)
            })
        
        return {
            "weeks": weeks,
            "totals": dict(user_totals),
            "all_users": sorted(list(all_users))
        }

    def _parse_date(self, value: str):
        if value is None:
            return None
        return datetime.fromisoformat(value)
