# Yayin ve otomatik guncelleme

Kurulu uygulamalar **Ayarlar → Guncelleme** uzerinden GitHub Release (`erdinoral/marinapos`) kontrol eder.

GitHub Release metni: `src/features/account/accountReleaseNotes.ts` → `RELEASE_CHANGELOG_MD`

## Otomatik yayin (onerilen)

Surum numarasi ve notlar guncellendikten sonra:

```powershell
git add -A
git commit -m "chore: release {version}"
git tag {version}
git push origin master
git push origin {version}
```

**Tag push edilince** `.github/workflows/release.yml` calisir:
- Windows kurulum dosyasi uretilir
- `Setup.exe`, `latest.yml`, `.blockmap` GitHub Release'e yuklenir
- Aciklama metni `RELEASE_CHANGELOG_MD` dosyasindan alinir

**Bir kez kontrol:** Repo → **Settings → Actions → General → Workflow permissions → Read and write**

Tag formati: `1.8.5` veya `v1.8.5` (mevcut etiketler `1.8.x` seklinde)

## Elle yayin (yedek)

Actions calismazsa veya acil durumda:

```powershell
npm run pack
# release\Marina-Nargile-POS-{version}-Setup.exe

$env:GH_TOKEN = "<github_pat>"
npm run publish:win
```

## Surum artirma

1. `package.json` → `version`
2. `src/features/account/accountReleaseNotes.ts` → `APP_VERSION`, `APP_RELEASE_DATE`, `APP_RELEASE_NOTES`, `RELEASE_CHANGELOG_MD`
3. Commit + tag + push (yukaridaki otomatik akis)

## Musteriye guncelleme

1. Uygulama icinden **Guncellemeleri kontrol et → Indir → Yeniden baslat ve kur**
2. Veri klasoru (`userData/data`) degismez; yedek almak yine onerilir

## Sorun giderme

| Sorun | Cozum |
|--------|--------|
| Guncelleme bulunamadi | Release'de `latest.yml` ve `Setup.exe` var mi; tag surumu ile uyumlu mu |
| Actions basarisiz | Actions sekmesinden log; `npm ci` / imzalama hatalarina bakin |
| Elle publish hata | `GH_TOKEN` repo `contents` yetkisi |
