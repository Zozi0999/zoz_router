@echo off
title ZOZ ROUTER - AI Multi-Engine Gateway
color 0B
cls
echo ================================================================
echo    ⚡ ZOZ ROUTER - NEURAL AI MULTI-ENGINE GATEWAY ⚡
echo             Ollama (Local) + OpenRouter (Cloud)
echo ================================================================
echo.
echo [1/3] Memeriksa dan menjalankan service Ollama di latar belakang...
powershell -Command "if (-not (Get-Process -Name 'ollama' -ErrorAction SilentlyContinue)) { Start-Process 'ollama' -ArgumentList 'serve' -WindowStyle Hidden }"

echo [2/3] Memulai Server Zoz Router pada port 4040...
start "" http://localhost:4040
echo [3/3] Menjalankan core server Node.js...
node server.js
pause
