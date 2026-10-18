@echo off
title ZOZ ROUTER - AI Multi-Engine Gateway
color 0B
cls
echo ================================================================
echo    ⚡ ZOZ ROUTER - NEURAL AI MULTI-ENGINE GATEWAY ⚡
echo             Ollama (Local) + OpenRouter (Cloud)
echo ================================================================
echo.
set ZOX_ALLOW_CROSS_ORIGIN=1

echo [1/4] Memeriksa dan menjalankan service Ollama di latar belakang...
powershell -Command "if (-not (Get-Process -Name 'ollama' -ErrorAction SilentlyContinue)) { Start-Process 'ollama' -ArgumentList 'serve' -WindowStyle Hidden }"

echo [2/4] Memeriksa dan menjalankan Cloudflare Tunnel independen di latar belakang...
powershell -Command "if (-not (Get-Process -Name 'cloudflared' -ErrorAction SilentlyContinue)) { if (Test-Path 'bin\cloudflared.exe') { Start-Process 'bin\cloudflared.exe' -ArgumentList 'tunnel --url http://localhost:4040 --no-autoupdate --logfile data\cloudflared-service.log' -WindowStyle Hidden } }"

echo [3/4] Memulai Web UI Zoz Router pada port 4040...
start "" http://localhost:4040
echo [4/4] Menjalankan core server Node.js...
node server.js
pause

