@echo off
cd /d "%~dp0"
python sar_accel_app.py
if errorlevel 1 pause
