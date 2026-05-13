import os


class BackupConfig:
    def __init__(self):
        self.enabled = os.environ.get("BACKUP_ENABLED", "true").lower() == "true"
        self.backup_dir = os.environ.get("BACKUP_DIR", None)
        self.backup_time = os.environ.get("BACKUP_TIME", "00:00")
        self.retention_days = int(os.environ.get("BACKUP_RETENTION_DAYS", "7"))
