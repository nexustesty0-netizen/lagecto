"use client";

import { money } from "@/lib/format";
import { paymentMethodLabel } from "@/lib/payments/methods";
import {
  formatReceiptDate,
  maxWidthForSize,
  resolveReceiptTheme,
  shopDocumentCopy,
  uniqueShopContacts,
  type ReceiptView as ReceiptData,
  type ReceiptTheme,
  type UniqueShopContact,
} from "@/lib/receipts";

function Logo({
  shop,
  theme,
  size = 56,
}: {
  shop: ReceiptData["shop_details"];
  theme: ReceiptTheme;
  size?: number;
}) {
  if (shop?.show_logo === false) return null;
  if (shop?.logo_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={shop.logo_url}
        alt={shop.name || "Shop logo"}
        crossOrigin="anonymous"
        className="rounded-2xl object-contain"
        style={{ width: size, height: size }}
      />
    );
  }
  const initials = String(shop?.name || "Shop")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  return (
    <div
      className="grid place-items-center rounded-full text-sm font-semibold tracking-widest"
      style={{ width: size, height: size, background: theme.primary, color: theme.onPrimary }}
    >
      {initials || "LG"}
    </div>
  );
}

function Totals({ receipt, theme, boxed }: { receipt: ReceiptData; theme: ReceiptTheme; boxed?: boolean }) {
  const discount = Number(receipt.discount || 0);
  const tax = Number(receipt.tax || 0);
  const showSubtotal = Number(receipt.subtotal) && Number(receipt.subtotal) !== Number(receipt.total);
  return (
    <div className={`ml-auto mt-4 w-full max-w-xs space-y-1 text-sm ${boxed ? "rounded-xl border p-3" : ""}`} style={boxed ? { borderColor: `${theme.primary}33` } : undefined}>
      {showSubtotal ? (
        <p className="flex justify-between" style={{ color: theme.muted }}>
          <span>Subtotal</span>
          <span>{money(receipt.subtotal)}</span>
        </p>
      ) : null}
      {discount ? (
        <p className="flex justify-between" style={{ color: theme.muted }}>
          <span>Discount</span>
          <span>-{money(discount)}</span>
        </p>
      ) : null}
      {tax ? (
        <p className="flex justify-between" style={{ color: theme.muted }}>
          <span>Tax</span>
          <span>{money(tax)}</span>
        </p>
      ) : null}
      <p className="flex justify-between border-t pt-3 text-lg font-semibold" style={{ borderColor: theme.accent, color: theme.primary }}>
        <span>Total</span>
        <span>{money(receipt.total)}</span>
      </p>
    </div>
  );
}

