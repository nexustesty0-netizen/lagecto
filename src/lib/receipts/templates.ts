import { paymentMethodLabel } from "@/lib/payments/methods";
import {
  escapeHtml,
  formatReceiptDate,
  maxWidthForSize,
  resolveReceiptTheme,
  shopDocumentCopy,
  uniqueShopContacts,
  type ReceiptView,
  type UniqueShopContact,
} from "@/lib/receipts";

function copy(receipt: ReceiptView) {
  return shopDocumentCopy(receipt);
}

function payValue(receipt: ReceiptView) {
  if (receipt.documentKind === "quotation") return formatReceiptDate(receipt.valid_until);
  return paymentMethodLabel(receipt.payment_method);
}

function money(value: number) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function logoBlock(receipt: ReceiptView, size = 56) {
  const shop = receipt.shop_details || {};
  if (shop.show_logo === false) return "";
  if (shop.logo_url) {
    return `<img src="${escapeHtml(shop.logo_url)}" alt="${escapeHtml(shop.name || "Shop")}" crossorigin="anonymous" style="width:${size}px;height:${size}px;object-fit:contain;border-radius:12px" />`;
  }
  const initials = escapeHtml(
    String(shop.name || "Shop")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "LG",
  );
  const theme = resolveReceiptTheme(shop);
  return `<div style="width:${size}px;height:${size}px;border-radius:999px;display:flex;align-items:center;justify-content:center;font-weight:700;letter-spacing:1px;background:${theme.primary};color:${theme.onPrimary}">${initials}</div>`;
}

function contactLines(contact: UniqueShopContact) {
  return [contact.phone, contact.email, contact.website].filter(Boolean);
}

function contactFooter(receipt: ReceiptView, intro = "For questions or support, contact") {
  const shop = receipt.shop_details || {};
  if (shop.show_contact === false) return "";
  const lines = contactLines(uniqueShopContacts(shop));
  if (!lines.length) return "";
  return `<p class="muted" style="margin-top:18px">${escapeHtml(intro)} ${lines.map((line) => escapeHtml(line)).join(" · ")}</p>`;
}

function companyAddress(contact: UniqueShopContact) {
  if (!contact.address) return "";
  return `<div class="muted" style="white-space:pre-line">${escapeHtml(contact.address)}</div>`;
}

