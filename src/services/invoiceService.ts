import fs from "node:fs";
import path from "node:path";
import { DatabaseService } from "../db/databaseService";
import { InvoiceCustomerInfo, PaymentType, SaleKind, SaleLineInput } from "../types/models";
import { formatTry } from "../utils/currency";
import { salePaymentLabel } from "../utils/paymentLabel";
import { gramLineTotalKurus } from "../utils/saleUnit";

function esc(text: string) {
  return String(text ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function invoiceLogoDataUri() {
  const candidates = [
    path.join(process.cwd(), "build", "icons", "icon.png"),
    path.join(process.cwd(), "src", "assets", "marina-logo.png"),
    path.join(process.cwd(), "src", "assets", "marina-logo-normalized.png")
  ];
  for (const p of candidates) {
    if (!fs.existsSync(p)) continue;
    try {
      const b64 = fs.readFileSync(p).toString("base64");
      return `data:image/png;base64,${b64}`;
    } catch {
      // sessiz devam
    }
  }
  return "";
}

function effectiveLineDiscountPercent(listLineTotalKurus: number, netLineTotalKurus: number): number {
  const list = Math.abs(listLineTotalKurus);
  const net = Math.abs(netLineTotalKurus);
  if (list <= 0 || net >= list) return 0;
  return Math.max(0, Math.min(100, Math.round(100 * (1 - net / list))));
}

export function buildInvoiceHtml(
  db: DatabaseService,
  items: SaleLineInput[],
  paymentType: PaymentType,
  saleKind: SaleKind = "sale",
  customer?: InvoiceCustomerInfo,
  extraFeeKurus = 0
) {
  const state = db.store.getState();
  const sign = saleKind === "return" ? -1 : 1;
  const normalized = items
    .map((x) => {
      const p = state.products.find((q) => q.id === x.productId && q.isActive === 1);
      if (!p) return null;
      const cat = state.categories.find((c) => c.id === p.categoryId);
      const isGram = cat?.saleUnit === "gram";
      const catalogDiscount = Math.max(0, Math.min(100, Number(p.discountPercent ?? 0)));
      const override =
        x.unitPriceKurus != null && Number.isFinite(x.unitPriceKurus) ? Math.round(x.unitPriceKurus) : null;
      const unitPrice =
        override != null ? Math.max(0, override) : Math.round((p.priceKurus * (100 - catalogDiscount)) / 100);
      const listLineTotal = (isGram ? gramLineTotalKurus(p.priceKurus, x.qty) : Math.round(x.qty * p.priceKurus)) * sign;
      const lineTotal =
        x.lineTotalKurus != null && Number.isFinite(x.lineTotalKurus)
          ? Math.round(x.lineTotalKurus) * sign
          : isGram
            ? gramLineTotalKurus(unitPrice, x.qty) * sign
            : Math.round(x.qty * unitPrice) * sign;
      const discount = effectiveLineDiscountPercent(listLineTotal, lineTotal);
      return { p, qty: x.qty, unitPrice, lineTotal, listLineTotal, discount, isGram };
    })
    .filter(Boolean) as Array<{
    p: (typeof state.products)[number];
    qty: number;
    unitPrice: number;
    lineTotal: number;
    listLineTotal: number;
    discount: number;
    isGram: boolean;
  }>;
  if (normalized.length === 0) throw new Error("Fatura icin urun bulunamadi.");
  const subtotal = normalized.reduce((s, i) => s + i.lineTotal, 0);
  const listSubtotal = normalized.reduce((s, i) => s + i.listLineTotal, 0);
  const discountTotalKurus = Math.max(0, listSubtotal - subtotal);
  const extraRaw = Math.max(0, Math.round(Number(extraFeeKurus) || 0));
  const extraLineTotal = saleKind === "return" ? -extraRaw : extraRaw;
  const grandTotal = subtotal + extraLineTotal;
  let matrahKurus = 0;
  let kdvKurus = 0;
  for (const i of normalized) {
    const rate = Math.max(0, Math.min(100, Number(i.p.vatRatePercent ?? 20))) / 100;
    const lt = i.lineTotal;
    const gross = Math.abs(lt);
    const sgn = lt >= 0 ? 1 : -1;
    if (i.p.priceIncludesVat) {
      const mat = Math.round(gross / (1 + rate));
      const kdv = gross - mat;
      matrahKurus += sgn * mat;
      kdvKurus += sgn * kdv;
    } else {
      const kdv = Math.round(gross * rate);
      matrahKurus += sgn * gross;
      kdvKurus += sgn * kdv;
    }
  }
  const matrah = matrahKurus;
  const kdv = kdvKurus;
  const settings = state.settings;
  const now = new Date();
  const logoDataUri = invoiceLogoDataUri();
  const fullName = (customer?.fullName ?? "").trim();
  const companyName = (customer?.companyName ?? "").trim();
  const buyerRows = companyName
    ? `<tr><td><strong>Firma / Unvan</strong></td><td colspan="3">${esc(companyName)}</td></tr>
<tr><td><strong>Yetkili / Ad</strong></td><td colspan="3">${esc(fullName || "-")}</td></tr>`
    : `<tr><td><strong>MUSTERI</strong></td><td colspan="3">${esc(fullName || "Musteri")}</td></tr>`;
  const customerTc = (customer?.tcOrVkn ?? "").trim() || "11111111111";
  const customerPhone = (customer?.phone ?? "").trim() || "-";
  const customerEmail = (customer?.email ?? "").trim() || "Belirtilmedi";
  const customerAddress = (customer?.address ?? "").trim() || "-";
  const customerDistrict = (customer?.district ?? "").trim() || "";
  const customerCity = (customer?.city ?? "").trim() || "";
  const customerRegion = [customerDistrict, customerCity].filter(Boolean).join(" / ") || "-";
  const no = `FTR-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${now.getTime()
    .toString()
    .slice(-5)}`;

  const html = `<!doctype html>
<html lang="tr"><head><meta charset="utf-8"/><title>Fatura ${esc(no)}</title>
<style>
*{box-sizing:border-box} body{font-family:Arial,sans-serif;padding:20px;color:#111}
.head{display:flex;justify-content:space-between;align-items:flex-start;gap:20px}
.head-left,.head-right{border:2px solid #111;padding:10px 12px;min-height:96px}
.head-left{flex:2}.head-mid{flex:1;text-align:center;padding-top:10px}.head-right{flex:1}
.efatura{font-weight:700;font-size:28px;letter-spacing:1px}
.sub{font-size:12px;color:#555}
.head-right-logo{display:block;width:100%;max-height:72px;object-fit:contain;object-position:center;margin:0 0 8px}
table{width:100%;border-collapse:collapse;margin-top:14px}
th,td{border:1px solid #666;padding:7px;font-size:12px;text-align:left}
.r{text-align:right}.muted{color:#666;font-size:12px}
.totals{margin-left:auto;margin-top:10px;width:min(420px,100%)}
.totals td{font-weight:600}
@media print{body{padding:8mm}}
</style></head><body>
<div class="head">
  <div class="head-left">
    <strong>${esc(settings.companyName || "Firma")}</strong><br/>
    <span class="muted">${esc(settings.companyAddress || "-")}</span><br/>
    <span class="muted">Tel: ${esc(settings.companyPhone || "-")}</span><br/>
    <span class="muted">E-Posta: ${esc(settings.companyEmail || "-")}</span><br/>
    <span class="muted">Vergi Dairesi: ${esc(settings.taxOffice || "-")}</span><br/>
    <span class="muted">VKN/TCKN: ${esc(settings.taxNumber || "-")}</span>
  </div>
  <div class="head-mid">
    <div class="efatura">e-FATURA</div>
  </div>
  <div class="head-right">
    ${logoDataUri ? `<img src="${logoDataUri}" alt="Marina Logo" class="head-right-logo"/>` : ""}
    <div><strong>Fatura No:</strong> ${esc(no)}</div>
    <div><strong>Tarih:</strong> ${esc(now.toLocaleString("tr-TR"))}</div>
    <div><strong>Odeme:</strong> ${esc(salePaymentLabel(paymentType))}</div>
  </div>
</div>
<table style="margin-top:10px"><tbody>
${buyerRows}
<tr><td><strong>TC/VKN</strong></td><td>${esc(customerTc)}</td><td><strong>Telefon</strong></td><td>${esc(customerPhone)}</td></tr>
<tr><td><strong>E-Posta</strong></td><td colspan="3">${esc(customerEmail)}</td></tr>
<tr><td><strong>Adres</strong></td><td colspan="3">${esc(customerAddress)} · ${esc(customerRegion)}</td></tr>
</tbody></table>
<table><thead><tr><th>Urun</th><th>Kod</th><th class="r">Miktar</th><th class="r">Birim</th><th class="r">Ind.</th><th class="r">Tutar</th></tr></thead><tbody>
${normalized
  .map(
    (i) =>
      `<tr><td>${esc(i.p.name)}</td><td>${esc(i.p.code)}</td><td class="r">${esc(i.isGram ? `${i.qty} g` : String(i.qty))}</td><td class="r">${
        i.isGram ? `${formatTry(i.unitPrice)} / 1000 g` : formatTry(i.unitPrice)
      }</td><td class="r">%${i.discount.toFixed(0)}</td><td class="r">${formatTry(i.lineTotal)}</td></tr>`
  )
  .join("")}
${
  extraRaw !== 0
    ? `<tr><td>${esc("Kart (Ozel)")}</td><td>-</td><td class="r">1</td><td class="r">${formatTry(extraLineTotal)}</td><td class="r">-</td><td class="r">${formatTry(extraLineTotal)}</td></tr>`
    : ""
}
</tbody></table>
<table class="totals">
  ${
    discountTotalKurus > 0
      ? `<tr><td>Liste Toplam (indirim oncesi)</td><td class="r">${formatTry(listSubtotal)}</td></tr>
  <tr><td>Uygulanan Indirim</td><td class="r">-${formatTry(discountTotalKurus)}</td></tr>`
      : ""
  }
  <tr><td>Ara Toplam (KDV Haric)</td><td class="r">${formatTry(matrah)}</td></tr>
  <tr><td>Hesaplanan KDV (urun oranlarina gore)</td><td class="r">${formatTry(kdv)}</td></tr>
  <tr><td>Urunler Vergiler Dahil</td><td class="r">${formatTry(subtotal)}</td></tr>
  ${
    extraRaw !== 0
      ? `<tr><td>${esc("Kart (Ozel)")}</td><td class="r">${formatTry(extraLineTotal)}</td></tr>`
      : ""
  }
  <tr><td><strong>Odenecek Toplam</strong></td><td class="r"><strong>${formatTry(grandTotal)}</strong></td></tr>
</table>
<hr/><p class="muted">Bu belge Marina Nargile Otomasyon tarafindan olusturulmustur.</p>
</body></html>`;

  return { html, no };
}

export function createInvoiceHtml(
  db: DatabaseService,
  items: SaleLineInput[],
  paymentType: PaymentType,
  saleKind: SaleKind = "sale",
  outputDir?: string,
  customer?: InvoiceCustomerInfo,
  extraFeeKurus = 0
) {
  const { html, no } = buildInvoiceHtml(db, items, paymentType, saleKind, customer, extraFeeKurus);

  const outDir = outputDir ? path.join(outputDir, "MarinaInvoices") : path.join(process.cwd(), "invoices");
  fs.mkdirSync(outDir, { recursive: true });
  const filePath = path.join(outDir, `${no}.html`);
  fs.writeFileSync(filePath, html, "utf-8");
  return filePath;
}
