# SmartChange FYP – Management Service

## 📌 Project Overview

SmartChange is a role-based Learning & SOP Management Platform with AI features (chatbot, summarization, quiz generator).  
This repository contains the **Management Service** (Employee/Manager/Admin core backend).

---

## 📂 Project Structure

```
Backend/
├── services/
│   └── management/
│       ├── app/
│       │   ├── core/           # Config (loads .env, settings)
│       │   ├── deps/           # Dependencies (DB session, init_db)
│       │   ├── models/         # (Local models if needed)
│       │   ├── routers/        # API endpoints (users, auth, content, health)
│       │   ├── schemas/        # (Local schemas if needed)
│       │   └── main.py         # FastAPI entrypoint
│       ├── .env                # Service-specific environment variables
│       └── requirements.txt    # Python dependencies for this service
├── shared/                     # Shared models/schemas used across services
│   ├── models/
│   ├── schemas/
│   ├── core/
│   └── __init__.py
├── setup.py                    # Makes shared/ installable as a package
└── venv/                       # Local virtual environment (ignored by git)
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

### 3. Install shared as a package

```bash
pip install -e .
```

This makes the `shared/` folder importable from anywhere.

### 4. Install Dependencies for Management Service

```bash
cd services/management
pip install -r requirements.txt
```

### 5. Configure .env

Create a `.env` in `services/management/`:

```env
DATABASE_URL=postgresql+psycopg2://<user>:<password>@<host>/<db>
```

### 6. Run the Management API

From inside `services/management/`:

```bash
uvicorn app.main:app --reload --port 8001
```

**Open:** http://localhost:8000

---

## 🔧 Development


### Adding New Features

1. Create models in `app/models/` or `shared/models/`
2. Define schemas in `app/schemas/` or `shared/schemas/`
3. Implement API endpoints in `app/routers/`
4. Update dependencies in `app/deps/` if needed

---

## 🧪 Testing


---

## 📝 Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql+psycopg2://user:pass@localhost/db` |


---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

This project is part of a Final Year Project (FYP) for academic purposes.

---

## 👥 Team

- **Project Type:** Final Year Project (FYP)
- **Domain:** Learning & SOP Management Platform
- **Technology Stack:** FastAPI, PostgreSQL, AI Integration

---

## 🆘 Troubleshooting

### Common Issues

1. **Import Error for shared package:**
   ```bash
   pip install -e .  # From Backend/ directory
   ```

2. **Database Connection Error:**
   - Check your PostgreSQL server is running
   - Verify DATABASE_URL in .env file
   - Ensure database exists

3. **Port Already in Use:**
   ```bash
   uvicorn app.main:app --reload --port 8001  # Use different port
   ```

### Getting Help

- Check the API documentation at `/docs`
- Review error logs in the console
- Ensure all environment variables are properly set




docker run -d --name redis -p 6379:6379 redis:7-alpine
python -m processing_worker.app.main_rq