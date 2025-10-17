# SmartChange FYP – Chatbot Service

🤖 **Project Overview**

The Chatbot Service powers SmartChange's AI assistant — enabling document-based Q&A, RAG (Retrieval-Augmented Generation), and interactive chat sessions between users and the AI. It connects to two databases:

* **Chatbot DB** – Stores chat sessions, chat messages, and user context.
* **Chunk DB** – Stores document chunks and embeddings for retrieval.

---

## 📂 Project Structure

```
Backend/
├── services/
│   └── chatbot/
│       ├── app/
│       │   ├── core/           # Config (loads .env, settings)
│       │   ├── deps/           # DB dependencies (chatbot + chunk DB)
│       │   ├── models/         # ChatHead, ChatMessage models
│       │   ├── routers/        # API endpoints (chat routes)
│       │   ├── schemas/        # Pydantic schemas for API requests
│       │   ├── services/       # Core logic (chat_service, agent_service)
│       │   ├── tools/          # RAG + LLM tools if needed
│       │   └── main.py         # FastAPI entrypoint
│       ├── .env                # Environment variables for this service
│       └── requirements.txt    # Python dependencies
├── shared/                     # Common models/schemas used across services
│   ├── models/
│   ├── schemas/
│   ├── core/
│   └── __init__.py
├── setup.py                    # Allows shared/ to be installed as a package
└── venv/                       # Local virtual environment
```

---

## ⚙️ Setup Instructions

### 1. Clone the Repo

```bash
git clone <your-repo-url>
cd Backend
```

### 2. Create Virtual Environment

```bash
python -m venv venv
```

**Activate venv:**

**Windows (PowerShell):**
```bash
venv\Scripts\activate
```

**Linux/Mac/WSL:**
```bash
source venv/bin/activate
```

### 3. Install Requirements

```bash
pip install -r requirements.txt
```

### 4. Install Shared Package

```bash
pip install -e .
```

This makes the `shared/` folder importable from anywhere.

### 5. Navigate to Chatbot Service

```bash
cd services/chatbot
```

### 6. Configure `.env`

Create a `.env` file inside `services/chatbot/`:

```env
CHATBOT_DATABASE_URL=postgresql+psycopg2://<user>:<password>@<host>/<chatbot_db>
CHUNK_DATABASE_URL=postgresql+psycopg2://<user>:<password>@<host>/<chunk_db>
GOOGLE_API_KEY=<your_google_api_key>
LLM_MODEL=gemini-2.5-flash
DEBUG=true
```

---

## 🚀 Run the Chatbot API

From inside `services/chatbot`:

```bash
uvicorn app.main:app --reload --port 8001
```

**Open:** [http://localhost:8001/docs](http://localhost:8001/docs)

---

## 📝 Additional Notes

- Ensure both PostgreSQL databases (Chatbot DB and Chunk DB) are running and accessible
- The API documentation is available via FastAPI's auto-generated Swagger UI at `/docs`
- Use `--reload` flag during development for auto-reloading on code changes
- The service runs on port `8001` by default to avoid conflicts with other services