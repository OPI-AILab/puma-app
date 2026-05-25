import json
import logging
import os.path
import shutil
import tempfile
from datetime import datetime
from sqlmodel import create_engine, SQLModel
from server import SearchRequest
from server.data import UserDAO, FileDAO, TaskDAO, ModelDAO, SavedResponseDAO, SettingsDAO
from server.data.evaluations import EvaluationDAO
from server.backup.cleaner import cleanup_old_backups
from server.backup.config import BackupConfig
from typing import Any, Optional

logger = logging.getLogger(__name__)


class Database:

    def __init__(self, args: Any):
        self.project_dir = args.project_dir
        self.db_url = "sqlite:///" + self.project_dir + "/data.db"
        self.engine = create_engine(self.db_url, echo=args.log_sql)
        self.users = UserDAO(self.engine)
        self.files = FileDAO(self.engine, self.project_dir)
        self.tasks = TaskDAO(self.engine)
        self.models = ModelDAO(self.engine)
        self.saved_responses = SavedResponseDAO(self.engine)
        self.evaluations = EvaluationDAO(self.engine)
        self.settings = SettingsDAO(self.engine)
        self._init_db(args)

    def _init_db(self, args):
        db_path = os.path.join(self.project_dir, "data.db")
        db_exists = os.path.exists(db_path)
        init_script_exists = os.path.exists(args.init_script) if args.init_script else False
        SQLModel.metadata.create_all(self.engine)
        self._run_migrations(getattr(args, "migration_script", None))
        if not db_exists and init_script_exists:
            with open(args.init_script, "r", encoding="utf-8") as input_script:
                script = input_script.read()
            with self.engine.connect() as con:
                con.connection.executescript(script)  # use native sqlite executescript() method
                con.commit()

    def _run_migrations(self, migration_script: Optional[str]):
        if not migration_script or not os.path.exists(migration_script):
            return
        with open(migration_script, "r", encoding="utf-8") as f:
            script = f.read()
        no_comments = "\n".join(line for line in script.splitlines() if not line.strip().startswith("--"))
        statements = [s.strip() for s in no_comments.split(";") if s.strip()]
        with self.engine.connect() as con:
            for stmt in statements:
                try:
                    con.connection.execute(stmt)
                    con.commit()
                except Exception as exc:
                    msg = str(exc).lower()
                    if "duplicate column" in msg or "already exists" in msg:
                        logger.debug("Migration already applied: %s", stmt)
                    else:
                        raise

    def export_project(self, target_dir: Optional[str] = None) -> str:
        if target_dir is None:
            target_dir = self.project_dir
        
        with tempfile.TemporaryDirectory() as tmp:
            shutil.copytree(os.path.join(self.project_dir, "files"), os.path.join(tmp, "files"))
            users = self.users.get_users(SearchRequest())
            output_users = [user.model_dump() for user in users if user.username != "admin"]
            with open(os.path.join(tmp, "users.json"), "w", encoding="utf-8") as output_file:
                json.dump(output_users, output_file, ensure_ascii=False, indent=2)
            files = self.files.get_files(SearchRequest())
            output_files = []
            for file in files:
                details = {"id": file.id, "url": file.url, "license": file.license, "attribution": file.attribution}
                output_files.append(details)
            with open(os.path.join(tmp, "files.json"), "w", encoding="utf-8") as output_file:
                json.dump(output_files, output_file, ensure_ascii=False, indent=2)
            models = self.models.get_models(SearchRequest())
            output_models = []
            for model in models:
                output_models.append({"details": model.details, "properties": model.properties})
            with open(os.path.join(tmp, "models.json"), "w", encoding="utf-8") as output_file:
                json.dump(output_models, output_file, ensure_ascii=False, indent=2)
            tasks = self.tasks.get_tasks(SearchRequest())
            output_tasks = []
            for task in tasks:
                details = task.details
                details["metadata"] = {
                    "user_added": task.user_added,
                    "user_modified": task.user_modified,
                    "date_added": task.date_added.isoformat() if task.date_added else None,
                    "date_modified": task.date_modified.isoformat() if task.date_modified else None
                }
                output_tasks.append(details)
            with open(os.path.join(tmp, "tasks.json"), "w", encoding="utf-8") as output_file:
                json.dump(output_tasks, output_file, ensure_ascii=False, indent=2)
            timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
            archive_path = os.path.join(target_dir, f"dump_{timestamp}")
            shutil.make_archive(
                base_name=archive_path,
                format="zip",
                root_dir=tmp
            )
            
            backup_config = BackupConfig()
            cleanup_old_backups(target_dir, backup_config.retention_days)
            
            return archive_path + ".zip"