function itemsTable(
  receipt: ReceiptView,
  theme: ReturnType<typeof resolveReceiptTheme>,
  options?: { numbered?: boolean; compact?: boolean; headFill?: boolean },
) {
  const numbered = Boolean(options?.numbered);
  const compact = Boolean(options?.compact);
  const headFill = Boolean(options?.headFill);
  const rows = receipt.items
    .map(
      (item, index) => `
      <tr>
        ${numbered ? `<td>${index + 1}</td>` : ""}
        <td>${escapeHtml(item.product_name)}</td>
        <td style="text-align:center">${item.quantity}</td>
        ${compact ? "" : `<td style="text-align:right">${money(item.unit_price)}</td>`}
        <td style="text-align:right">${money(item.total_price)}</td>
      </tr>`,
    )
    .join("");
  return `<table>
    <thead><tr style="background:${headFill ? theme.primary : "transparent"};color:${headFill ? theme.onPrimary : theme.muted}">
      ${numbered ? "<th>No.</th>" : ""}
      <th>Description</th>
      <th style="text-align:center">Qty</th>
      ${compact ? "" : '<th style="text-align:right">Unit price</th>'}
      <th style="text-align:right">Amount</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function totals(receipt: ReceiptView, theme: ReturnType<typeof resolveReceiptTheme>, boxed = false) {
  const discount = Number(receipt.discount || 0);
  const tax = Number(receipt.tax || 0);
  const box = boxed
    ? `border:1px solid color-mix(in srgb, ${theme.primary} 20%, transparent);border-radius:12px;padding:12px 14px;`
    : "";
  return `
    <div style="margin-left:auto;margin-top:16px;max-width:240px;${box}">
      ${Number(receipt.subtotal) && Number(receipt.subtotal) !== Number(receipt.total) ? `<div class="row muted"><span>Subtotal</span><span>${money(receipt.subtotal)}</span></div>` : ""}
      ${discount ? `<div class="row muted"><span>Discount</span><span>-${money(discount)}</span></div>` : ""}
      ${tax ? `<div class="row muted"><span>Tax</span><span>${money(tax)}</span></div>` : ""}
      <div class="total"><span>Total</span><span>${money(receipt.total)}</span></div>
    </div>
  `;
}

function notesBlock(receipt: ReceiptView, theme: ReturnType<typeof resolveReceiptTheme>) {
  const bits = [
    receipt.cashier_name ? `Served by ${receipt.cashier_name}` : "",
    receipt.time_taken ? `Time taken: ${receipt.time_taken}` : "",
    receipt.notes || "",
    receipt.provider_transaction_id ? `Ref ${receipt.provider_transaction_id}` : "",
  ].filter(Boolean);
  if (!bits.length) return "";
  return `<div style="margin-top:22px">
    <div style="font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:${theme.primary}">Notes</div>
    ${bits.map((line) => `<div class="muted">${escapeHtml(line)}</div>`).join("")}
  </div>`;
}

function customerBits(receipt: ReceiptView) {
  return [receipt.customer_phone, receipt.customer_email].filter(Boolean).join(" · ");
}

function poweredBy(receipt: ReceiptView) {
  const theme = resolveReceiptTheme(receipt.shop_details);
  if (theme.kind === "platform") {
    return `<div class="lagecto">LaGecto Platform</div>`;
  }
  return `<div class="lagecto">${escapeHtml(copy(receipt).powered)}</div>`;
}

function headerCopy(receipt: ReceiptView) {
  const header = receipt.shop_details?.header;
  return header ? `<div class="muted" style="margin-top:8px">${escapeHtml(header)}</div>` : "";
}

function footerCopy(receipt: ReceiptView) {
  const footer = receipt.shop_details?.footer;
  return footer ? `<div class="muted" style="margin-top:16px">${escapeHtml(footer)}</div>` : "";
}

function wrap(receipt: ReceiptView, css: string, inner: string) {
  const theme = resolveReceiptTheme(receipt.shop_details);
  const width = maxWidthForSize(theme.size);
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Receipt ${escapeHtml(receipt.receipt_number)}</title>
<style>
  body{font-family:Arial,Helvetica,sans-serif;max-width:${width}px;margin:0 auto;padding:28px;color:${theme.text};background:${theme.paper}}
  table{width:100%;border-collapse:collapse;font-size:13px;margin:18px 0 8px}
  th,td{padding:8px 6px;text-align:left}
  td{border-bottom:1px solid color-mix(in srgb, ${theme.primary} 14%, transparent)}
  .muted{color:${theme.muted};font-size:13px;line-height:1.5}
  .row,.total{display:flex;justify-content:space-between;gap:12px}
  .total{font-size:18px;font-weight:700;margin-top:8px;padding-top:8px;border-top:1px solid ${theme.accent};color:${theme.primary}}
  .lagecto{text-align:center;margin-top:22px;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:${theme.muted}}
  ${css}
</style></head><body>${inner}${poweredBy(receipt)}</body></html>`;
}

function classicHtml(receipt: ReceiptView) {
  const theme = resolveReceiptTheme(receipt.shop_details);
  const shop = receipt.shop_details || {};
  const contact = uniqueShopContacts(shop);
  const date = formatReceiptDate(receipt.created_at);
  const labels = copy(receipt);
  const inner = `
    <div style="display:flex;justify-content:space-between;gap:24px;align-items:flex-start">
      <div>
        <div style="font-size:20px;font-weight:700">${escapeHtml(contact.name || "Shop")}</div>
        ${companyAddress(contact)}
        ${headerCopy(receipt)}
      </div>
      ${logoBlock(receipt, 72)}
    </div>
    <div style="text-align:right;margin-top:28px;font-size:28px;font-weight:700;letter-spacing:.12em;color:${theme.primary}">${labels.title}</div>
    <div style="display:flex;justify-content:space-between;gap:24px;margin-top:22px">
      <div>
        <div style="font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:${theme.primary}">Billed to</div>
        <div style="font-weight:700;margin-top:4px">${escapeHtml(receipt.customer_name || "Walk-in customer")}</div>
        ${customerBits(receipt) ? `<div class="muted">${escapeHtml(customerBits(receipt))}</div>` : ""}
      </div>
      <div style="text-align:right">
        <div><span style="font-weight:700;color:${theme.primary}">${escapeHtml(labels.numberLabel)}</span> ${escapeHtml(receipt.receipt_number)}</div>
        <div style="margin-top:4px"><span style="font-weight:700;color:${theme.primary}">${escapeHtml(labels.dateLabel)}</span> ${escapeHtml(date)}</div>
        <div style="margin-top:4px"><span style="font-weight:700;color:${theme.primary}">${escapeHtml(labels.payLabel)}</span> ${escapeHtml(payValue(receipt))}</div>
      </div>
    </div>
    ${itemsTable(receipt, theme, { headFill: true })}
    ${totals(receipt, theme)}
    ${notesBlock(receipt, theme)}
    ${footerCopy(receipt)}
    ${contactFooter(receipt)}
  `;
  return wrap(receipt, "", inner);
}

