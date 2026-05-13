from typing import Optional, List
from sqlmodel import SQLModel, Field, Session, select
from server import SearchRequest
from server.data import transactional


class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(index=True, unique=True)
    password: str


class UserDAO:

    def __init__(self, engine):
        self.engine = engine

    @transactional
    def get_user(self, username: str, session: Session) -> Optional[User]:
        query = select(User).where(User.username == username)
        return session.exec(query).first()

    @transactional
    def get_users(self, request: SearchRequest, session: Session) -> List[User]:
        query = select(User).offset(request.offset).limit(request.limit)
        return list(session.exec(query).all())

    @transactional
    def save(self, user: User, session: Session) -> User:
        session.add(user)
        session.commit()
        session.refresh(user)
        return user
