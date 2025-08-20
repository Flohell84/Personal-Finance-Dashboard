@echo off
REM Starte Backend (Uvicorn) und Frontend (Vite) parallel
cd /d %~dp0new\backend
start cmd /k "uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
cd /d %~dp0new\frontend
start cmd /k "npm run dev"
cd /d %~dp0
