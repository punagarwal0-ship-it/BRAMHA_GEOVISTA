@echo off
set "PATH=%PATH%;C:\Users\Rudra\AppData\Local\Programs\NodeJS\node-v20.18.0-win-x64;C:\Users\Rudra\AppData\Local\Programs\Git\cmd"
cd /d "%~dp0"
echo Starting GEOVISTA Hallmark Earth Observation Platform...
npm run dev -- --host --port 3001
pause

