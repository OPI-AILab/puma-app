# Platform for Unified Model Assessment (PUMA)

PUMA is an advanced client-server system designed for the automation, management, and qualitative/quantitative evaluation of artificial intelligence models (both LLMs and specialized models). The application supports three primary data processing scenarios: Automatic Speech Recognition (ASR), Optical Character Recognition (OCR), and Structured Data Extraction.

---

## 1. Core System Features

* **Task Management (Tasks):** Creation of evaluation benchmarks (datasets) categorized into specific types such as `ASR`, `OCR`, or `Structured extraction`.
* **Automated Rule Validation:** Dynamic server-side verification of success constraints (Verification Conditions) tailored to the specific context of the selected task category.
* **Multilingual Capabilities:** Pre-configured system instructions supporting 9 distinct languages: Polish (pl), English (en), German (de), French (fr), Dutch (nl), Portuguese (pt), Spanish (es), Italian (it), and Russian (ru). These prompts enforce precise structural outputs (e.g., full words for digits in ASR, HTML formatted tables in OCR) without conversational fluff from the target model.
* **Asynchronous Evaluation (Evaluation Runner):** An execution engine capable of launching bulk test suites, tracking progress live, handling manual cancellations, and supporting hot-swapping of model configuration attributes.
* **Log Intelligence and Imports:** A utility allowing users to import historical operational logs in `.jsonl` (JSON Lines) format, complete with paginated record browsing and deep diagnostic analysis.
* **Administration & Security:** 
  * Session authorization secured by signed JWT tokens delivered using protected browser cookies (`HttpOnly`, `SameSite=Strict`).
  * Administrator settings portal for managing user accounts (RBAC) and configuring the default system language.
  * Automated background backup routine (Backup Scheduler).
* **Workspace Export:** Ability to extract the entire project space (the database engine along with all hosted attachments) as a unified ZIP archive through a dedicated API interface.

---

## 2. Architecture and Technology Stack

* **Backend:** FastAPI (Python), SQLModel / SQLAlchemy, Uvicorn, Python-Jose (JWT), Passlib/Bcrypt.
* **Frontend:** Angular (TypeScript), TailwindCSS / PostCSS.
* **Database and Storage:** SQLite via SQLAlchemy for schema data, native file system for attachment management.

---

## 3. Installation and Setup

### Prerequisites
* Python 3.11 or higher
* Node.js & npm (if manual frontend compilation is required)

### Backend Environment Installation
1. Clone the project repository.
2. Install all third-party package criteria outlined inside `requirements.txt`:
   ```bash
   pip install -r requirements.txt
   ```
3. Prior to initial execution, verify that migration scripts (e.g., `migrations.sql`) and the instruction asset bundle (`prompts.json`) exist within the root working path.

### Bootstrapping the Server Application
The application layer is started by executing the `run_server.py` utility. Behavior can be tailored through command-line flags:

```bash
python run_server.py --host 0.0.0.0 --port 8080 --project_dir _project --prompts_file prompts.json
```

**Available Settings (CLI):**
* `--host` (str): Network binding target IP for incoming connections (default: `0.0.0.0`).
* `--port` (int): Active web port allocation (default: `8080`).
* `--project_dir` (str): Targeted workspace path used to write out SQLite databases and save down source data uploads (default: `_project`).
* `--jwt_secret` (str): Private structural key used to encrypt user session signatures.
* `--prompts_file` (str): Relative location of the core multi-language prompt matrix (default: `prompts.json`).
* `--log_sql` (bool): Toggle for auditing all database transactions directly in the process output stream (default: `False`).

---

## 4. User Manual and Operational Flow

### 4.1. Initialization of the System Environment
Upon initial boot, the engine validates the persistence engine against registered users. If the state engine is completely unassigned, the platform initiates setup mode:
1. Direct your browser to the web platform. You will be prompted to allocate a root password for the explicit super-user role (`admin`).
2. The user credentials require a passphrase length of **at least 8 characters**.
3. Following a successful initialization, the onboarding service block becomes permanently closed off from the router stack, preventing unauthenticated system state overwrites.

### 4.2. Login and Session Context
* Users authenticate by submitting their valid username and password profile via the secure login portal.
* Successful validations return an encrypted JWT cookie tagged `access_token`. This token is distributed with strict security policies (`HttpOnly` and `SameSite=Strict`) ensuring script injection workflows cannot hijack active identities (XSS mitigation).
* Invoking a session logout completely wipes out the token entry and flushes out the browser cookie storage.

### 4.3. Benchmark Task Management (Tasks)
1. Navigate directly to the **Tasks** workspace panel and select the action to include a new task descriptor.
2. Group the benchmark case into one of the structural categories (`ASR`, `OCR`, `Structured extraction`).
3. Detail your specific target evaluation rules (**Verification Conditions**). The web controller enforces checks ensuring input metrics matching the strict rule sets available for that segment.
4. Upload your asset dependencies (e.g., an audio recording for speech or an image file/PDF for text extraction). The asset layer is saved cleanly under the `files` subdirectory of your configured project root path (e.g., `_project/files/`). You can also append attribution logs, reference URLs, and license restrictions.

### 4.4. Model Management (Models)
1. Under the **Models** panel view, you can easily parameterize new inference points (e.g., reference ID, temperature thresholds, response bounds, and authorization keys).
2. Applying additions or edits triggers an immediate real-time backend updates to the localized `TaskEvaluator` instance.
3. The schema manager blocks model removals if they are locked into saved historical entries or linked into active queues.

### 4.5. Running Evaluation Processes
1. Access the **Evaluations** panel and use **Create Evaluation** to set up a run instance with a dedicated name, target model, and evaluation categories.
2. Press **Start** to spawn an isolated asynchronous test thread. The `EvaluationRunner` continuously flows questions down the model pipeline, validating structural conditions via matching criteria from the selected language config (e.g., strings loaded via `prompts.json`).
3. You can review metrics live as they are processed or explicitly invoke a process halt by clicking **Cancel**.
4. Run modifications are locked if a test is ongoing; editing configurations can only occur if an evaluation suite is in an *inactive* state.
5. If an unexpected exception brings down an active calculation, the runtime engine captures the failed state by tracking the task index inside the `error_task_id` database field to support tracking down data anomalies.

### 4.6. Logs Audit and Ingestion (Log Intelligence)
The suite supports direct audit processes for offline logging scenarios:
1. Select the **Import Logs** workflow option from your control bar.
2. Upload your file payload matching the `.jsonl` specification. Each row string is processed strictly as an independent, fully realized JSON document.
3. Successful imports yield a trackable `import_id` parameter. Data lists can be examined smoothly through a paginated interface, searched down by unique entity IDs, or deleted instantly from storage tables.

### 4.7. Full Project Environment Export
At any production point, authenticated operators can download their entire application layout state. Invoking the package export request builds an on-the-fly zip archive mapping current databases alongside attached media assets, returning an `export.zip` container stream right back into your local downloads storage folder.