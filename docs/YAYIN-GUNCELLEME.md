# Yayin ve otomatik guncelleme (1.8.0+)

Kurulu uygulamalar **Ayarlar → Guncelleme** uzerinden GitHub Release (`erdinoral/marinapos`) kontrol eder.

**Surum 1.8.0 baslik, aciklama ve kontrol listesi:** [`docs/RELEASE-1.8.0.md`](./RELEASE-1.8.0.md) — GitHub Release metnini oradan kopyalayin.

## Hizli yayin (Windows)

Gelistirici makinede (imza sertifikasi varsa `docs/RELEASE-SIGNING.md`):

```powershell
cd "F:\Site_ve_Uygulamalar\UYGULAMALAR\Marina Nargile orj"

# 1) Surum package.json ile uyumlu olsun (ornek: 1.8.0)
npm run build

# 2) Yerel kurulum dosyasi (test)
npm run pack
# Cikti: release\Marina-Nargile-POS-1.8.0-Setup.exe

# 3) GitHub'a surum yukle (GH_TOKEN gerekir)
$env:GH_TOKEN = "<github_pat veya gh auth token>"
git tag v1.8.0
git push origin v1.8.0
npm run publish:win
```

`publish:win` su dosyalari GitHub Release'e yukler: `Setup.exe`, `latest.yml`, `.blockmap` (electron-updater).

## GitHub Actions ile yayin

`v*` etiketi push edilince workflow Windows build + publish yapar:

```powershell
git add -A
git commit -m "chore: release 1.8.0"
git tag v1.8.0
git push origin main
git push origin v1.8.0
```

Repo ayarlari: **Settings → Actions → General → Workflow permissions → Read and write**.

## Surum artirma

1. `package.json` → `version`
2. `src/features/account/accountReleaseNotes.ts` → `APP_VERSION`, `APP_RELEASE_DATE`, `APP_RELEASE_NOTES`, `RELEASE_CHANGELOG_MD`
3. `docs/RELEASE-{version}.md` → GitHub baslik + aciklama + kontrol listesi
4. Tag: `v{version}` (ornek `v1.8.0`)

## Musteriye guncelleme

1. Yeni `Setup.exe` veya uygulama icinden **Guncellemeleri kontrol et → Indir → Yeniden baslat ve kur**
2. Veri klasoru (`userData/data`) degismez; yedek almak yine onerilir

## Sorun giderme

| Sorun | Cozum |
|--------|--------|
| Guncelleme bulunamadi | Tag ve `latest.yml` release'de mi kontrol edin |
| SmartScreen | Imzali build (`RELEASE-SIGNING.md`) |
| `publish` hata | `GH_TOKEN` repo yetkisi; tag adi `v1.8.0` formatinda |
