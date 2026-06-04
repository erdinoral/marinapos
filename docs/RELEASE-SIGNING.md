# Release ve Imzalama Notlari

Bu dokuman, Windows kurulum paketlerinde SmartScreen uyarisini azaltmak ve surum alma surecini standartlastirmak icindir.

## Mevcut paketleme akisi

- Proje komutu: `npm run pack`
- Cikti dosyasi: `release/Marina Nargile POS-<version>-Setup.exe`
- Native dependency rebuild kapali (`npmRebuild=false`) oldugu icin Windows `EPERM`/`sharp` sorunlari azalir.

## SmartScreen neden cikar?

- Setup dosyasi imzasizsa veya imza itibari henuz dusukse, Windows dosyayi "taninmayan uygulama" gibi gorur.
- Her yeni surumde dosya hash'i degistigi icin itibar tekrar birikir.

## Kalici cozum (onerilen)

1. Code Signing sertifikasi alin (tercihen EV).
2. `CSC_LINK` ve `CSC_KEY_PASSWORD` degiskenleriyle electron-builder imzalama ayarlansin.
3. Timestamp sunucusu kullanilsin.
4. Yayinci adi sabit tutulsun (`Akiyom`).

## Imzali build icin ortam degiskenleri (ornek)

PowerShell:

```powershell
$env:CSC_LINK="C:\certs\akiyom-signing.pfx"
$env:CSC_KEY_PASSWORD="********"
npm run pack
```

## Cikti hash dogrulama

```powershell
Get-FileHash ".\release\Marina Nargile POS-1.6.0-Setup.exe" -Algorithm SHA256
```

Hash degerini paylasmak, son kullanici tarafinda guven kontrolune yardimci olur.
