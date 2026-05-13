import json
import logging
import os
from typing import Dict
import requests


class BenchmarkClient:

    def __init__(self, base_url: str = "http://localhost:8080/api"):
        self.base_url = base_url.strip("/")
        self.cookies = None

    def login(self, username: str, password: str):
        body = {"username": username, "password": password}
        resp = self._post("/login", body)
        self.cookies = resp.cookies

    def _post(self, path: str, body: Dict) -> requests.Response:
        url = f"{self.base_url}/{path.lstrip('/')}"
        headers = {"Content-Type": "application/json"}
        resp = requests.post(url=url, json=body, headers=headers, cookies=self.cookies)
        if resp.status_code != 200:
            raise RuntimeError(resp.text)
        return resp

    def upload_file(self, file_path: str, **kwargs):
        url = f"{self.base_url}/file/upload"
        headers = {}
        data = {"url": None, "license": None, "attribution": None}
        data.update(kwargs)
        with open(file_path, "rb") as input_file:
            resp = requests.post(url=url, files={"file": input_file}, headers=headers, data=data, cookies=self.cookies)
        if resp.status_code != 200:
            raise RuntimeError(resp.text)
        return resp.json()

    def add_task(self, task: Dict):
        self._post("/task/save", task).json()

    def add_model(self, model: Dict):
        self._post("/model/save", model).json()

    def add_user(self, user: Dict):
        self._post(f"/user/save", user).json()

    def create_project(self, data_dir: str = "example_project"):
        self.login("admin", "admin")
        if os.path.exists(os.path.join(data_dir, "users.json")):
            with open(os.path.join(data_dir, "users.json"), "r") as input_file:
                users = json.load(input_file)
                for user in users:
                    self.add_user(user)
        files_json = os.path.join(data_dir, "files.json")
        if os.path.exists(files_json):
            self._add_files_from_metadata(data_dir)
        else:
            self._add_files_from_dir(data_dir)
        with open(os.path.join(data_dir, "tasks.json"), "r", encoding="utf-8") as input_file:
            tasks = json.load(input_file)
            for task in tasks:
                self.add_task(task)
        with open(os.path.join(data_dir, "models.json"), "r", encoding="utf-8") as input_file:
            models = json.load(input_file)
            for model in models:
                self.add_model(model)

    def _add_files_from_metadata(self, data_dir: str):
        files_json = os.path.join(data_dir, "files.json")
        with open(files_json, "r", encoding="utf-8") as input_file:
            files = json.load(input_file)
            for file in files:
                file_name = file["id"]
                file_path = os.path.join(data_dir, "files", file_name)
                assert os.path.exists(file_path), "file {} not found but defined in metadata".format(file_path)
                del file["id"]
                file["file_path"] = file_path
                self.upload_file(**file)

    def _add_files_from_dir(self, data_dir: str):
        files_path = os.path.join(data_dir, "files")
        files = os.listdir(files_path)
        for file in files:
            file_path = os.path.join(files_path, file)
            self.upload_file(file_path)


if __name__ == '__main__':
    logging.basicConfig(format='%(asctime)s : %(message)s', level=logging.INFO)
    logging.root.setLevel(logging.INFO)
    client = BenchmarkClient()
    client.create_project("example_project")
