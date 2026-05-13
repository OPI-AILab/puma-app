import os
from typing import List, Dict


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
    return os.environ.get("MULTIBENCH_LANG", "pl")
