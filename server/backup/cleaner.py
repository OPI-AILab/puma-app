import glob
import logging
import os
import time

logger = logging.getLogger(__name__)

def cleanup_old_backups(backup_dir: str, retention_days: int) -> None:
    pattern = os.path.join(backup_dir, "dump_*.zip")
    backup_files = glob.glob(pattern)

    current_time = time.time()
    retention_seconds = retention_days * 24 * 60 * 60

    for backup_file in backup_files:
        try:
            file_mtime = os.path.getmtime(backup_file)
            file_age = current_time - file_mtime

            if file_age > retention_seconds:
                os.remove(backup_file)
                logger.info(f"Deleted old backup: {backup_file}")
        except OSError as e:
            logger.error(f"Error deleting file {backup_file}: {e}")
