# Yayin ve otomatik guncelleme

Kurulu uygulamalar **Ayarlar → Guncelleme** uzerinden GitHub Release (`erdinoral/marinapos`) kontrol eder.

GitHub Release metni: `src/features/account/accountReleaseNotes.ts` → `RELEASE_CHANGELOG_MD`

## Hizli yayin (Windows)

```powershell
cd "F:\Site_ve_Uygulamalar\UYGULAMALAR\Marina Nargile orj"

npm run build
npm run pack
# Cikti: release\Marina-Nargile-POS-{version}-Setup.exe

$env:GH_TOKEN = "<github_pat veya gh auth token>"
git tag {version}
git push origin {version}
npm run publish:win
```

`publish:win` su dosyalari GitHub Release'e yukler: `Setup.exe`, `latest.yml`, `.blockmap`

## GitHub Actions ile yayin

`v*` etiketi push edilince workflow Windows build + publish yapar:

```powershell
git add -A
git commit -m "chore: release {version}"
git tag {version}
git push origin main
git push origin {version}
```

Repo ayarlari: **Settings → Actions → General → Workflow permissions → Read and write**

## Surum artirma

1. `package.json` → `version`
2. `src/features/account/accountReleaseNotes.ts` → `APP_VERSION`, `APP_RELEASE_DATE`, `APP_RELEASE_NOTES`, `RELEASE_CHANGELOG_MD`
3. Tag: `{version}` (ornek `1.8.5`)

## Musteriye guncelleme

1. Yeni `Setup.exe` veya uygulama icinden **Guncellemeleri kontrol et → Indir → Yeniden baslat ve kur**
2. Veri klasoru (`userData/data`) degismez; yedek almak yine onerilir

## Sorun giderme

| Sorun | Cozum |
|--------|--------|
| Guncelleme bulunamadi | Tag ve `latest.yml` release'de mi kontrol edin |
| `publish` hata | `GH_TOKEN` repo yetkisi; tag adi `1.8.5` formatinda |
