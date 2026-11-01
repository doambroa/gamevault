@echo off
rem Genera dist\GameVault-Setup-x.y.z.exe (tarda unos minutos)
cd /d "%~dp0.."
title GameVault - Crear instalador
rem --- Node.js: si no esta, se instala solo con winget ---
for %%X in (node.exe) do if not "%%~$PATH:X"=="" goto :hay_node
if exist "%ProgramFiles%\nodejs\node.exe" goto :node_pf
echo.
echo  GameVault necesita Node.js para funcionar desde el codigo.
echo  Lo instalo ahora (Windows puede pedirte permiso una vez)...
echo.
for %%X in (winget.exe) do if "%%~$PATH:X"=="" goto :sin_node
winget install -e --id OpenJS.NodeJS.LTS --silent --accept-source-agreements --accept-package-agreements
if exist "%ProgramFiles%\nodejs\node.exe" goto :node_pf
:sin_node
echo.
echo  No he podido instalar Node.js automaticamente.
echo  Instala la version LTS desde https://nodejs.org y vuelve a abrir este fichero,
echo  o descarga el instalador de GameVault, que no necesita nada mas:
echo  https://github.com/doambroa/gamevault/releases/latest
start "" "https://github.com/doambroa/gamevault/releases/latest"
echo.
pause
exit /b 1
:node_pf
set "PATH=%ProgramFiles%\nodejs;%PATH%"
:hay_node
node scripts\lanzar.js --solo-deps || goto :error
if exist "%LOCALAPPDATA%\electron-builder\Cache\winCodeSign" rmdir /s /q "%LOCALAPPDATA%\electron-builder\Cache\winCodeSign" 2>nul
if exist "dist\" rmdir /s /q dist 2>nul
call npm run pack-win || goto :error
echo.
echo  OK: instalador creado en la carpeta dist
explorer dist
pause
exit /b 0
:error
echo.
echo  ERROR: no se pudo crear el instalador. Revisa los mensajes de arriba.
echo  Si habla de "symlinks", abre este fichero como Administrador.
pause
exit /b 1
