from typing import Optional
from sqlmodel import SQLModel, Field, Session
from server.data import transactional


class Setting(SQLModel, table=True):
    key: str = Field(primary_key=True)
    value: str


class SettingsDAO:

    def __init__(self, engine):
        self.engine = engine

    @transactional
    def get(self, key: str, session: Session) -> Optional[str]:
        setting = session.get(Setting, key)
        return setting.value if setting else None

    @transactional
    def set(self, key: str, value: str, session: Session) -> Setting:
        setting = session.get(Setting, key)
        if setting:
            setting.value = value
        else:
            setting = Setting(key=key, value=value)
        session.add(setting)
        session.commit()
        session.refresh(setting)
        return setting
