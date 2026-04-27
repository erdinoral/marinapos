@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

title Marina Nargile POS

where npm >nul 2>nul
if errorlevel 1 (
    echo [Hata] npm bulunamadi. Node.js LTS kurun ve yeniden deneyin.
    echo https://nodejs.org/
    pause
    exit /b 1
)

if not exist "node_modules\" (
    echo Bagimliliklar yukleniyor ^(bir kez^)...
    call npm install
    if errorlevel 1 (
        echo [Hata] npm install basarisiz.
        pause
        exit /b 1
    )
)

echo.
echo Marina Nargile: Vite + Electron aciliyor. Bu pencereyi kapatirsaniz uygulama da kapanir.
echo.
call npm run dev

echo.
if errorlevel 1 (
    echo [Hata] Baslatma sirasinda sorun olustu.
    pause
)

endlocal
