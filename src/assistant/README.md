# POS Asistan (taşınabilir çekirdek)

Marina’da **entegrasyon testi** için kullanılır; üretim POS’unuza taşırken bu klasörü olduğu gibi kopyalayabilirsiniz.

## Katmanlar

| Dosya | Rol |
|-------|-----|
| `types.ts` | `PosAssistantDataPort`, cevap tipleri |
| `knowledgeBase.ts` | SSS metinleri (iş kurallarınızı burada güncelleyin) |
| `liveIntents.ts` | Canlı sorgu şablonları |
| `engine.ts` | Eşleştirme + cevap (AI/mock yok) |
| `adapters/*` | Host POS API köprüsü (Marina: `marinaDataPort.ts`) |
| `ui/AssistantLab.tsx` | Örnek sohbet UI |

## Kendi POS’unuzda

1. `src/assistant` klasörünü projenize kopyalayın.
2. `createYourPosDataPort(): PosAssistantDataPort` yazın (salt okunur API).
3. UI: `AssistantLab` veya kendi paneliniz + `askAssistant(soru, port, config)`.
4. `knowledgeBase.ts` metinlerini kendi ekran/isimlerinize göre düzenleyin.
5. İsteğe bağlı: `labMode: false`, `displayName: "Akiyom POS"`.

## Marina’da

- **Sağ alt** `?` düğmesi → asistan paneli (tüm sekmelerde).
- **Varsayılan:** SSS + canlı veri (hafif, anında).
- **İsteğe bağlı:** «Gelişmiş kur (~280 MB)» → tek tık indirme; model yalnızca metni düzenler, rakamlar API’den kalır.
- Adaptör: `createMarinaAssistantDataPort()`.

## Sonraki fazlar

- Sekmeye yönlendirme (`onNavigate`)
- Yazma işlemleri (stok ekleme vb.) — kasada riskli, önerilmez
