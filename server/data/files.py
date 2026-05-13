import hashlib
import os.path
import re
from datetime import datetime
from typing import List

from fastapi import UploadFile
from sqlmodel import SQLModel, Field, Session, select, delete

from server import SearchRequest
from server.data import transactional


class File(SQLModel, table=True):
    id: str = Field(primary_key=True)
    file_hash: str = Field(nullable=False)
    file_len: int = Field(nullable=False)
    url: str = Field(nullable=True)
    license: str = Field(nullable=True)
    attribution: str = Field(nullable=True)
    user_added: str = Field(nullable=False)
    date_added: datetime = Field(nullable=False)


class FileDAO:

    SUPPORTED_TYPES = {"jpg", "jpeg", "png", "webp", "wav", "mp3", "mp4", "webm"}

    def __init__(self, engine, project_dir : str):
        self.engine = engine
        self.project_dir = project_dir

    @transactional
    def upload(self, file: UploadFile, user: str, url: str, license: str, attr: str, session: Session) -> File:
        file_bytes = file.file.read()
        file_name = re.sub(r"[#/\\?%*:|\"<>\x7F\x00-\x1F\s]", "_", file.filename)
        file_hash = hashlib.md5(file_bytes).hexdigest()
        query = select(File).where(File.file_hash == file_hash)
        result = session.exec(query).first()
        if result is not None:
            return result
        ext = file_name.split(".")[-1].lower()
        assert ext in self.SUPPORTED_TYPES, f"Unsupported file type '{ext}', should be one of {self.SUPPORTED_TYPES}"
        VIDEO_TYPES = {"mp4", "webm"}
        MAX_VIDEO_SIZE = 20 * 1024 * 1024  # 20MB
        if ext in VIDEO_TYPES:
            assert len(file_bytes) <= MAX_VIDEO_SIZE, f"Video file too large ({len(file_bytes)} bytes), max {MAX_VIDEO_SIZE} bytes (20MB)"
        file_path = os.path.join(self.project_dir, "files", file_name)
        idx = 0
        while os.path.exists(file_path):
            file_path = os.path.join(self.project_dir, "files", f"{idx}_{file_name}")
            idx += 1
        with open(file_path, "wb") as output_file:
            output_file.write(file_bytes)
        file_name = os.path.basename(file_path)
        result = File(
            id=file_name,
            file_hash=file_hash,
            file_len=len(file_bytes),
            url=url,
            license=license,
            attribution=attr,
            user_added=user,
            date_added=datetime.now()
        )
        session.add(result)
        session.commit()
        session.refresh(result)
        return result

    @transactional
    def update_metadata(self, file_id: str, url: str, license: str, attr: str, session: Session):
        query = select(File).where(File.id == file_id)
        result: File = session.exec(query).first()
        assert result is not None, f"file {file_id} does not exist"
        result.url = url
        result.license = license
        result.attribution = attr
        session.commit()

    @transactional
    def delete(self, file_id: str, session: Session):
        assert file_id is not None
        result = session.exec(delete(File).where(File.id == file_id))
        file_path = os.path.join(self.project_dir, "files", file_id)
        if os.path.exists(file_path):
            os.remove(file_path)
        session.commit()
        return result.rowcount

    @transactional
    def get_file(self, file_id: str, session: Session) -> File:
        query = select(File).where(File.id == file_id)
        result: File = session.exec(query).first()
        if result is None:
            raise ValueError(f"File with id {file_id} does not exist")
        return result

    @transactional
    def get_files(self, request: SearchRequest, session: Session) -> List[File]:
        query = select(File).offset(request.offset).limit(request.limit)
        return list(session.exec(query).all())
