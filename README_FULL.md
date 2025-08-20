## README (vollständig)

### Inhalt
- Überblick
- Installation
- Betrieb
- API Highlights
- Sicherheit
- Frontend

### Überblick
- Zweck: Persönliches Finanz‑Dashboard mit Admin‑Verwaltung
- Architektur: FastAPI + SQLModel + SQLite; Vite/React/TS Frontend
- Auth: OAuth2 Password Flow, JWT; Rollen: Admin, Nutzer
- Daten: Transaktionen, Kategorien, CSV Import/Export, Statistiken
- Seeding: Monatsdaten ab 2020 für mehrere Benutzer

### Installation
- Backend: siehe `new/backend/README.md`
- Frontend: siehe `new/frontend/README.md`

### Betrieb
- Backend: uvicorn app.main:app --reload (siehe Backend‑README)
- Frontend: npm run dev (siehe Frontend‑README)

### API Highlights
- POST /token – Login
- /api/transactions – CRUD
- /api/transactions/import | /export – CSV
- GET /api/stats/monthly-category – Statistik (year=YYYY)
- /api/admin/users – Admin
- POST /api/seed-demo-data – Seeding

### Sicherheit
- Admins sind von Finanzendpunkten ausgeschlossen
- Passwort‑Hashing (bcrypt), JWT

### Frontend
- Admin‑Panel (User CRUD, Passwort ändern, Self‑Delete‑Schutz)
- CSV‑Import mit Mapping und Duplikat‑Schutz
- Chart mit Jahrfilter
```
cd new\backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
set SECRET_KEY=devsecret
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Frontend
```
cd new\frontend
npm install
npm run dev
```

Seeding
- POST /api/seed-demo-data als regulärer Nutzer (Admins sind ausgeschlossen) oder automatisch beim ersten Start via Hilfsfunktionen.

Admin
- Standard: admin / admin123
- Endpunkte: /api/admin/users (GET/POST/PATCH/DELETE)
- Admin kann sein eigenes Konto nicht löschen; Passwortänderung via PATCH.
