@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
title Marina NPM Konsol

call "%~dp0_npm-setup.bat"
if not defined NPM (
    echo [Hata] Node.js / npm bulunamadi.
    echo https://nodejs.org/ adresinden LTS kurun.
    pause
    exit /b 1
)

echo.
echo Marina Nargile — NPM konsolu
echo.
echo PowerShell'de "npm" calismiyorsa burada veya su sekilde kullanin:
echo   npm.cmd install
echo   .\npm.bat install
echo.
echo Ornek komutlar:
echo   npm run start          — uygulamayi ac
echo   npm run build          — yeniden derle
echo   npm run start:fresh    — build + ac
echo.
echo Konsol acildi. Bu pencerede "npm" yerine asagidaki tam yol da calisir:
echo   "%NPM%"
echo.

cmd /k "cd /d "%~dp0" & set PATH=C:\Program Files\nodejs;%PATH%"

endlocal
