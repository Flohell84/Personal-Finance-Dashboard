## Backend (FastAPI)

FastAPI‑App für Auth, Transaktionen, CSV, Statistiken und Admin‑API (SQLModel + SQLite).

### Quickstart (Windows, cmd)
```cmd
cd new\backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
set SECRET_KEY=devsecret
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### Auth
- OAuth2 Password Flow (JWT)
- POST /api/auth/token, GET /api/auth/me

### Transaktionen (nur reguläre Nutzer)
- POST /api/transactions
- GET /api/transactions (Filter: q, category, min_amount, max_amount, from_date, to_date)
- PATCH /api/transactions/{id}
- DELETE /api/transactions/{id}
- POST /api/transactions/import (CSV, Duplikat‑Schutz)
- GET /api/transactions/export (CSV)

### Statistiken
- GET /api/stats/monthly-category?year=YYYY

### Admin
- GET/POST/PATCH/DELETE /api/admin/users
- Selbstlöschung blockiert; Passwortänderung via PATCH { password }

### Seeding
- POST /api/seed-demo-data (reguläre Nutzer)

### Datenbank
- SQLite‑Datei `finance.db`
