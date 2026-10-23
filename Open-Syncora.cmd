@echo off
cd /d "%~dp0"
title Syncora
if not exist "apps\web\dist\index.html" (
  where npm >nul 2>nul
  if errorlevel 1 (
    echo The app UI is missing. Build it once with Node.js, then open this file again.
    pause
    exit /b 1
  )
  echo Preparing Syncora...
  call npm --prefix apps\web run build
  if errorlevel 1 (
    echo Could not build Syncora.
    pause
    exit /b 1
  )
)
if not exist ".venv\Scripts\python.exe" (
  where python >nul 2>nul
  if errorlevel 1 (
    echo Python is required on this computer. Install Python 3.11+, then open this file again.
    pause
    exit /b 1
  )
  echo Setting up Syncora for this computer...
  python -m venv .venv
  if errorlevel 1 (
    echo Could not create the Python environment.
    pause
    exit /b 1
  )
  .venv\Scripts\python.exe -m pip install -r apps\api\requirements.txt
  if errorlevel 1 (
    echo Could not install Syncora.
    pause
    exit /b 1
  )
)
.venv\Scripts\python.exe -c "import webview" 2>nul
if errorlevel 1 .venv\Scripts\python.exe -m pip install -q pywebview
if exist ".venv\Scripts\pythonw.exe" (
  start "" "%~dp0.venv\Scripts\pythonw.exe" "%~dp0apps\desktop\launch.py"
  exit /b 0
)
.venv\Scripts\python.exe apps\desktop\launch.py