function modernHtml(receipt: ReceiptView) {
  const theme = resolveReceiptTheme(receipt.shop_details);
  const shop = receipt.shop_details || {};
  const contact = uniqueShopContacts(shop);
  const date = formatReceiptDate(receipt.created_at);
  const labels = copy(receipt);
  const inner = `
    <div style="background:${theme.primary};color:${theme.onPrimary};margin:-28px -28px 0;padding:28px 32px;display:flex;justify-content:space-between;gap:16px">
      <div>
        <div style="font-size:28px;font-weight:700;letter-spacing:.08em">${labels.title}</div>
        <div style="margin-top:14px;opacity:.9;font-size:13px">${escapeHtml(labels.numberLong)}</div>
        <div style="font-weight:700">${escapeHtml(receipt.receipt_number)}</div>
        <div style="margin-top:10px;opacity:.9;font-size:13px">Date</div>
        <div style="font-weight:700">${escapeHtml(date)}</div>
      </div>
      <div style="text-align:right">
        ${logoBlock(receipt, 56)}
        <div style="margin-top:8px;font-weight:700">${escapeHtml(contact.name || "Shop")}</div>
      </div>
    </div>
    <div style="display:flex;justify-content:space-between;gap:24px;margin-top:28px">
      <div>
        <div style="font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:${theme.primary}">From</div>
        <div style="font-weight:700;margin-top:4px">${escapeHtml(contact.name || "Shop")}</div>
        ${companyAddress(contact)}
      </div>
      <div>
        <div style="font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:${theme.primary}">Billed to</div>
        <div style="font-weight:700;margin-top:4px">${escapeHtml(receipt.customer_name || "Walk-in customer")}</div>
        ${customerBits(receipt) ? `<div class="muted">${escapeHtml(customerBits(receipt))}</div>` : ""}
      </div>
    </div>
    ${itemsTable(receipt, theme, { headFill: true })}
    ${totals(receipt, theme)}
    ${notesBlock(receipt, theme)}
    ${footerCopy(receipt)}
    ${contactFooter(receipt)}
  `;
  return wrap(receipt, "", inner);
}

function minimalHtml(receipt: ReceiptView) {
  const theme = resolveReceiptTheme(receipt.shop_details);
  const shop = receipt.shop_details || {};
  const contact = uniqueShopContacts(shop);
  const date = formatReceiptDate(receipt.created_at);
  const showContact = shop.show_contact !== false;
  const contactHtml = showContact
    ? contactLines(contact)
        .map((line) => `<div class="muted">${escapeHtml(line)}</div>`)
        .join("")
    : "";
  const inner = `
    <div style="display:flex;justify-content:space-between;gap:16px;align-items:flex-start">
      <div style="font-size:34px;font-weight:700;letter-spacing:.08em;color:${theme.primary}">${copy(receipt).title}</div>
      ${logoBlock(receipt, 64)}
    </div>
    <div style="margin-top:18px;background:color-mix(in srgb, ${theme.primary} 16%, transparent);color:${theme.primary};padding:8px 14px;display:flex;justify-content:space-between;font-weight:700;font-size:13px;border-radius:6px">
      <span>${escapeHtml(copy(receipt).orderLabel)} ${escapeHtml(receipt.receipt_number)}</span>
      <span>Date: ${escapeHtml(date)}</span>
    </div>
    <div style="display:flex;gap:24px;margin-top:22px">
      <div style="flex:1">
        <div style="font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:${theme.muted}">${escapeHtml(contact.name || "Shop")}</div>
        ${companyAddress(contact)}
        ${contactHtml}
      </div>
      <div style="flex:1">
        <div style="font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:${theme.muted}">Billed to</div>
        <div style="font-weight:700;margin-top:4px">${escapeHtml(receipt.customer_name || "Walk-in customer")}</div>
        ${receipt.customer_phone ? `<div class="muted">${escapeHtml(receipt.customer_phone)}</div>` : ""}
        ${receipt.customer_email ? `<div class="muted">${escapeHtml(receipt.customer_email)}</div>` : ""}
      </div>
      <div style="flex:1">
        <div style="font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:${theme.muted}">${escapeHtml(copy(receipt).payMethodLabel)}</div>
        <div style="font-weight:700;margin-top:4px">${escapeHtml(payValue(receipt))}</div>
        ${receipt.payment_status ? `<div class="muted">${escapeHtml(receipt.payment_status)}</div>` : ""}
      </div>
    </div>
    ${itemsTable(receipt, theme, { numbered: true })}
    ${totals(receipt, theme)}
    ${notesBlock(receipt, theme)}
    ${footerCopy(receipt)}
    <div style="text-align:center;margin-top:36px;letter-spacing:.2em;font-size:16px;color:${theme.muted}">${escapeHtml(copy(receipt).thanks)}</div>
  `;
  return wrap(receipt, `th{border-bottom:1px solid ${theme.primary}}`, inner);
}

