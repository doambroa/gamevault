@echo off
rem Abre la app con recarga automatica al guardar cambios en el codigo (para programar)
cd /d "%~dp0.."
title GameVault - Modo desarrollo
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
call npm run electron-dev
exit /b 0
:error
pause
exit /b 1
