# Personal Finance Dashboard

![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?logo=fastapi&logoColor=white) ![React](https://img.shields.io/badge/React-18-61dafb?logo=react&logoColor=061a23) ![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white)

Modernes Finanz‑Dashboard mit FastAPI (Backend) und Vite/React/TypeScript (Frontend). Unterstützt Auth (JWT), mehrbenutzerfähige Transaktionen, CSV‑Import/Export, Auswertungen sowie eine Admin‑Konsole zur Nutzerverwaltung.

Kurzübersicht
- 🔐 Authentifizierung (JWT, OAuth2 Password Flow)
- 👥 Rollen: Admin vs. reguläre Nutzer (Admins von Finanzendpunkten ausgeschlossen)
- 💸 Transaktionen: Anlegen, Listen, Bearbeiten, Löschen
- 📥📤 CSV‑Import mit Feldzuordnung und Duplikat‑Schutz; CSV‑Export
- 📊 Statistiken: Summen pro Monat/Kategorie, Jahrfilter
- 🌱 Demo‑Daten Seeding ab 2020 (mehrere Nutzer)
- 🛠️ Admin‑Konsole: Nutzer CRUD, Passwort ändern, Self‑Delete‑Schutz
- 🌗 Dark/Light‑Mode, responsive UI

Quick Links
- Backend Doku: `new/backend/README.md`
- Frontend Doku: `new/frontend/README.md`
- Vollüberblick: `new/README_FULL.md`

Tech‑Stack
- Backend: FastAPI, SQLModel, SQLite, passlib[bcrypt], jose (JWT)
- Frontend: React, TypeScript, Vite

Schnellstart (Windows, cmd)
Backend
```cmd
cd new\backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
set SECRET_KEY=devsecret
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Frontend
```cmd
cd new\frontend
npm install
npm run dev
```

Standard‑Admin: Benutzer „admin“, Passwort „admin123“.

Struktur
```
new/
	backend/        # FastAPI App, Auth, Admin‑API, Seeding
	frontend/       # Vite/React/TS UI
	README*.md      # Doku
```
