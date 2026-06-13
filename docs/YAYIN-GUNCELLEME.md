# Yayin ve otomatik guncelleme

Kurulu uygulamalar **Ayarlar → Guncelleme** uzerinden GitHub Release (`erdinoral/marinapos`) kontrol eder.

GitHub Release metni: `src/features/account/accountReleaseNotes.ts` → `RELEASE_CHANGELOG_MD`

## Yayin oncesi kontrol (her seferinde)

```powershell
npm run release:verify
```

Bu komut kontrol eder: surum uyumu, Supabase lisans dosyasi, rapor modulleri, git remote.

Musteri kurulumu icin:

```powershell
$env:MARINA_LICENSE_APP_CODE='marina-pos'
npm run pack:release
```

Cikti: `release\Marina-Nargile-POS-{version}-Setup.exe` (+ blockmap + latest.yml)

---

## Otomatik yayin (CI — tag push)

1. Surum artir (`package.json` + `accountReleaseNotes.ts`)
2. `npm run release:verify`
3. Commit + tag + push:

```powershell
git add -A
git commit -m "chore: release {version}"
git tag {version}
git push origin master
git push origin {version}
```

Tag push → `.github/workflows/release.yml` calisir.

### GitHub Repository secrets (ZORUNLU)

**Settings → Secrets and variables → Actions → Repository secrets**

(Environment secrets veya github-pages **KULLANILMAZ**.)

| Secret | Aciklama |
|--------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase proje URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |

Istege bagli: `MARINA_LICENSE_APP_CODE` (varsayilan `marina-pos`)

**Settings → Actions → General → Workflow permissions → Read and write**

### Manuel workflow calistirma

Actions → sol menude **Release Windows** → Run workflow

- Branch: **master**
- Tag: **guncel surum** (ornek `1.8.8`) — **`v1.8.0` gibi eski tag secme**

---

## Elle GitHub Release (CI fail / acil)

1. `npm run pack:release` (yukarida)
2. https://github.com/erdinoral/marinapos/releases/new
3. Tag: surum numarasi
4. **3 dosya yukle:**
   - `Marina-Nargile-POS-{version}-Setup.exe`
   - `Marina-Nargile-POS-{version}-Setup.exe.blockmap`
   - `latest.yml`

Otomatik guncelleme icin `latest.yml` sart.

---

## Yasadigimiz sorunlar ve onlemler

| Sorun | Neden | Onlem |
|--------|--------|--------|
| Lisans "Yapilandirma eksik" | CI build'de `supabase-license.json` yoktu | Repository secrets + `pack:release` yerelde |
| CI Supabase adimi fail | Secret yanlis yerde (Environment) veya bos deger | Repository secrets; Edit ile degeri tekrar yapistir |
| Yanlis repo | Secret baska hesapta | Push: `erdinoral/marinapos` |
| v1.8.0 ile workflow | Eski tag secildi | Run workflow tag = guncel surum |
| Release'de surum yok | CI fail, elle yuklenmedi | `release:verify` + 3 dosya ile elle release |

---

## Surum artirma checklist

- [ ] `package.json` version
- [ ] `accountReleaseNotes.ts` — APP_VERSION, tarih, notlar, RELEASE_CHANGELOG_MD
- [ ] `npm run release:verify`
- [ ] `$env:MARINA_LICENSE_APP_CODE='marina-pos'; npm run pack:release`
- [ ] Tag push **veya** GitHub'a 3 dosya elle
- [ ] Release sayfasinda Setup + latest.yml gorunuyor mu kontrol

## Musteriye guncelleme

1. Uygulama icinden **Guncellemeleri kontrol et → Indir → Yeniden baslat**
2. Kilit ekranindaysa Setup.exe'yi elle kur
3. Veri klasoru (`userData/data`) korunur; yedek onerilir
