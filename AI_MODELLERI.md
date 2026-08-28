# Marina Nargile POS — Önerilen AI Modelleri

> Kaynak: `agents.md` — Nargile salonu POS; satış, stok, barkod, Supabase.

## OCR (Fatura, tedarikçi belgesi)

| Model | Ne için |
|-------|---------|
| `PaddlePaddle/PaddleOCR-VL-1.6` | Belge / fiş okuma |
| `PaddlePaddle/PP-OCRv6_medium_det_safetensors` | Hızlı metin tespiti |
| `numind/NuExtract3` | Fatura alanlarını JSON'a çevirme |

## Hafif LLM (Stok uyarısı, rapor özeti)

| Model | Ne için |
|-------|---------|
| `meta-llama/Llama-3.2-3B-Instruct` | Günlük özet metni |
| `Qwen/Qwen2.5-7B-Instruct` | Satış trendi yorumu |

## Arama (Ürün / stok)

| Model | Ne için |
|-------|---------|
| `sentence-transformers/all-MiniLM-L6-v2` | Ürün adı semantik arama |
| `google/embeddinggemma-300m` | Hafif embedding (Transformers.js ile uyumlu düşünülebilir) |

## Ses (Mağaza müziği — POS radyo)

| Model | Ne için |
|-------|---------|
| `akiyom-radio` manifest | Hazır katalog (AI üretim şart değil) |

## Bu projede gereksiz

FLUX görsel, video üretimi, ağır kodlama, TTS (şimdilik).
