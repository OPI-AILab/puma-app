import os
import threading
from typing import List, Dict, Optional

_lang_lock = threading.Lock()
_lang_override: Optional[str] = None


def init_project(project_dir: str):
    os.makedirs(project_dir, exist_ok=True)
    files_dir = os.path.join(project_dir, "files")
    os.makedirs(files_dir, exist_ok=True)


def expand_env_vars(value: Dict, keys_to_expand: List[str]):
    for key in keys_to_expand:
        if key in value:
            field_value = value[key]
            if len(field_value) > 0 and field_value[0] == "$":
                env_name = field_value[1:].strip()
                value[key] = os.environ[env_name]


def default_lang():
    with _lang_lock:
        if _lang_override is not None:
            return _lang_override
    return os.environ.get("MULTIBENCH_LANG", "pl")


def set_default_lang(lang: str):
    global _lang_override
    with _lang_lock:
        _lang_override = lang
    os.environ["MULTIBENCH_LANG"] = lang
