@echo off
title Ramiarz Master — Backend (FastAPI :8000)
cd /d D:\DEV\APLIKACJE\ramiarz-master\backend
call venv\Scripts\activate
echo.
echo  ===================================
echo   Ramiarz Master — Backend
echo   http://localhost:8000
echo   http://localhost:8000/docs
echo  ===================================
echo.
uvicorn app.main:app --reload --port 8000 --log-level info
pause
