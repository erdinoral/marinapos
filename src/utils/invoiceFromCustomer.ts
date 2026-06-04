import type { Customer, InvoiceCustomerInfo } from "../types/models";

/** POS musteri kartindan fatura formuna (tum alanlar opsiyonel bos kalabilir) */
export function invoiceInfoFromCustomer(c: Customer): InvoiceCustomerInfo {
  return {
    fullName: c.name.trim(),
    companyName: c.companyName.trim() || undefined,
    tcOrVkn: c.taxOrVkn.trim(),
    phone: c.phone.trim(),
    email: c.email.trim(),
    address: c.address.trim(),
    city: c.city.trim(),
    district: c.district.trim()
  };
}
