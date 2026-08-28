@echo off
rem Proje .bat dosyalari icin npm/npx tam yolu (PowerShell npm.ps1 engelini atlar)
set "NPM="
set "NPX="
set "NODE_DIR=C:\Program Files\nodejs"
if exist "%NODE_DIR%\npm.cmd" (
  set "NPM=%NODE_DIR%\npm.cmd"
  set "NPX=%NODE_DIR%\npx.cmd"
  set "PATH=%NODE_DIR%;%PATH%"
  exit /b 0
)
where npm.cmd >nul 2>nul
if not errorlevel 1 (
  for /f "delims=" %%I in ('where npm.cmd 2^>nul') do (
    set "NPM=%%I"
    goto :npx_find
  )
)
where npm >nul 2>nul
if not errorlevel 1 set "NPM=npm"
if not defined NPM exit /b 1
:npx_find
where npx.cmd >nul 2>nul
if not errorlevel 1 (
  for /f "delims=" %%I in ('where npx.cmd 2^>nul') do (
    set "NPX=%%I"
    exit /b 0
  )
)
if exist "%NODE_DIR%\npx.cmd" set "NPX=%NODE_DIR%\npx.cmd"
exit /b 0