function ItemsTable({
  receipt,
  theme,
  numbered,
  headFill,
}: {
  receipt: ReceiptData;
  theme: ReceiptTheme;
  numbered?: boolean;
  headFill?: boolean;
}) {
  return (
    <table className="mt-5 w-full text-sm">
      <thead>
        <tr style={{ background: headFill ? theme.primary : "transparent", color: headFill ? theme.onPrimary : theme.muted }}>
          {numbered ? <th className="px-2 py-2 text-left font-medium">No.</th> : null}
          <th className="px-2 py-2 text-left font-medium">Description</th>
          <th className="px-2 py-2 text-center font-medium">Qty</th>
          {theme.template !== "compact" ? <th className="px-2 py-2 text-right font-medium">Unit price</th> : null}
          <th className="px-2 py-2 text-right font-medium">Amount</th>
        </tr>
      </thead>
      <tbody>
        {receipt.items.map((item, index) => (
          <tr key={`${item.product_name}-${index}`} className="border-b" style={{ borderColor: `${theme.primary}22` }}>
            {numbered ? <td className="px-2 py-2">{index + 1}</td> : null}
            <td className="px-2 py-2">{item.product_name}</td>
            <td className="px-2 py-2 text-center">{item.quantity}</td>
            {theme.template !== "compact" ? <td className="px-2 py-2 text-right">{money(item.unit_price)}</td> : null}
            <td className="px-2 py-2 text-right">{money(item.total_price)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function NotesBlock({ receipt, theme }: { receipt: ReceiptData; theme: ReceiptTheme }) {
  const hasExtra = receipt.cashier_name || receipt.time_taken || receipt.notes || receipt.provider_transaction_id;
  if (!hasExtra) return null;
  return (
    <div className="mt-6 text-sm" style={{ color: theme.muted }}>
      <p className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: theme.primary }}>
        Notes
      </p>
      {receipt.cashier_name ? <p className="mt-1">Served by {receipt.cashier_name}</p> : null}
      {receipt.time_taken ? <p>Time taken: {receipt.time_taken}</p> : null}
      {receipt.notes ? <p>{receipt.notes}</p> : null}
      {receipt.provider_transaction_id ? <p>Ref {receipt.provider_transaction_id}</p> : null}
    </div>
  );
}

function ContactOnce({
  contact,
  show,
  theme,
  intro,
}: {
  contact: UniqueShopContact;
  show: boolean;
  theme: ReceiptTheme;
  intro?: string;
}) {
  if (!show) return null;
  const lines = [contact.phone, contact.email, contact.website].filter(Boolean);
  if (!lines.length) return null;
  return (
    <p className="mt-5 text-sm leading-6" style={{ color: theme.muted }}>
      {intro || "For questions or support, contact"} {lines.join(" · ")}
    </p>
  );
}

function CompanyAddress({ contact, theme }: { contact: UniqueShopContact; theme: ReceiptTheme }) {
  if (!contact.address) return null;
  return (
    <p className="whitespace-pre-line text-sm leading-5" style={{ color: theme.muted }}>
      {contact.address}
    </p>
  );
}

export function ReceiptDocument({ receipt }: { receipt: ReceiptData }) {
  const theme = resolveReceiptTheme(receipt.shop_details);
  const shop = receipt.shop_details || {};
  const contact = uniqueShopContacts(shop);
  const showContact = shop.show_contact !== false;
  const width = maxWidthForSize(theme.size);
  const date = formatReceiptDate(receipt.created_at);
  const copy = shopDocumentCopy(receipt);
  const pay =
    receipt.documentKind === "quotation"
      ? formatReceiptDate(receipt.valid_until)
      : paymentMethodLabel(receipt.payment_method);
  const template = theme.kind === "platform" ? "premium" : theme.template;

  return (
    <article
      data-receipt-paper
      className="mx-auto overflow-hidden rounded-[28px] border bg-white shadow-[0_18px_50px_rgba(18,36,28,0.08)]"
      style={{
        maxWidth: width,
        background: theme.paper,
        color: theme.text,
        borderColor: `${theme.primary}22`,
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      {template === "classic" ? (
        <div className="px-8 py-8">
          <div className="flex items-start justify-between gap-6">
            <div>
              <h1 className="text-xl font-semibold">{contact.name || "Shop"}</h1>
              <CompanyAddress contact={contact} theme={theme} />
              {shop.header ? <p className="mt-2 text-sm" style={{ color: theme.muted }}>{shop.header}</p> : null}
            </div>
            <Logo shop={shop} theme={theme} size={72} />
          </div>
          <p className="mt-8 text-right text-3xl font-semibold tracking-[0.12em]" style={{ color: theme.primary }}>
            {copy.title}
          </p>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: theme.primary }}>
                Billed to
              </p>
              <p className="mt-1 font-semibold">{receipt.customer_name || "Walk-in customer"}</p>
              {receipt.customer_phone || receipt.customer_email ? (
                <p className="text-sm" style={{ color: theme.muted }}>
                  {[receipt.customer_phone, receipt.customer_email].filter(Boolean).join(" · ")}
                </p>
              ) : null}
            </div>
            <div className="text-sm sm:text-right">
              <p>
                <span className="font-semibold" style={{ color: theme.primary }}>{copy.numberLabel}</span> {receipt.receipt_number}
              </p>
              <p className="mt-1">
                <span className="font-semibold" style={{ color: theme.primary }}>{copy.dateLabel}</span> {date}
              </p>
              <p className="mt-1">
                <span className="font-semibold" style={{ color: theme.primary }}>{copy.payLabel}</span> {pay}
              </p>
            </div>
          </div>
          <ItemsTable receipt={receipt} theme={theme} headFill />
          <Totals receipt={receipt} theme={theme} />
          <NotesBlock receipt={receipt} theme={theme} />
          {shop.footer ? <p className="mt-6 text-sm" style={{ color: theme.muted }}>{shop.footer}</p> : null}
          <ContactOnce contact={contact} show={showContact} theme={theme} />
        </div>
      ) : null}

      {template === "modern" ? (
        <>
          <header className="flex items-start justify-between gap-4 px-8 py-7" style={{ background: theme.primary, color: theme.onPrimary }}>
            <div>
              <p className="text-3xl font-semibold tracking-[0.08em]">{copy.title}</p>
              <p className="mt-3 text-sm opacity-90">{copy.numberLong}</p>
              <p className="font-semibold">{receipt.receipt_number}</p>
              <p className="mt-3 text-sm opacity-90">Date</p>
              <p className="font-semibold">{date}</p>
            </div>
            <div className="text-right">
              <Logo shop={shop} theme={{ ...theme, primary: theme.onPrimary, onPrimary: theme.primary }} size={56} />
              <p className="mt-2 text-sm font-semibold">{contact.name || "Shop"}</p>
            </div>
          </header>
          <div className="px-8 py-6">
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: theme.primary }}>
                  From
                </p>
                <p className="mt-1 font-semibold">{contact.name || "Shop"}</p>
                <CompanyAddress contact={contact} theme={theme} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: theme.primary }}>
                  Billed to
                </p>
                <p className="mt-1 font-semibold">{receipt.customer_name || "Walk-in customer"}</p>
                {receipt.customer_phone || receipt.customer_email ? (
                  <p className="text-sm" style={{ color: theme.muted }}>
                    {[receipt.customer_phone, receipt.customer_email].filter(Boolean).join(" · ")}
                  </p>
                ) : null}
              </div>
            </div>
            <ItemsTable receipt={receipt} theme={theme} headFill />
            <Totals receipt={receipt} theme={theme} />
            <NotesBlock receipt={receipt} theme={theme} />
            {shop.footer ? <p className="mt-6 text-sm" style={{ color: theme.muted }}>{shop.footer}</p> : null}
            <ContactOnce contact={contact} show={showContact} theme={theme} />
          </div>
        </>
      ) : null}

      {template === "minimal" ? (
        <div className="px-8 py-8">
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-4xl font-semibold tracking-[0.08em]" style={{ color: theme.primary }}>
              {copy.title}
            </h1>
            <Logo shop={shop} theme={theme} size={64} />
          </div>
          <div className="mt-5 flex flex-wrap justify-between gap-3 rounded-md px-4 py-2 text-sm font-semibold" style={{ background: `${theme.primary}22`, color: theme.primary }}>
            <span>{copy.orderLabel} {receipt.receipt_number}</span>
            <span>Date: {date}</span>
          </div>
          <div className="mt-6 grid gap-6 sm:grid-cols-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: theme.muted }}>
                {contact.name || "Shop"}
              </p>
              <CompanyAddress contact={contact} theme={theme} />
              {showContact ? (
                <div className="mt-2 text-sm" style={{ color: theme.muted }}>
                  {contact.phone ? <p>{contact.phone}</p> : null}
                  {contact.email ? <p>{contact.email}</p> : null}
                  {contact.website ? <p>{contact.website}</p> : null}
                </div>
              ) : null}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: theme.muted }}>
                Billed to
              </p>
              <p className="mt-1 font-semibold">{receipt.customer_name || "Walk-in customer"}</p>
              {receipt.customer_phone ? <p className="text-sm" style={{ color: theme.muted }}>{receipt.customer_phone}</p> : null}
              {receipt.customer_email ? <p className="text-sm" style={{ color: theme.muted }}>{receipt.customer_email}</p> : null}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: theme.muted }}>
                {copy.payMethodLabel}
              </p>
              <p className="mt-1 font-semibold">{pay}</p>
              {receipt.payment_status ? <p className="text-sm capitalize" style={{ color: theme.muted }}>{receipt.payment_status}</p> : null}
            </div>
          </div>
          <ItemsTable receipt={receipt} theme={theme} numbered />
          <Totals receipt={receipt} theme={theme} />
          <NotesBlock receipt={receipt} theme={theme} />
          {shop.footer ? <p className="mt-6 text-sm" style={{ color: theme.muted }}>{shop.footer}</p> : null}
          <p className="mt-10 text-center text-lg tracking-[0.2em]" style={{ color: theme.muted }}>
            {copy.thanks}
          </p>
        </div>
      ) : null}

      {template === "premium" ? (
        <div className="px-8 py-8">
          <div className="flex items-start justify-between gap-4 border-b pb-5" style={{ borderColor: `${theme.primary}22` }}>
            <div>
              <h1 className="text-3xl font-semibold tracking-[0.12em]" style={{ color: theme.primary }}>
                {copy.title}
              </h1>
              <p className="mt-2 text-sm" style={{ color: theme.muted }}>
                No. {receipt.receipt_number}
              </p>
              <p className="text-sm" style={{ color: theme.muted }}>
                Date: {date}
              </p>
            </div>
            <Logo shop={shop} theme={theme} size={64} />
          </div>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: theme.muted }}>
                From
              </p>
              <p className="mt-1 font-semibold">{contact.name || "Shop"}</p>
              <CompanyAddress contact={contact} theme={theme} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: theme.muted }}>
                Bill to
              </p>
              <p className="mt-1 font-semibold">{receipt.customer_name || "Walk-in customer"}</p>
              {receipt.customer_phone || receipt.customer_email ? (
                <p className="text-sm" style={{ color: theme.muted }}>
                  {[receipt.customer_phone, receipt.customer_email].filter(Boolean).join(" · ")}
                </p>
              ) : null}
            </div>
          </div>
          <ItemsTable receipt={receipt} theme={theme} numbered />
          <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-xs text-sm" style={{ color: theme.muted }}>
              {shop.footer ? <p>{shop.footer}</p> : <p>{copy.footerThanks}</p>}
              <NotesBlock receipt={receipt} theme={theme} />
            </div>
            <Totals receipt={receipt} theme={theme} boxed />
          </div>
          <ContactOnce contact={contact} show={showContact} theme={theme} />
        </div>
      ) : null}

      {template === "compact" ? (
        <div className="px-5 py-5">
          <div className="text-center">
            <div className="flex justify-center">
              <Logo shop={shop} theme={theme} size={40} />
            </div>
            <h1 className="mt-2 font-semibold">{contact.name || "Shop"}</h1>
            <p className="text-xs" style={{ color: theme.muted }}>
              {receipt.receipt_number}
            </p>
            <p className="text-xs" style={{ color: theme.muted }}>
              Date: {date}
            </p>
          </div>
          {receipt.customer_name ? (
            <p className="mt-3 text-center text-xs" style={{ color: theme.muted }}>
              {receipt.customer_name}
            </p>
          ) : null}
          <ItemsTable receipt={receipt} theme={theme} />
          <Totals receipt={receipt} theme={theme} />
          <p className="mt-3 text-center text-xs" style={{ color: theme.muted }}>
            {pay}
          </p>
          <NotesBlock receipt={receipt} theme={theme} />
          {shop.footer ? <p className="mt-3 text-center text-xs" style={{ color: theme.muted }}>{shop.footer}</p> : null}
          <ContactOnce contact={contact} show={showContact} theme={theme} intro="Questions?" />
        </div>
      ) : null}

      <p className="px-8 pb-6 text-center text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: theme.muted }}>
        {theme.kind === "platform" ? "LaGecto Platform" : copy.powered}
      </p>
    </article>
  );
}
