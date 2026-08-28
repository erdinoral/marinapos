@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

title Marina Nargile Web

call "%~dp0_npm-setup.bat"
if not defined NPM (
    echo [Hata] Node.js / npm bulunamadi. Node.js LTS kurun:
    echo https://nodejs.org/
    pause
    exit /b 1
)

if not exist "%~dp0marina web site\package.json" (
    echo [Hata] "marina web site" klasoru bulunamadi.
    pause
    exit /b 1
)

cd /d "%~dp0marina web site"

if not exist "node_modules\" (
    echo Bagimliliklar yukleniyor ^(bir kez^)...
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
echo Bu pencereyi kapatirsaniz site de kapanir.
echo.

start "" cmd /c "timeout /t 3 /nobreak >nul & start http://localhost:5174/"

call "%NPM%" run dev

echo.
if errorlevel 1 (
    echo [Hata] Web sunucusu baslamadi.
    echo NPM sorunu icin Marina-NPM-Konsol.bat acin.
    pause
)

endlocal
