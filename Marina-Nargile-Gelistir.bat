@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

title Marina Nargile POS (Gelistirici - canli)

call "%~dp0_npm-setup.bat"
if not defined NPM (
    echo [Hata] Node.js bulunamadi.
    pause
    exit /b 1
)

if not exist "node_modules\" call "%NPM%" install

echo.
echo ========================================
echo  GELISTIRICI MOD ^(canli guncelleme^)
echo ========================================
echo  Kaynak degisince arayuz yenilenir.
echo  Sag tik menusu vb. icin Ctrl+R veya
echo  uygulamayi kapatip bu bat'i tekrar acin.
echo.
echo  Port 5173 doluysa Gorev Yoneticisi'nden
echo  eski electron / node kapatin.
echo ========================================
echo.
call "%NPM%" run dev

pause
endlocal
