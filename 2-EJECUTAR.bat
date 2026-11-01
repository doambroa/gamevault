@echo off
cd /d "%~dp0"
title GameVault
echo.
if not exist "node_modules\" (
    echo ERROR: Ejecuta primero 1-INSTALAR.bat
    echo.
    pause
    exit /b 1
)
echo Iniciando GameVault...
echo.
call npm run electron-dev
pause
