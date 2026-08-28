import { parseTrAmount, tlToKurus } from "../../utils/currency";
import type { SupplierInput } from "../../types/models";

/** Tedarikci / kafe ekleme–duzenleme ortak alan seti */
export type ContactFormShape = {
  name: string;
  balanceTl: string;
  phone: string;
  email: string;
  address: string;
  district: string;
  city: string;
  taxOffice: string;
  taxNumber: string;
  note: string;
};

export function supplierInputFromForm(form: ContactFormShape): SupplierInput {
  const bal = parseTrAmount(String(form.balanceTl ?? "").trim());
  return {
    name: form.name.trim(),
    phone: form.phone.trim(),
    email: form.email.trim(),
    address: form.address.trim(),
    district: form.district.trim(),
    city: form.city.trim(),
    taxOffice: form.taxOffice.trim(),
    taxNumber: form.taxNumber.trim(),
    note: form.note.trim(),
    balanceOwedKurus: bal != null && bal >= 0 ? tlToKurus(bal) : 0
  };
}

export function renderSupplierLikeForm(
  values: ContactFormShape,
  onPatch: (patch: Partial<ContactFormShape>) => void,
  disabled: boolean,
  opts?: {
    nameLabel?: string;
    balanceLabel?: string;
    autoFocus?: boolean;
  }
) {
  const nameLabel = opts?.nameLabel ?? "Ad *";
  const balanceLabel = opts?.balanceLabel ?? "Acik borc (TL)";
  return (
    <div className="customers-contact-form">
      <label className="settings-field">
        <span>{nameLabel}</span>
        <input
          value={values.name}
          onChange={(e) => onPatch({ name: e.target.value })}
          disabled={disabled}
          autoFocus={opts?.autoFocus}
        />
      </label>
      <label className="settings-field">
        <span>{balanceLabel}</span>
        <input
          type="text"
          inputMode="decimal"
          value={values.balanceTl}
          onChange={(e) => onPatch({ balanceTl: e.target.value })}
          disabled={disabled}
          placeholder="0"
        />
      </label>
      <label className="settings-field">
        <span>GSM</span>
        <input value={values.phone} onChange={(e) => onPatch({ phone: e.target.value })} disabled={disabled} />
      </label>
      <label className="settings-field">
        <span>E-posta</span>
        <input
          type="email"
          value={values.email}
          onChange={(e) => onPatch({ email: e.target.value })}
          disabled={disabled}
        />
      </label>
      <label className="settings-field settings-field-wide">
        <span>Adres</span>
        <input value={values.address} onChange={(e) => onPatch({ address: e.target.value })} disabled={disabled} />
      </label>
      <div className="customer-detail-edit-grid">
        <label className="settings-field">
          <span>Ilce</span>
          <input value={values.district} onChange={(e) => onPatch({ district: e.target.value })} disabled={disabled} />
        </label>
        <label className="settings-field">
          <span>Il</span>
          <input value={values.city} onChange={(e) => onPatch({ city: e.target.value })} disabled={disabled} />
        </label>
      </div>
      <label className="settings-field">
        <span>Vergi dairesi</span>
        <input value={values.taxOffice} onChange={(e) => onPatch({ taxOffice: e.target.value })} disabled={disabled} />
      </label>
      <label className="settings-field">
        <span>VKN / TCKN</span>
        <input value={values.taxNumber} onChange={(e) => onPatch({ taxNumber: e.target.value })} disabled={disabled} />
      </label>
      <label className="settings-field settings-field-wide">
        <span>Not</span>
        <textarea value={values.note} onChange={(e) => onPatch({ note: e.target.value })} rows={2} disabled={disabled} />
      </label>
    </div>
  );
}
