import json
import logging
import os
import sys
from typing import Dict
from urllib.parse import urlparse

import pandas as pd


class MetadataValidation:

    def validate(self, tasks_file: str, files_file: str):
        data = self._load_tasks(tasks_file)
        val = []
        if os.path.exists(files_file):
            with open(files_file, "r", encoding="UTF-8") as input_file:
                files = json.load(input_file)
                for file in files:
                    if file["id"] in data:
                        validated = self._validate_matadata(file)
                        if validated:
                            task = data[file["id"]]
                            task["valid_msg"] = validated
                            val.append(task)
        self._save_to_file(val)

    def _load_tasks(self, tasks_file: str):
        data = {}
        if os.path.exists(tasks_file):
            with open(tasks_file, "r", encoding="UTF-8") as input_data:
                tasks = json.load(input_data)
        for task in tasks:
            for content in task["content"]:
                if content["type"] == "file":
                    record = {"id": task["id"], "category": task["category"], "user_added": task['metadata']["user_added"]}
                    data[content["file"]] = record
        return data

    def _save_to_file(self, data: []):
        df = pd.DataFrame(data)
        df.to_csv('validated_data.csv', encoding="UTF-8", index=False)

    def _validate_matadata(self, file: Dict):
        msg = []
        if not self._validate_url(file):
            msg.append("Wrong or empty url")
        if not self._validate_attribution(file):
            msg.append("No attribution")
        return msg

    def _validate_url(self, file: Dict):
        parsed = urlparse(file["url"])
        path = parsed.path
        homepage = path in ("", "/")
        return file["url"] is not None and file["url"] != "" and not homepage

    def _validate_license(self, file: Dict):
        return file["license"] is not None and file["license"] != ""

    def _validate_attribution(self, file: Dict):
        return file["attribution"] is not None and file["attribution"] != ""


if __name__ == '__main__':
    logging.basicConfig(format='%(asctime)s : %(message)s', level=logging.INFO)
    logging.root.setLevel(logging.INFO)
    validate = MetadataValidation()
    validate.validate(sys.argv[1], sys.argv[2])