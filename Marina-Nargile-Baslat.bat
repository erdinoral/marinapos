@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

title Marina Nargile POS

call "%~dp0_npm-setup.bat"
if not defined NPM (
    echo [Hata] Node.js / npm bulunamadi. Node.js LTS kurun:
    echo https://nodejs.org/
    pause
    exit /b 1
)

if not exist "node_modules\qrcode\" (
    echo Eksik paketler yukleniyor...
    call "%NPM%" install
    if errorlevel 1 (
        echo [Hata] npm install basarisiz.
        pause
        exit /b 1
    )
)

if not exist "node_modules\" (
    echo Bagimliliklar yukleniyor ^(bir kez^)...
    call "%NPM%" install
    if errorlevel 1 (
        echo [Hata] npm install basarisiz.
        pause
        exit /b 1
    )
)

if not exist "dist\index.html" (
    echo Ilk acilis veya eksik build: uygulama derleniyor ^(1-3 dk^)...
    call "%NPM%" run build
    if errorlevel 1 (
        echo [Hata] Build basarisiz.
        pause
        exit /b 1
    )
) else (
    call "%NPM%" exec -- tsc -p tsconfig.electron.json >nul 2>nul
    call "%NPM%" run electron:mark-cjs >nul 2>nul
)

echo.
echo Marina Nargile aciliyor ^(son build / dist^)...
echo Kod degisikliklerini canli gormek icin: Marina-Nargile-Gelistir.bat
echo Bu pencereyi kapatirsaniz uygulama da kapanir.
echo.
call "%NPM%" run start

echo.
if errorlevel 1 (
    echo [Hata] Uygulama acilamadi. Tam yeniden derleme deneniyor...
    call "%NPM%" run build
    if errorlevel 1 (
        echo [Hata] Build de basarisiz.
        pause
        exit /b 1
    )
    call "%NPM%" run start
)

if errorlevel 1 (
    echo [Hata] Hala acilmadi.
    echo NPM sorunu icin Marina-NPM-Konsol.bat acin.
    pause
)

endlocal