function premiumHtml(receipt: ReceiptView) {
  const theme = resolveReceiptTheme(receipt.shop_details);
  const shop = receipt.shop_details || {};
  const contact = uniqueShopContacts(shop);
  const date = formatReceiptDate(receipt.created_at);
  const inner = `
    <div style="display:flex;justify-content:space-between;gap:16px;padding-bottom:18px;border-bottom:1px solid color-mix(in srgb, ${theme.primary} 18%, transparent)">
      <div>
        <div style="font-size:28px;font-weight:700;letter-spacing:.12em;color:${theme.primary}">${copy(receipt).title}</div>
        <div class="muted" style="margin-top:8px">No. ${escapeHtml(receipt.receipt_number)}</div>
        <div class="muted">Date: ${escapeHtml(date)}</div>
      </div>
      ${logoBlock(receipt, 64)}
    </div>
    <div style="display:flex;justify-content:space-between;gap:24px;margin-top:22px">
      <div>
        <div style="font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:${theme.muted}">From</div>
        <div style="font-weight:700;margin-top:4px">${escapeHtml(contact.name || "Shop")}</div>
        ${companyAddress(contact)}
      </div>
      <div>
        <div style="font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:${theme.muted}">Bill to</div>
        <div style="font-weight:700;margin-top:4px">${escapeHtml(receipt.customer_name || "Walk-in customer")}</div>
        ${customerBits(receipt) ? `<div class="muted">${escapeHtml(customerBits(receipt))}</div>` : ""}
      </div>
    </div>
    ${itemsTable(receipt, theme, { numbered: true })}
    <div style="display:flex;justify-content:space-between;gap:24px;align-items:flex-end;margin-top:8px">
      <div style="max-width:260px">
        ${shop.footer ? `<div class="muted">${escapeHtml(shop.footer)}</div>` : `<div class="muted">${escapeHtml(copy(receipt).footerThanks)}</div>`}
        ${notesBlock(receipt, theme)}
      </div>
      ${totals(receipt, theme, true)}
    </div>
    ${contactFooter(receipt)}
  `;
  return wrap(receipt, "", inner);
}

function compactHtml(receipt: ReceiptView) {
  const theme = resolveReceiptTheme(receipt.shop_details);
  const date = formatReceiptDate(receipt.created_at);
  const shopName = uniqueShopContacts(receipt.shop_details).name;
  const inner = `
    <div style="text-align:center">
      ${logoBlock(receipt, 40)}
      <div style="font-weight:700;margin-top:8px">${escapeHtml(shopName || "Shop")}</div>
      <div class="muted" style="font-size:11px">${escapeHtml(receipt.receipt_number)}</div>
      <div class="muted" style="font-size:11px">Date: ${escapeHtml(date)}</div>
    </div>
    ${receipt.customer_name ? `<div class="muted" style="text-align:center;margin-top:10px">${escapeHtml(receipt.customer_name)}</div>` : ""}
    ${itemsTable(receipt, theme, { compact: true })}
    ${totals(receipt, theme)}
    <div class="muted" style="text-align:center">${escapeHtml(payValue(receipt))}</div>
    ${notesBlock(receipt, theme)}
    ${footerCopy(receipt)}
    ${contactFooter(receipt, "Questions?")}
  `;
  return wrap(
    receipt,
    `body{padding:16px;font-size:12px} table{font-size:12px} .total{font-size:15px}`,
    inner,
  );
}

export function buildReceiptHtml(receipt: ReceiptView) {
  const theme = resolveReceiptTheme(receipt.shop_details);
  if (theme.kind === "platform") {
    return premiumHtml({ ...receipt, shop_details: { ...receipt.shop_details, kind: "platform", template: "premium" } });
  }
  if (theme.template === "modern") return modernHtml(receipt);
  if (theme.template === "minimal") return minimalHtml(receipt);
  if (theme.template === "premium") return premiumHtml(receipt);
  if (theme.template === "compact") return compactHtml(receipt);
  return classicHtml(receipt);
}
