@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

title Marina Nargile Web

if exist "%~dp0..\Marina-Web-Baslat.bat" (
    call "%~dp0..\Marina-Web-Baslat.bat"
    exit /b %ERRORLEVEL%
)

REM Dogudan bu klasorden calistirilirsa:
if exist "%~dp0..\_npm-setup.bat" (
    call "%~dp0..\_npm-setup.bat"
) else (
    where npm.cmd >nul 2>nul
    if errorlevel 1 (
        echo [Hata] Node.js / npm bulunamadi.
        pause
        exit /b 1
    )
    set "NPM=npm.cmd"
)

if not defined NPM (
    echo [Hata] Node.js / npm bulunamadi.
    pause
    exit /b 1
)

if not exist "node_modules\" (
    echo Bagimliliklar yukleniyor...
    call "%NPM%" install
    if errorlevel 1 (
        echo [Hata] npm install basarisiz.
        pause
        exit /b 1
    )
)

echo.
echo Marina Nargile Web aciliyor...
echo Adres: http://localhost:5174
echo.

start "" cmd /c "timeout /t 3 /nobreak >nul & start http://localhost:5174/"
call "%NPM%" run dev
pause
endlocal
