@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
title Marina — Kurulum / Guncelleme

call "%~dp0_npm-setup.bat"
if not defined NPM (
    echo [Hata] Node.js bulunamadi.
    pause
    exit /b 1
)

echo npm install...
call "%NPM%" install
if errorlevel 1 goto fail

echo npm run build...
call "%NPM%" run build
if errorlevel 1 goto fail

echo.
echo Tamam. Simdi Marina-Nargile-Baslat.bat ile acabilirsiniz.
pause
exit /b 0

:fail
echo [Hata] Kurulum basarisiz.
pause
exit /b 1
