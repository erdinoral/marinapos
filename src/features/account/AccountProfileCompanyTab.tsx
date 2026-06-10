import { useCallback, useEffect, useState } from "react";
import { getMarinaApi } from "../../api/marinaClient";
import type { Settings } from "../../types/models";

type CompanyFields = Pick<
  Settings,
  "companyName" | "companyAddress" | "companyPhone" | "companyEmail" | "taxOffice" | "taxNumber"
>;

type Props = {
  onCompanySaved?: () => void | Promise<void>;
};

export function AccountProfileCompanyTab({ onCompanySaved }: Props) {
  const [company, setCompany] = useState<CompanyFields>({
    companyName: "",
    companyAddress: "",
    companyPhone: "",
    companyEmail: "",
    taxOffice: "",
    taxNumber: ""
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgOk, setMsgOk] = useState(false);

  const load = useCallback(async () => {
    try {
      const s = await getMarinaApi().getSettings();
      setCompany({
        companyName: s.companyName ?? "",
        companyAddress: s.companyAddress ?? "",
        companyPhone: s.companyPhone ?? "",
        companyEmail: s.companyEmail ?? "",
        taxOffice: s.taxOffice ?? "",
        taxNumber: s.taxNumber ?? ""
      });
    } catch {
      /* keep previous */
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setBusy(true);
    setMsg("");
    setMsgOk(false);
    try {
      await getMarinaApi().setCompanyInfo(company);
      await onCompanySaved?.();
      setMsgOk(true);
      setMsg("Firma bilgileri kaydedildi.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Firma bilgileri kaydedilemedi.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="account-panel-card account-profile-card account-profile-card--company">
      <h3 className="account-profile-card-title">Firma bilgileri (fatura)</h3>
      <p className="muted small account-profile-section-lead">
        Fatura ve fislerde gorunecek isletme bilgileri. POS alt bilgisinde de kullanilir.
      </p>
      <div className="account-profile-company-grid">
        <label className="account-field account-field-wide">
          <span>Firma unvani</span>
          <input
            value={company.companyName}
            onChange={(e) => setCompany((p) => ({ ...p, companyName: e.target.value }))}
            placeholder="Orn: Marina Nargile"
            disabled={busy}
          />
        </label>
        <label className="account-field">
          <span>Vergi dairesi</span>
          <input
            value={company.taxOffice}
            onChange={(e) => setCompany((p) => ({ ...p, taxOffice: e.target.value }))}
            placeholder="Orn: Kadikoy"
            disabled={busy}
          />
        </label>
        <label className="account-field">
          <span>Vergi no / TCKN</span>
          <input
            value={company.taxNumber}
            onChange={(e) => setCompany((p) => ({ ...p, taxNumber: e.target.value }))}
            placeholder="Orn: 1234567890"
            disabled={busy}
          />
        </label>
        <label className="account-field">
          <span>Telefon</span>
          <input
            value={company.companyPhone}
            onChange={(e) => setCompany((p) => ({ ...p, companyPhone: e.target.value }))}
            placeholder="Orn: +90 5xx xxx xx xx"
            disabled={busy}
          />
        </label>
        <label className="account-field">
          <span>E-posta</span>
          <input
            value={company.companyEmail}
            onChange={(e) => setCompany((p) => ({ ...p, companyEmail: e.target.value }))}
            placeholder="Orn: info@firma.com"
            disabled={busy}
          />
        </label>
        <label className="account-field account-field-wide">
          <span>Adres</span>
          <input
            value={company.companyAddress}
            onChange={(e) => setCompany((p) => ({ ...p, companyAddress: e.target.value }))}
            placeholder="Firma adresi"
            disabled={busy}
          />
        </label>
      </div>
      {msg ? <p className={`account-auth-message${msgOk ? " account-auth-message--ok" : ""}`}>{msg}</p> : null}
      <button type="button" className="account-auth-submit" disabled={busy} onClick={() => void save()}>
        {busy ? "Kaydediliyor…" : "Firma bilgilerini kaydet"}
      </button>
    </section>
  );
}
