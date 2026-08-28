import { useCallback, useEffect, useState } from "react";
import { getMarinaApi } from "../../api/marinaClient";
import type { AccountUser } from "../../types/account";
import type { LegalKind } from "../legal/LegalModal";
import type { LicenseStatus } from "../../types/models";
import { AccountProfileAppColumn } from "./AccountProfileAppColumn";
import { AccountProfileCompanyTab } from "./AccountProfileCompanyTab";
import { AccountProfileFeedbackTab } from "./AccountProfileFeedbackTab";
import { AccountProfileInfoTab } from "./AccountProfileInfoTab";
import { AccountProfileLegalSupportCard } from "./AccountProfileLegalSupportCard";
import { AccountProfileLicenseTab } from "./AccountProfileLicenseTab";
import { AccountProfilePinTab } from "./AccountProfilePinTab";
import { AccountProfileSecurityTab } from "./AccountProfileSecurityTab";

type ProfileTab = "info" | "company" | "pin" | "security" | "license";

type Props = {
  user: AccountUser;
  feedbackConfigured: boolean;
  onUserChange: (user: AccountUser) => void;
  onSignedOut: () => void;
  onOpenSettings: () => void;
  onOpenLegal: (kind: LegalKind) => void;
  onCompanySaved?: () => void | Promise<void>;
};

function licenseBadgeLabel(state: LicenseStatus["state"]): string {
  switch (state) {
    case "active":
      return "Lisans aktif";
    case "pending":
      return "Lisans beklemede";
    case "needs_activation":
      return "Aktivasyon gerekli";
    case "locked":
      return "Lisans kilitli";
    case "offline_expired":
      return "Lisans suresi doldu";
    case "config_missing":
      return "Lisans yapilandirmasi yok";
    default:
      return "Lisans";
  }
}

export function AccountProfilePanel({
  user,
  feedbackConfigured,
  onUserChange,
  onSignedOut,
  onOpenSettings,
  onOpenLegal,
  onCompanySaved
}: Props) {
  const [companyName, setCompanyName] = useState("");
  const [profileTab, setProfileTab] = useState<ProfileTab>("info");
  const [licenseState, setLicenseState] = useState<LicenseStatus["state"] | null>(null);

  const reloadCompanyName = useCallback(() => {
    void getMarinaApi()
      .getSettings()
      .then((s) => setCompanyName(s.companyName?.trim() ?? ""))
      .catch(() => setCompanyName(""));
  }, []);

  useEffect(() => {
    reloadCompanyName();
  }, [reloadCompanyName]);

  const handleCompanySaved = useCallback(async () => {
    await onCompanySaved?.();
    reloadCompanyName();
  }, [onCompanySaved, reloadCompanyName]);

  useEffect(() => {
    void getMarinaApi()
      .checkLicense()
      .then((l) => setLicenseState(l.state))
      .catch(() => setLicenseState(null));
  }, []);

  return (
    <div className="account-profile-panel">
      <div className="account-profile-hero">
        <span className="account-profile-avatar" aria-hidden>
          {(user.displayName.trim()[0] ?? user.email[0] ?? "?").toUpperCase()}
        </span>
        <div className="account-profile-hero-text">
          <h3 className="account-profile-name">{user.displayName.trim() || user.email}</h3>
          <p className="account-profile-email muted">{user.email}</p>
          {companyName ? <p className="muted small account-profile-hero-company">{companyName}</p> : null}
        </div>
        {licenseState ? (
          <span className={`account-profile-hero-license account-license-badge account-license-badge--${licenseState}`}>
            {licenseBadgeLabel(licenseState)}
          </span>
        ) : null}
      </div>

      <div className="account-profile-columns">
        <section className="account-profile-column" aria-labelledby="account-col-profile-title">
          <div className="account-profile-column-tab is-active" id="account-col-profile-title">
            Profil
          </div>
          <div className="account-profile-column-body">
            <div className="account-profile-inner-tabs" role="tablist" aria-label="Profil sekmeleri">
              <button
                type="button"
                role="tab"
                aria-selected={profileTab === "info"}
                className={profileTab === "info" ? "active" : ""}
                onClick={() => setProfileTab("info")}
              >
                Kisisel
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={profileTab === "pin"}
                className={`account-tab-pin${profileTab === "pin" ? " active" : ""}`}
                onClick={() => setProfileTab("pin")}
              >
                PIN
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={profileTab === "company"}
                className={profileTab === "company" ? "active" : ""}
                onClick={() => setProfileTab("company")}
              >
                Firma
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={profileTab === "security"}
                className={profileTab === "security" ? "active" : ""}
                onClick={() => setProfileTab("security")}
              >
                Guvenlik
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={profileTab === "license"}
                className={profileTab === "license" ? "active" : ""}
                onClick={() => setProfileTab("license")}
              >
                Lisans
              </button>
            </div>

            {profileTab === "info" ? (
              <AccountProfileInfoTab user={user} onUserChange={onUserChange} onSignedOut={onSignedOut} />
            ) : null}
            {profileTab === "company" ? <AccountProfileCompanyTab onCompanySaved={() => void handleCompanySaved()} /> : null}
            {profileTab === "pin" ? <AccountProfilePinTab active={profileTab === "pin"} /> : null}
            {profileTab === "security" ? <AccountProfileSecurityTab onOpenPinTab={() => setProfileTab("pin")} /> : null}
            {profileTab === "license" ? <AccountProfileLicenseTab onOpenSettings={onOpenSettings} /> : null}
          </div>
        </section>

        <section className="account-profile-column" aria-labelledby="account-col-app-title">
          <div className="account-profile-column-tab is-active" id="account-col-app-title">
            Uygulama
          </div>
          <div className="account-profile-column-body">
            <AccountProfileAppColumn
              onOpenSettings={onOpenSettings}
              onOpenPinTab={() => setProfileTab("pin")}
            />
          </div>
        </section>

        <section className="account-profile-column" aria-labelledby="account-col-feedback-title">
          <div className="account-profile-column-tab is-active" id="account-col-feedback-title">
            Gorusler
          </div>
          <div className="account-profile-column-body">
            <AccountProfileFeedbackTab user={user} companyName={companyName} feedbackConfigured={feedbackConfigured} />
            <AccountProfileLegalSupportCard onOpenLegal={onOpenLegal} />
          </div>
        </section>
      </div>
    </div>
  );
}
