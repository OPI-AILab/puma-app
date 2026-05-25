import json
from datetime import datetime
from typing import Optional, List, Any, Dict

from pydantic import BaseModel
from sqlalchemy import JSON
from sqlmodel import SQLModel, Field, Column, Session, select, func

from server import SearchRequest, ModelDetails, ModelProperties
from server.data import transactional


class Model(SQLModel, table=True):
    id: str = Field(primary_key=True)
    details: Dict[str, Any] = Field(default=None, sa_column=Column(JSON, nullable=False))
    properties: Dict[str, Any] = Field(default=None, sa_column=Column(JSON, nullable=False))


class ModelDAO:

    def __init__(self, engine):
        self.engine = engine

    @transactional
    def get_model(self, model_id: str, session: Session) -> Optional[Model]:
        query = select(Model).where(Model.id == model_id)
        return session.exec(query).first()

    @transactional
    def get_models(self, request: SearchRequest, session: Session) -> List[Model]:
        query = select(Model).offset(request.offset).limit(request.limit)
        return list(session.exec(query).all())

    @transactional
    def get_models_details(self, request: SearchRequest, session: Session) -> List[Dict]:
        query = select(Model).offset(request.offset).limit(request.limit)
        return [val.details for val in session.exec(query).all()]

    @transactional
    def save(self, details: ModelDetails, properties: ModelProperties, session: Session) -> Model:
        other = self.get_model(details.id, session)
        assert other is None, f"Model with id '{details.id}' already exists"
        if properties is None:
            properties = ModelProperties()
        model = Model(
            id=details.id,
            details=details.model_dump(),
            properties=properties.model_dump()
        )
        session.add(model)
        session.commit()
        session.refresh(model)
        return model

    @transactional
    def update_properties(self, model_id: str, properties: ModelProperties, session: Session) -> Model:
        model = self.get_model(model_id, session)
        assert model is not None, f"Model with id '{model_id}' does not exist"
        model.properties = properties.model_dump()
        session.commit()
        session.refresh(model)
        return model

    @transactional
    def update(self, model_id: str, details: ModelDetails, properties: Optional[ModelProperties],
               session: Session) -> Model:
        model = self.get_model(model_id, session)
        assert model is not None, f"Model with id '{model_id}' does not exist"
        model.details = details.model_dump()
        if properties is not None:
            model.properties = properties.model_dump()
        session.commit()
        session.refresh(model)
        return model

    @transactional
    def delete(self, model_id: str, session: Session) -> bool:
        model = self.get_model(model_id, session)
        if model is None:
            return False
        session.delete(model)
        session.commit()
        return True

    @transactional
    def models_for_category(self, category_name: str, session: Session) -> List[Dict]:
        models = self.get_models(SearchRequest())
        result = []
        for model in models:
            properties = model.properties
            categories: Optional[List] = properties.get("categories", None) if properties else None
            if categories is None:
                continue
            for category in categories:
                if category["category"] == category_name:
                    result.append({"model_id": model.id, "selected": category.get("selected", False)})
        result.sort(key=lambda item: item["model_id"])
        return result


class SavedResponse(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    task_id: str = Field(nullable=False, index=True)
    model_id: str = Field(nullable=False, index=True)
    answer: str = Field(nullable=False)
    scores: str = Field(nullable=False)
    date_created: Optional[datetime] = Field(default=None)
    user_created: Optional[int] = Field(default=None)


def _get_by_task_and_model(task_id: str, model_id: str, session: Session) -> Optional[SavedResponse]:
    query = select(SavedResponse).where(
        SavedResponse.task_id == task_id,
        SavedResponse.model_id == model_id
    )
    return session.exec(query).first()


def _to_dict(response: SavedResponse) -> Dict[str, Any]:
    return {
        "id": str(response.id),
        "task_id": response.task_id,
        "model_id": response.model_id,
        "answer": response.answer,
        "scores": json.loads(response.scores),
        "date_created": response.date_created.isoformat() if response.date_created else None,
        "user_created": response.user_created
    }


class SavedResponseRequest(BaseModel):
    task_id: str
    model_id: str
    answer: str
    scores: List[Dict[str, Any]]


class SavedResponseDAO:
    def __init__(self, engine):
        self.engine = engine

    @transactional
    def save(self, task_id: str, model_id: str, answer: str, scores: List[Dict[str, Any]], user_id: int,
             session: Session) -> Dict[str, Any]:
        existing = _get_by_task_and_model(task_id, model_id, session)
        scores_json = json.dumps(scores, ensure_ascii=False)

        if existing:
            response = existing
            response.answer = answer
            response.scores = scores_json
            response.date_created = datetime.now()
            response.user_created = user_id
        else:
            response = SavedResponse(
                task_id=task_id,
                model_id=model_id,
                answer=answer,
                scores=scores_json,
                date_created=datetime.now(),
                user_created=user_id
            )
            session.add(response)
        session.commit()
        session.refresh(response)
        return _to_dict(response)

    @transactional
    def get_by_task_and_model(self, task_id: str, model_id: str, session: Session) -> Optional[Dict[str, Any]]:
        response = _get_by_task_and_model(task_id, model_id, session)
        if response:
            return _to_dict(response)
        return None

    @transactional
    def get_all_for_task(self, task_id: str, session: Session) -> List[Dict[str, Any]]:
        query = select(SavedResponse).where(SavedResponse.task_id == task_id)
        responses = list(session.exec(query).all())
        return [_to_dict(r) for r in responses]

    @transactional
    def count_by_user(self, user_id: int, session: Session) -> int:
        query = select(func.count()).select_from(SavedResponse).where(SavedResponse.user_created == user_id)
        return session.exec(query).one()

    @transactional
    def delete_for_task(self, task_id: str, session: Session) -> int:
        query = select(SavedResponse).where(SavedResponse.task_id == task_id)
        responses = session.exec(query).all()
        count = len(responses)
        for response in responses:
            session.delete(response)
        session.commit()
        return count
