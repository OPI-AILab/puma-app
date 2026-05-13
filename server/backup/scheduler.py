import logging
import threading
from datetime import datetime

from server.backup.cleaner import cleanup_old_backups
from server.backup.config import BackupConfig

logger = logging.getLogger(__name__)

class BackupScheduler:
    def __init__(self, database, config: BackupConfig):
        self.database = database
        self.config = config
        self._thread = None
        self._stop_event = threading.Event()
        self._last_backup_date = None

    def start(self):
        self._thread = threading.Thread(target=self._run_loop, daemon=True)
        self._thread.start()
        logger.info(f"BackupScheduler started. Backup scheduled at {self.config.backup_time}")

    def stop(self):
        self._stop_event.set()
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=5)
        logger.info("BackupScheduler stopped")

    def _run_loop(self):
        while not self._stop_event.is_set():
            if self._is_backup_time():
                self._execute_backup()
            self._stop_event.wait(60)

    def _is_backup_time(self) -> bool:
        now = datetime.now()
        current_time = now.strftime("%H:%M")
        current_date = now.date()
        
        if current_time == self.config.backup_time and self._last_backup_date != current_date:
            return True
        return False

    def _execute_backup(self):
        try:
            logger.info("Starting automatic backup...")
            self._last_backup_date = datetime.now().date()
            backup_dir = self.config.backup_dir or self.database.project_dir
            cleanup_old_backups(backup_dir, self.config.retention_days)
            output_path = self.database.export_project(target_dir=backup_dir)
            logger.info(f"Automatic backup completed: {output_path}")
        except Exception as e:
            logger.error(f"Error during automatic backup: {e}")
