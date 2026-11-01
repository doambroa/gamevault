@echo off
cd /d "%~dp0"
title GameVault - Instalador
echo.
echo GameVault - Instalador
echo ======================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: Node.js no esta instalado.
    echo.
    echo Descargalo desde: https://nodejs.org
    echo Elige la version LTS.
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node --version') do echo Node.js %%v encontrado
echo.
echo Instalando dependencias...
echo.
call npm install
echo.
echo Resultado: %errorlevel%
echo.
if %errorlevel% neq 0 (
    echo ERROR: La instalacion fallo. Ver mensajes arriba.
) else (
    echo Instalacion OK. Ahora ejecuta 2-EJECUTAR.bat
)
echo.
pause
