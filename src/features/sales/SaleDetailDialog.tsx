import type { Category, Customer, Product, SaleWithLines } from "../../types/models";
import { formatTry } from "../../utils/currency";
import { canCreateInvoiceForSale } from "../../utils/invoiceFromSale";
import { saleCollectedKurus, saleKindListLabel } from "../../utils/saleCollected";
import { salePaymentLabel } from "../../utils/paymentLabel";
import { formatSaleDateTime } from "../../utils/saleFormat";
import { formatQtyShort } from "../../utils/saleUnit";
import { formatPosUnitPrice } from "../pos/posCartLine";

type Props = {
  detail: SaleWithLines | null;
  customers: Customer[];
  products: Product[];
  categories: Category[];
  onClose: () => void;
  onInvoice?: () => void;
  onApplyReturn?: () => void;
  returnButtonLabel?: string;
};

export function SaleDetailDialog({
  detail,
  customers,
  products,
  categories,
  onClose,
  onInvoice,
  onApplyReturn,
  returnButtonLabel = "Iade icin sepete al (Satis sekmesi)"
}: Props) {
  if (!detail) return null;

  const customerName = detail.sale.customerId
    ? customers.find((c) => c.id === detail.sale.customerId)?.name ?? `#${detail.sale.customerId}`
    : null;

  return (
    <div className="settings-log-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="settings-log-dialog sale-detail-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="settings-card-head">
          <h3>
            Islem #{detail.sale.id} · {saleKindListLabel(detail.sale.kind)}
          </h3>
          <button type="button" onClick={onClose}>
            Kapat
          </button>
        </div>
        <p className="sale-detail-meta">
          {formatSaleDateTime(detail.sale.createdAt)} · {salePaymentLabel(detail.sale.paymentType)}
          {detail.sale.paymentType === "mixed"
            ? ` (${formatTry(detail.sale.cashAmountKurus ?? 0)} nakit + ${formatTry(detail.sale.cardAmountKurus ?? 0)} kart)`
            : null}{" "}
          · Sepet: {detail.sale.cartName || "Sepet 1"}
          {customerName ? <> · Musteri: {customerName}</> : null}
        </p>
        {detail.sale.kind === "debt_payment" ? (
          <>
            <p className="sale-detail-meta">
              Musteri borcu tahsilati — kasaya giren:{" "}
              <strong className="sales-amount">{formatTry(saleCollectedKurus(detail.sale))}</strong>
            </p>
            {detail.sale.paymentNote?.trim() ? (
              <p className="sale-detail-meta muted small">Not: {detail.sale.paymentNote.trim()}</p>
            ) : null}
          </>
        ) : (
          <div className="sale-detail-table-wrap">
            <table className="sale-detail-table">
              <thead>
                <tr>
                  <th>Kod</th>
                  <th>Urun</th>
                  <th className="r">Miktar</th>
                  <th className="r">Birim</th>
                  <th className="r">Tutar</th>
                </tr>
              </thead>
              <tbody>
                {detail.items.map((ln) => (
                  <tr key={ln.saleItemId ?? `${ln.productId}-${ln.qty}-${ln.unitPriceKurus}`}>
                    <td className="sale-detail-code">{ln.productCode || "—"}</td>
                    <td>{ln.productName}</td>
                    <td className="r">{formatQtyShort(ln.qty, ln.saleUnit)}</td>
                    <td className="r">
                      {formatPosUnitPrice(
                        ln.unitPriceKurus,
                        categories,
                        products.find((p) => p.id === ln.productId)?.categoryId ?? 0
                      )}
                    </td>
                    <td className="r sales-amount">{formatTry(ln.lineTotalKurus)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="sale-detail-total">
          <strong>
            {detail.sale.kind === "debt_payment"
              ? `Tahsilat: ${formatTry(saleCollectedKurus(detail.sale))}`
              : `Toplam: ${formatTry(detail.sale.subtotalKurus)}`}
          </strong>
          {(detail.sale.debtPaidKurus ?? 0) > 0 && detail.sale.kind === "sale" ? (
            <span className="sale-detail-debt"> · Borca odeme: {formatTry(detail.sale.debtPaidKurus!)}</span>
          ) : null}
          {detail.sale.kind === "sale" && detail.sale.paymentType === "mixed" ? (
            <>
              {" "}
              · Nakit: {formatTry(detail.sale.cashAmountKurus ?? 0)} · Kart: {formatTry(detail.sale.cardAmountKurus ?? 0)}
              {(detail.sale.debtAddedKurus ?? 0) > 0 ? (
                <span className="sale-detail-debt"> · Borc eklendi: {formatTry(detail.sale.debtAddedKurus!)}</span>
              ) : null}
              {detail.sale.changeAmountKurus > 0 ? <> · Para ustu: {formatTry(detail.sale.changeAmountKurus)}</> : null}
            </>
          ) : null}
          {detail.sale.kind === "sale" && detail.sale.paymentType === "cash" ? (
            <>
              {" "}
              · Alinan: {formatTry(detail.sale.paidAmountKurus)}
              {(detail.sale.debtAddedKurus ?? 0) > 0 ? (
                <span className="sale-detail-debt"> · Borc eklendi: {formatTry(detail.sale.debtAddedKurus!)}</span>
              ) : null}
              {detail.sale.changeAmountKurus > 0 ? <> · Para ustu: {formatTry(detail.sale.changeAmountKurus)}</> : null}
            </>
          ) : null}
          {detail.sale.kind === "sale" && detail.sale.paymentType === "card" ? (
            <>
              {" "}
              · Karttan: {formatTry(detail.sale.paidAmountKurus)}
              {(detail.sale.debtAddedKurus ?? 0) > 0 ? (
                <span className="sale-detail-debt"> · Borc eklendi: {formatTry(detail.sale.debtAddedKurus!)}</span>
              ) : null}
            </>
          ) : null}
        </p>
        <div className="sale-detail-actions">
          {onInvoice && canCreateInvoiceForSale(detail.sale) ? (
            <button type="button" className="invoice-btn" onClick={onInvoice}>
              Fatura olustur
            </button>
          ) : null}
          {detail.sale.kind === "sale" && onApplyReturn ? (
            <button type="button" className="sale-detail-return-btn" onClick={onApplyReturn}>
              {returnButtonLabel}
            </button>
          ) : detail.sale.kind !== "sale" ? (
            <p className="sale-detail-return-hint">Bu kayit zaten iade; yeni iade icin orijinal satisi secin.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
