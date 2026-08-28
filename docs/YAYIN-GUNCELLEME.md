# Yayin ve otomatik guncelleme

Kurulu uygulamalar **Ayarlar → Guncelleme** uzerinden GitHub Release (`erdinoral/marinapos`) kontrol eder.

## Temel kural: lisans yerelde exe'ye gomulur

Supabase URL + anon key **`.env.local`** dosyasindan okunur ve `build/supabase-license.json` olarak **Setup.exe icine** paketlenir.

- GitHub Secrets **zorunlu degil**
- CI otomatik tag push **kapali** (secret sorunu yasamamak icin)
- Musteri kurulumlari **her zaman yerel `pack:release` veya `release:publish`** ile uretilir

Git'e gitmez: `.env.local`, `build/supabase-license.json`

---

## Standart yayin (onerilen)

```powershell
npm run release:verify
npm run release:publish
```

`release:publish` su adimlari yapar:
1. `.env.local` → `build/supabase-license.json` (marina-pos)
2. Derleme + Setup.exe
3. GitHub Release'e yukleme (`latest.yml` dahil)

**Bir kez:** GitHub Personal Access Token (repo `contents` yetkisi):

```powershell
$env:GH_TOKEN = "github_pat_...."
```

Sonra `npm run release:publish`

---

## Elle GitHub Release (token yoksa)

```powershell
npm run pack:release
```

https://github.com/erdinoral/marinapos/releases/new → tag = surum

**3 dosya yukle:**
- `release/Marina-Nargile-POS-{version}-Setup.exe`
- `release/Marina-Nargile-POS-{version}-Setup.exe.blockmap`
- `release/latest.yml`

---

## Surum artirma checklist

- [ ] `package.json` version
- [ ] `accountReleaseNotes.ts` — APP_VERSION, tarih, RELEASE_CHANGELOG_MD
- [ ] `npm run release:verify`
- [ ] `npm run release:publish` **veya** `pack:release` + elle 3 dosya
- [ ] Release sayfasinda Setup + latest.yml var mi

---

## CI (GitHub Actions)

| Workflow | Ne yapar |
|----------|----------|
| **Build check** | `master` push → sadece `npm run build` (lisans/secret yok) |
| **Release Windows (CI — opsiyonel)** | Manuel Run workflow; secret varsa CI'dan yayin |

Tag push artik otomatik release **tetiklemez** — yanlis/bos CI build musteriye gitmesin diye.

---

## Musteriye guncelleme

1. Uygulama icinden **Guncellemeleri kontrol et**
2. Kilit ekranindaysa Setup.exe elle kur
3. Veri korunur; yedek onerilir

## Sorun giderme

| Sorun | Cozum |
|--------|--------|
| Lisans "Yapilandirma eksik" | Setup CI'dan degil yerel `pack:release` ile uretilmeli |
| Guncelleme yok | Release'de `latest.yml` + Setup.exe |
| release:publish token hatasi | `$env:GH_TOKEN` veya elle 3 dosya yukle |
