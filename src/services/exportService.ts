import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { DatabaseService } from "../db/databaseService";
import { kurusToTl } from "../utils/currency";

function makeOutputDir(baseDir: string) {
  const outputDir = path.join(baseDir, "MarinaNargileRaporlar");
  fs.mkdirSync(outputDir, { recursive: true });
  return outputDir;
}

export function exportSalesToXlsx(database: DatabaseService, date: string, baseDir: string) {
  const rows = database.sales.getByDate(date);
  const outputDir = makeOutputDir(baseDir);
  const filePath = path.join(outputDir, `satislar-${date}.xlsx`);
  const worksheet = XLSX.utils.json_to_sheet(
    rows.map((r) => ({
      id: r.id,
      tarih: r.createdAt,
      odemeTipi: r.paymentType,
      toplamTl: kurusToTl(r.subtotalKurus),
      alinanTl: kurusToTl(r.paidAmountKurus),
      paraUstuTl: kurusToTl(r.changeAmountKurus)
    }))
  );
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Satislar");
  XLSX.writeFile(workbook, filePath);
  return filePath;
}

/** YYYY-MM: satilan urun satirlari + gunluk ozet (gelis / satis / kar) */
export function exportMonthlyProfitToXlsx(database: DatabaseService, yearMonth: string, baseDir: string) {
  const ym = yearMonth.slice(0, 7);
  const lineRows = database.sales.getMonthlySaleLineExports(ym);
  const dayRows = database.sales.getMonthlyDayTotals(ym);
  const outputDir = makeOutputDir(baseDir);
  const filePath = path.join(outputDir, `aylik-kar-${ym}.xlsx`);
  const sheetLines = XLSX.utils.json_to_sheet(
    lineRows.map((r) => ({
      satisTarihi: r.satisTarihi,
      satisId: r.satisId,
      odeme: r.odemeTipi,
      urunId: r.urunId,
      urunKodu: r.urunKodu,
      urunAdi: r.urunAdi,
      miktar: r.miktar,
      miktarBirimi: r.miktarBirimi,
      birimGelisTL: r.birimGelisTl,
      birimSatisTL: r.birimSatisTl,
      maliyetToplamTL: r.maliyetToplamTl,
      satisToplamTL: r.satisToplamTl,
      karTL: r.karTl
    }))
  );
  const sheetDays = XLSX.utils.json_to_sheet(
    dayRows.map((d) => ({
      tarih: d.tarih,
      satisAdedi: d.satisAdedi,
      ciroTL: d.ciroTl,
      maliyetTL: d.maliyetTl,
      karTL: d.karTl
    }))
  );
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheetLines, "SatisSatirlari");
  XLSX.utils.book_append_sheet(workbook, sheetDays, "GunlukOzet");
  XLSX.writeFile(workbook, filePath);
  return filePath;
}
