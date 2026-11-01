@echo off
cd /d "%~dp0"
title GameVault - Crear instalador
echo.
echo GameVault - Crear instalador .exe
echo ==================================
echo Esto puede tardar 3-5 minutos...
echo.

echo Limpiando cache de electron-builder...
if exist "%LOCALAPPDATA%\electron-builder\Cache\winCodeSign" (
    rmdir /s /q "%LOCALAPPDATA%\electron-builder\Cache\winCodeSign" 2>nul
    echo Cache eliminada.
)

echo.
if exist "dist\" rmdir /s /q dist 2>nul
call npm run pack-win
echo.
if %errorlevel% neq 0 (
    echo ERROR: La compilacion fallo.
    echo Si ves error de symlinks ejecuta este bat como Administrador.
) else (
    echo OK: Instalador creado en dist\
    explorer dist\
)
echo.
pause
