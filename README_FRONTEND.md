## Frontend (Vite/React/TypeScript)

Siehe detailliert `new/frontend/README.md`. Kurzfassung:

### Entwicklung
```cmd
cd new\frontend
npm install
npm run dev
```

### Build & Preview
```cmd
npm run build
npm run preview
```

### Hinweise
- Backend standardmäßig: http://127.0.0.1:8000 (API unter /api/*)
- Admin‑Ansicht nur für Nutzer mit is_admin=true
- CSV‑Import erwartet UTF‑8 kodierte .csv Dateien
