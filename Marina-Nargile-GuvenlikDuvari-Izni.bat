@echo off
echo Marina POS Mobil Baglantisi Icin Guvenlik Duvari Izni Ekleniyor...
echo.

:: Yonetici izni kontrolu
net session >nul 2>&1
if %errorLevel% == 0 (
    echo Yonetici yetkisi dogrulandi.
) else (
    echo Lutfen bu dosyaya sag tiklayip "Yonetici olarak calistir" secenegi ile acin!
    echo.
    pause
    exit /b 1
)

:: Kurali ekle (Ozel ve Ortak aglarin tamaminda erisime izin verir)
netsh advfirewall firewall add rule name="Marina POS Mobile Server" dir=in action=allow protocol=TCP localport=38472 profile=any

echo.
echo Islem tamamlandi! Eger 'Ok' veya 'Tamam' mesaji gorduyseniz kural basariyla eklenmistir.
echo Simdi telefondan tekrar baglanmayi deneyebilirsiniz.
echo.
pause
