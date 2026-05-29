import argparse
import json
import logging
import mimetypes
import os
import re
import signal
from typing import Optional

import uvicorn
from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Form, Request, Response
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.cors import CORSMiddleware

from server import Security, LoginRequest, init_project, UpdateFileRequest, TaskDetails, SearchRequest, CATEGORIES, \
    ModelDetailsAndProperties, EvaluateRequest, CATEGORY_VERIFICATION_MAP, CreateEvaluationRequest, \
    UpdateEvaluationConfigurationRequest, StartEvaluationRequest, set_default_lang, default_lang, LangRequest
from server.backup.config import BackupConfig
from server.backup.scheduler import BackupScheduler
from server.data import User, SavedResponseRequest
from server.data.database import Database
from server.data.evaluations import INACTIVE_STATUSES
from server.data.logs import LogsDAO
import copy
from server.evaluation import TaskEvaluator, FileEvalConsumer, AutoPostProcessor, EvaluationRunner, AutoEvalModel


def create_app():
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", type=str, default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8080)
    parser.add_argument("--project_dir", type=str, default="_project")
    parser.add_argument("--jwt_secret", type=str, default="l1QBN1IgSTXY3fB0YtXYWr1Ik3QPpo6H")
    parser.add_argument("--init_script", type=str, default="init.sql")
    parser.add_argument("--migration_script", type=str, default="migrations.sql")
    parser.add_argument("--prompts_file", type=str, default="prompts.json")
    parser.add_argument("--log_sql", type=bool, default=False)
    args = parser.parse_args()
    init_project(args.project_dir)
    Security.SECRET_KEY = args.jwt_secret
    with open(args.prompts_file, "r", encoding="utf-8") as prompts_file:
        prompts = json.load(prompts_file)
    db = Database(args)
    saved_lang = db.settings.get("default_lang")
    if saved_lang:
        set_default_lang(saved_lang)
    logs_dao = LogsDAO(db.engine)
    evaluator = TaskEvaluator(args.project_dir, prompts, db.models.get_models_details(SearchRequest()))
    runner = EvaluationRunner(evaluator, db.evaluations, db.tasks)

    backup_config = BackupConfig()
    if backup_config.backup_dir is None:
        backup_config.backup_dir = args.project_dir
    
    scheduler = BackupScheduler(db, backup_config)
    if backup_config.enabled:
        scheduler.start()

    app = FastAPI()
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    app.mount("/api/files", StaticFiles(directory=os.path.join(args.project_dir, "files")), name="files")

    @app.post("/api/logs/import")
    async def import_logs(
        file: UploadFile = File(...),
        name: Optional[str] = Form(None)
    ):
        if not file.filename.endswith(".jsonl"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File must be a JSONL file"
            )
        
        content = await file.read()
        lines = content.decode("utf-8").strip().split("\n")
        
        entries = []
        for i, line in enumerate(lines):
            if not line.strip():
                continue
            try:
                entry = json.loads(line)
                entries.append(entry)
            except json.JSONDecodeError as e:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid JSON at line {i + 1}: {str(e)}"
                )
        
        if not entries:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File contains no valid entries"
            )
        
        import_name = name or file.filename
        import_id = logs_dao.create_log_import(import_name)
        logs_dao.add_log_entries(import_id, entries)
        
        return {
            "import_id": import_id,
            "name": import_name,
            "total_entries": len(entries)
        }

    @app.get("/api/logs/{import_id}")
    def get_log_import(import_id: str):
        log_import = logs_dao.get_log_import(import_id)
        if not log_import:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Import not found"
            )
        return log_import

    @app.get("/api/logs/{import_id}/entries")
    def get_log_entries(import_id: str, page: int = 1, limit: int = 50):
        log_import = logs_dao.get_log_import(import_id)
        if not log_import:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Import not found"
            )
        return logs_dao.get_log_entries(import_id, page, limit)

    @app.get("/api/logs/{import_id}/entries/{entry_id}")
    def get_log_entry(import_id: str, entry_id: int):
        entry = logs_dao.get_log_entry(import_id, entry_id)
        if not entry:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Entry not found"
            )
        return entry

    @app.delete("/api/logs/{import_id}")
    def delete_log_import(import_id: str):
        deleted = logs_dao.delete_log_import(import_id)
        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Import not found"
            )
        return {"success": True}

    @app.post("/api/login")
    def login(request: LoginRequest, response: Response):
        user = db.users.get_user(request.username)
        if not user or not Security.verify_password(request.password, user.password):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
        access_token = Security.create_token(data={"sub": user.username})
        response.set_cookie(
            key="access_token",
            value=access_token,
            httponly=True,
            samesite="strict",
            max_age=240*3600,
            # secure=True
        )
        return {"status": "ok"}

    @app.post("/api/logout")
    def logout(response: Response):
        response.delete_cookie("access_token")
        return {"status": "ok"}

    @app.post("/api/file/upload")
    def upload_file(file: UploadFile = File(), url: str = Form(None), license: str = Form(None),
                    attribution: str = Form(None), user=Depends(Security.auth)):
        res = db.files.upload(file, user, url, license, attribution)
        return res

    @app.get("/api/file/{file_id}/download")
    def download_file(file_id: str):
        file = get_file(file_id)
        file_path = os.path.join(db.project_dir, "files", file.id)

        if not os.path.exists(file_path):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File does not exist on disk")

        media_type, _ = mimetypes.guess_type(file.id)
        return FileResponse(path=str(file_path), filename=file.id, media_type=media_type, content_disposition_type="inline")

    @app.get("/api/file/{file_id}")
    def get_file(file_id: str):
        file = db.files.get_file(file_id)
        if not file:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
        return file

    @app.post("/api/file/delete/{file_id}")
    def delete_file(file_id: str, user=Depends(Security.auth)):
        deleted = db.files.delete(file_id)
        return {"success": True} if deleted > 0 else {"success": False, "message": "File not found"}

    @app.post("/api/file/update/{file_id}")
    def file_update_metadata(file_id: str, request: UpdateFileRequest, user=Depends(Security.auth)):
        db.files.update_metadata(file_id, request.url, request.license, request.attribution)
        return {"success": True}

    @app.post("/api/task/save")
    def save_task(task: TaskDetails, user=Depends(Security.auth)):
        category = task.category
        allowed_types = CATEGORY_VERIFICATION_MAP.get(category)
        
        if allowed_types is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"detail": f"Invalid verification type for category '{category}'. Allowed types: {allowed_types}"}
            )
        
        for condition in task.conditions:
            condition_type = condition.type.value
            if condition_type not in allowed_types:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={"detail": f"Invalid verification type '{condition_type}' for category '{category}'. Allowed types: {allowed_types}"}
                )
        
        res = db.tasks.save(task, user)
        return res

    @app.post("/api/task/delete/{task_id}")
    def delete_task(task_id: str, user=Depends(Security.auth)):
        deleted = db.tasks.delete(task_id)
        return {"success": True} if deleted > 0 else {"success": False, "message": "Task not found"}

    @app.get("/api/task/{task_id}")
    def get_task(task_id: str, user=Depends(Security.auth)):
        task = db.tasks.get_task(task_id)
        if not task:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
        return task

    @app.post("/api/task/list")
    def get_tasks(request: SearchRequest, user=Depends(Security.auth)):
        res = db.tasks.get_tasks(request)
        return res

    @app.get("/api/stats/weekly")
    def get_weekly_stats(user=Depends(Security.auth)):
        return db.tasks.get_weekly_stats()

    @app.post("/api/model/save")
    def save_model(model: ModelDetailsAndProperties, user=Depends(Security.auth)):
        res = db.models.save(model.details, model.properties)
        evaluator.update_model(res.details)
        return res

    @app.get("/api/model/{model_id}")
    def get_model(model_id: str, user=Depends(Security.auth)):
        model = db.models.get_model(model_id)
        if not model:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Model not found")
        return model

    @app.put("/api/model/{model_id}")
    def update_model(model_id: str, model: ModelDetailsAndProperties, user=Depends(Security.auth)):
        res = db.models.update(model_id, model.details, model.properties)
        evaluator.update_models(db.models.get_models_details(SearchRequest()))
        return res

    @app.delete("/api/model/{model_id}")
    def delete_model(model_id: str, user=Depends(Security.auth)):
        deleted = db.models.delete(model_id)
        if deleted:
            evaluator.update_models(db.models.get_models_details(SearchRequest()))
            return {"success": True}
        else:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Model not found")

    @app.post("/api/model/list")
    def get_models(request: SearchRequest, user=Depends(Security.auth)):
        res = db.models.get_models(request)
        return res

    @app.post("/api/model/{model_id}/evaluate")
    def evaluate_task(model_id: str, task: TaskDetails, user=Depends(Security.auth)):
        result = evaluator.evaluate(model_id, task)
        return result

    @app.post("/api/evaluation/create")
    def create_evaluation(request: CreateEvaluationRequest, user=Depends(Security.auth)):
        try:
            AutoEvalModel.from_config(copy.deepcopy(request.model_configuration))
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid model configuration: {str(e)}")
        evaluation_id = db.evaluations.create_evaluation(
            name=request.name,
            model_configuration=request.model_configuration,
            categories=request.categories,
            user=user,
        )
        return db.evaluations.get_evaluation(evaluation_id)

    @app.get("/api/evaluation/list")
    def get_evaluations(page: int = 1, limit: int = 50, user=Depends(Security.auth)):
        return db.evaluations.get_evaluations(page, limit)

    @app.get("/api/evaluation/{evaluation_id}")
    def get_evaluation(evaluation_id: str, user=Depends(Security.auth)):
        evaluation = db.evaluations.get_evaluation(evaluation_id)
        if not evaluation:
            raise HTTPException(status_code=404, detail="Evaluation not found")
        return evaluation

    @app.post("/api/evaluation/{evaluation_id}/start")
    async def start_evaluation(evaluation_id: str,
                               request: Optional[StartEvaluationRequest] = None,
                               user=Depends(Security.auth)):
        evaluation = db.evaluations.get_evaluation(evaluation_id)
        if not evaluation:
            raise HTTPException(status_code=404, detail="Evaluation not found")
        reset = request.reset if request is not None else False
        try:
            await runner.start(evaluation_id, reset=reset)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        return {"status": "started"}

    @app.patch("/api/evaluation/{evaluation_id}/configuration")
    def update_evaluation_configuration(evaluation_id: str,
                                        request: UpdateEvaluationConfigurationRequest,
                                        user=Depends(Security.auth)):
        evaluation = db.evaluations.get_evaluation(evaluation_id)
        if not evaluation:
            raise HTTPException(status_code=404, detail="Evaluation not found")
        if evaluation["status"] not in INACTIVE_STATUSES:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot edit configuration of evaluation with status '{evaluation['status']}'",
            )
        try:
            AutoEvalModel.from_config(copy.deepcopy(request.model_configuration))
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid model configuration: {str(e)}")
        db.evaluations.update_evaluation(
            evaluation_id,
            model_configuration=json.dumps(request.model_configuration),
        )
        evaluation["model_configuration"] = request.model_configuration
        return evaluation

    @app.post("/api/evaluation/{evaluation_id}/cancel")
    def cancel_evaluation(evaluation_id: str, user=Depends(Security.auth)):
        if runner.active_evaluation_id != evaluation_id:
            raise HTTPException(status_code=400, detail="This evaluation is not currently running")
        runner.cancel()
        return {"status": "cancelled"}

    @app.get("/api/evaluation/{evaluation_id}/entries")
    def get_evaluation_entries(evaluation_id: str, page: int = 1, limit: int = 50,
                               user=Depends(Security.auth)):
        evaluation = db.evaluations.get_evaluation(evaluation_id)
        if not evaluation:
            raise HTTPException(status_code=404, detail="Evaluation not found")
        return db.evaluations.get_entries(evaluation_id, page, limit)

    @app.get("/api/evaluation/{evaluation_id}/entries/{entry_id}")
    def get_evaluation_entry(evaluation_id: str, entry_id: int, user=Depends(Security.auth)):
        entry = db.evaluations.get_entry(evaluation_id, entry_id)
        if not entry:
            raise HTTPException(status_code=404, detail="Entry not found")
        return entry

    @app.delete("/api/evaluation/{evaluation_id}")
    def delete_evaluation(evaluation_id: str, user=Depends(Security.auth)):
        if runner.active_evaluation_id == evaluation_id:
            raise HTTPException(status_code=400, detail="Cannot delete a running evaluation")
        deleted = db.evaluations.delete_evaluation(evaluation_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Evaluation not found")
        return {"success": True}

    @app.post("/api/evaluate")
    def evaluate_full(request: EvaluateRequest, user=Depends(Security.auth)):
        model, model_id = evaluator.get_model(request.model)
        post_processor = AutoPostProcessor.from_config(request.model)
        tasks = db.tasks.get_tasks(SearchRequest())
        task_details = [TaskDetails.model_validate(task.details) for task in tasks]
        consumer = FileEvalConsumer(request, task_details, model_id, args.project_dir)
        score_dict = evaluator.evaluate_full(model_id, model, post_processor, consumer)
        return score_dict

    @app.get("/api/dict/categories")
    def get_categories():
        return CATEGORIES

    @app.get("/api/dict/category-verifications")
    def get_category_verifications():
        return CATEGORY_VERIFICATION_MAP

    @app.get("/api/category/{category_name}/models")
    def get_models_for_category(category_name: str, user=Depends(Security.auth)):
        return db.models.models_for_category(category_name)

    @app.get("/api/tags")
    def get_tags_by_category(category: str, user=Depends(Security.auth)):
        return db.tasks.get_tags_by_category(category)

    @app.get("/api/tags/{task_id}")
    def get_all_tags(task_id: str, user=Depends(Security.auth)):
        return db.tasks.get_all_unique_tags(task_id)

    @app.get("/api/user/me")
    def get_current_user(user=Depends(Security.auth)):
        return {"username": user, "isAdmin": user == "admin"}

    @app.get("/api/admin/users")
    def list_users(user=Depends(Security.admin_auth)):
        users = db.users.get_users(SearchRequest())
        return [{"id": u.id, "username": u.username} for u in users]

    @app.post("/api/admin/users")
    def create_user(value: User, user=Depends(Security.admin_auth)):
        existing = db.users.get_user(value.username)
        if existing:
            raise HTTPException(status_code=409, detail="User already exists")
        value.password = Security.hash_password(value.password)
        res = db.users.save(value)
        return {"id": res.id, "username": res.username}

    @app.delete("/api/admin/users/{user_id}")
    def delete_user(user_id: int, user=Depends(Security.admin_auth)):
        target_user = db.users.get_user_by_id(user_id)
        if not target_user:
            raise HTTPException(status_code=404, detail="User not found")
        if target_user.username == "admin":
            raise HTTPException(status_code=400, detail="Cannot delete admin user")
        if db.saved_responses.count_by_user(user_id) > 0:
            raise HTTPException(status_code=409, detail="Cannot delete user with saved responses")
        db.users.delete_user(user_id)
        return {"success": True}

    @app.get("/api/admin/orphan-files")
    def scan_orphan_files(user=Depends(Security.admin_auth)):
        result = db.find_orphan_files()
        return {
            "orphanFiles": result["orphan_files"],
            "ghostRecords": result["ghost_records"],
            "orphanCount": len(result["orphan_files"]),
            "ghostCount": len(result["ghost_records"]),
        }

    @app.post("/api/admin/orphan-files/cleanup")
    def cleanup_orphan_files(user=Depends(Security.admin_auth)):
        result = db.delete_orphan_files()
        return {
            "deletedFiles": result["deleted_files"],
            "deletedRecords": result["deleted_records"],
        }

    @app.get("/api/admin/settings/lang")
    def get_lang_setting(user=Depends(Security.admin_auth)):
        return {"lang": default_lang()}

    @app.post("/api/admin/settings/lang")
    def set_lang_setting(request: LangRequest, user=Depends(Security.admin_auth)):
        allowed = {"pl", "en", "de", "fr"}
        if request.lang not in allowed:
            raise HTTPException(status_code=422, detail=f"lang must be one of: {', '.join(sorted(allowed))}")
        db.settings.set("default_lang", request.lang)
        set_default_lang(request.lang)
        return {"lang": request.lang}

    @app.post("/api/user/save")
    def save_user(value: User, user=Depends(Security.auth)):
        is_hash = re.match(r"^\$2[aby]?\$\d{2}\$[./A-Za-z0-9]{53}$", value.password)
        if not is_hash:
            value.password = Security.hash_password(value.password)
        res = db.users.save(value)
        return res

    @app.get("/api/project/export.zip")
    def get_current_user(user=Depends(Security.auth)):
        output_path = db.export_project()
        return FileResponse(path=output_path, filename="export.zip", media_type="application/zip")

    @app.get("/api/project/status")
    def project_status():
        return {"hasUsers": db.users.count() > 0}

    @app.post("/api/project/init")
    def project_init(value: User, response: Response):
        if db.users.count() > 0:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Project already initialized")
        if not value.password or len(value.password) < 8:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Password must be at least 8 characters")
        value.username = "admin"
        value.password = Security.hash_password(value.password)
        db.users.save(value)
        access_token = Security.create_token(data={"sub": "admin"})
        response.set_cookie(
            key="access_token",
            value=access_token,
            httponly=True,
            samesite="strict",
            max_age=240 * 3600,
        )
        return {"status": "ok"}

    @app.get("/api/ping")
    def ping(user=Depends(Security.auth)):
        return {"message": f"Hello {user}, you are authorized!"}

    @app.exception_handler(AssertionError)
    async def handle_exception(request: Request, exc: AssertionError):
        error = {"type": "assertion_error", "loc": ["body"], "msg": str(exc)}
        return JSONResponse(status_code=422, content={"detail": [error]})

    @app.post("/api/saved-response/save")
    def save_response(request: SavedResponseRequest, username: str = Depends(Security.auth)):
        user = db.users.get_user(username)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        response = db.saved_responses.save(
            task_id=request.task_id,
            model_id=request.model_id,
            answer=request.answer,
            scores=request.scores,
            user_id=user.id
        )
        return response

    @app.post("/api/saved-response/save-batch")
    def save_responses_batch(requests: list[SavedResponseRequest], username: str = Depends(Security.auth)):
        user = db.users.get_user(username)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        responses = []
        for request in requests:
            response = db.saved_responses.save(
                task_id=request.task_id,
                model_id=request.model_id,
                answer=request.answer,
                scores=request.scores,
                user_id=user.id
            )
            responses.append(response)
        return responses

    @app.get("/api/saved-response/task/{task_id}")
    def get_saved_responses_for_task(task_id: str, username: str = Depends(Security.auth)):
        responses = db.saved_responses.get_all_for_task(task_id)
        return responses

    @app.get("/api/saved-response/task/{task_id}/model/{model_id}")
    def get_saved_response(task_id: str, model_id: str, username: str = Depends(Security.auth)):
        response = db.saved_responses.get_by_task_and_model(task_id, model_id)
        if not response:
            raise HTTPException(status_code=404, detail="Response not found")
        return response

    @app.delete("/api/saved-response/task/{task_id}")
    def delete_saved_responses(task_id: str, username: str = Depends(Security.auth)):
        deleted_count = db.saved_responses.delete_for_task(task_id)
        return {"success": True, "deleted_count": deleted_count}


    if os.path.exists(os.path.join("client/dist")):
        build_files = StaticFiles(directory=os.path.join("client/dist"), html=True)
        app.mount("/", build_files, name="static")

        @app.exception_handler(404)
        def any_path(request: Request, exc):
            if request.url.path.startswith("/api/"):
                detail = exc.detail if isinstance(exc, HTTPException) else "Not Found"
                return JSONResponse(status_code=404, content={"detail": detail})
            return FileResponse(os.path.join("client/dist", "index.html"))

    return app, args, scheduler


if __name__ == '__main__':
    logging.basicConfig(format='%(asctime)s : %(message)s', level=logging.INFO)
    logging.root.setLevel(logging.INFO)
    fastapi_app, fastapi_args, backup_scheduler = create_app()
    
    def signal_handler(signum, frame):
        backup_scheduler.stop()
        raise SystemExit(0)
    
    signal.signal(signal.SIGTERM, signal_handler)
    signal.signal(signal.SIGINT, signal_handler)
    
    uvicorn.run(fastapi_app, host=fastapi_args.host, port=fastapi_args.port)
