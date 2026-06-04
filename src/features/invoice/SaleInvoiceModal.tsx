import { useCallback, useEffect, useRef, useState } from "react";
import { getMarinaApi } from "../../api/marinaClient";
import type { InvoiceCustomerInfo } from "../../types/models";
import type { SaleWithLines } from "../../types/models";
import {
  canCreateInvoiceForSale,
  saleHasInvoiceLines,
  saleInvoiceExtraFeeKurus,
  saleToInvoiceLineItems
} from "../../utils/invoiceFromSale";

type Props = {
  sale: SaleWithLines | null;
  customer: InvoiceCustomerInfo;
  onCustomerChange: (next: InvoiceCustomerInfo) => void;
  onClose: () => void;
};

export function SaleInvoiceModal({ sale, customer, onCustomerChange, onClose }: Props) {
  const [previewHtml, setPreviewHtml] = useState("");
  const [loading, setLoading] = useState(false);
  const frameRef = useRef<HTMLIFrameElement | null>(null);

  const refreshPreview = useCallback(async () => {
    if (!sale || !canCreateInvoiceForSale(sale.sale) || !saleHasInvoiceLines(sale)) {
      setPreviewHtml("");
      return;
    }
    setLoading(true);
    try {
      const html = await getMarinaApi().previewInvoice(
        saleToInvoiceLineItems(sale),
        sale.sale.paymentType,
        sale.sale.kind,
        customer,
        saleInvoiceExtraFeeKurus(sale)
      );
      setPreviewHtml(html || "");
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Fatura onizleme hazirlanamadi.");
      setPreviewHtml("");
    } finally {
      setLoading(false);
    }
  }, [sale, customer]);

  useEffect(() => {
    void refreshPreview();
  }, [refreshPreview]);

  const createInvoice = async () => {
    if (!sale || !canCreateInvoiceForSale(sale.sale)) return;
    try {
      const filePath = await getMarinaApi().createInvoice(
        saleToInvoiceLineItems(sale),
        sale.sale.paymentType,
        sale.sale.kind,
        customer,
        saleInvoiceExtraFeeKurus(sale)
      );
      if (filePath && typeof getMarinaApi().showItemInFolder === "function") {
        await getMarinaApi().showItemInFolder(filePath);
      }
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Fatura kaydedilemedi.");
    }
  };

  const printPreview = () => {
    const frame = frameRef.current;
    if (!frame?.contentWindow) return;
    frame.contentWindow.focus();
    frame.contentWindow.print();
  };

  const dialCustomer = () => {
    const raw = (customer.phone ?? "").replace(/\s/g, "");
    if (!raw) return;
    const n = raw.startsWith("+") ? raw : raw.replace(/^0/, "90");
    const api = getMarinaApi();
    if (typeof api.openExternalUrl === "function") {
      void api.openExternalUrl(`tel:${n}`);
    }
  };

  const field = (key: keyof InvoiceCustomerInfo, label: string, placeholder: string) => (
    <label className="settings-field" key={key}>
      <span>{label}</span>
      <input
        value={String(customer[key] ?? "")}
        placeholder={placeholder}
        onChange={(e) => onCustomerChange({ ...customer, [key]: e.target.value })}
      />
    </label>
  );

  if (!sale) return null;

  return (
    <div className="settings-log-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="settings-log-dialog invoice-preview-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="settings-card-head">
          <h3>
            Fatura · Satis #{sale.sale.id}
          </h3>
          <div className="settings-card-actions">
            <button type="button" onClick={() => void dialCustomer()} disabled={!customer.phone?.trim()}>
              Telefonla ara
            </button>
            <button type="button" onClick={() => void createInvoice()} disabled={loading || !previewHtml}>
              HTML Kaydet
            </button>
            <button type="button" disabled={loading || !previewHtml} onClick={() => printPreview()}>
              Yazdir
            </button>
            <button type="button" onClick={onClose}>
              Kapat
            </button>
          </div>
        </div>
        {loading ? (
          <p className="settings-empty">Fatura hazirlaniyor...</p>
        ) : (
          <>
            <div className="settings-company-grid invoice-customer-grid">
              {field("companyName", "Firma / unvan", "Orn: ABC Ltd. Sti.")}
              {field("fullName", "Ad soyad / yetkili", "Orn: Ahmet Yilmaz")}
              {field("tcOrVkn", "TC / VKN", "Bos birakilirsa 11111111111")}
              {field("phone", "Telefon", "Orn: +90 5xx xxx xx xx")}
              {field("email", "E-Posta", "Bos birakilirsa Belirtilmedi")}
              {field("district", "Ilce", "Orn: Karsiyaka")}
              {field("city", "Il", "Orn: Izmir")}
              <label className="settings-field settings-field-wide">
                <span>Adres</span>
                <input
                  value={customer.address ?? ""}
                  placeholder="Musteri adresi"
                  onChange={(e) => onCustomerChange({ ...customer, address: e.target.value })}
                />
              </label>
            </div>
            <button type="button" onClick={() => void refreshPreview()}>
              Onizlemeyi Guncelle
            </button>
            <iframe ref={frameRef} title="Fatura onizleme" className="invoice-preview-frame" srcDoc={previewHtml} />
          </>
        )}
      </div>
    </div>
  );
}
