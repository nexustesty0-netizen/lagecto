"use client";

import { useMemo, useState } from "react";
import { contrastRatio } from "@/lib/storefront/theme";
import {
  RECEIPT_HEADER_LAYOUTS,
  RECEIPT_SIZES,
  RECEIPT_TEMPLATES,
  designFromShop,
  type ReceiptDesign,
  type ReceiptView,
} from "@/lib/receipts";
import { ReceiptDocument } from "@/components/receipts/ReceiptDocument";

const TEMPLATE_LABELS: Record<(typeof RECEIPT_TEMPLATES)[number], { name: string; hint: string }> = {
  classic: { name: "Invoice", hint: "Company left, billed to, receipt number and date, navy table" },
  modern: { name: "Banner", hint: "Colored header with receipt number and date" },
  minimal: { name: "Studio", hint: "Order bar, company / billed to / payment, thank you" },
  premium: { name: "Ledger", hint: "Bill to, numbered items, boxed grand total" },
  compact: { name: "Till slip", hint: "Compact POS slip with date and one contact line" },
};

export function ReceiptDesigner({
  shopName,
  logoUrl,
  initial,
  contact,
}: {
  shopName: string;
  logoUrl: string | null;
  initial: ReceiptDesign;
  contact?: { address?: string | null; phone?: string | null; email?: string | null; whatsapp?: string | null; website?: string | null };
}) {
  const [design, setDesign] = useState(initial);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const preview = useMemo<ReceiptView>(
    () => ({
      receipt_number: "R-PREVIEW-00001",
      created_at: "2026-09-10T10:00:00.000Z",
      customer_name: "Customer Name",
      customer_email: "customer@example.com",
      customer_phone: "+263 77 000 0000",
      payment_method: "cash",
      payment_status: "paid",
      subtotal: 240,
      discount: 0,
      tax: 12,
      total: 252,
      shop_details: {
        kind: "shop",
        name: shopName,
        logo_url: logoUrl || undefined,
        template: design.template,
        primary: design.primary,
        secondary: design.secondary,
        accent: design.accent,
        background: design.background,
        header: design.header || undefined,
        footer: design.footerMessage || undefined,
        header_layout: design.headerLayout,
        size: design.size,
        show_logo: design.showLogo,
        show_contact: design.showContact,
        address: contact?.address || undefined,
        phone: contact?.phone || undefined,
        email: contact?.email || undefined,
        whatsapp: contact?.whatsapp || undefined,
        website: contact?.website || undefined,
      },
      items: [
        { product_name: "Custom product/service A", quantity: 2, unit_price: 45, total_price: 90 },
        { product_name: "Product/service B", quantity: 1, unit_price: 75, total_price: 75 },
        { product_name: "Product/service C", quantity: 3, unit_price: 20, total_price: 60 },
        { product_name: "Handling/shipping fee", quantity: 1, unit_price: 15, total_price: 15 },
      ],
    }),
    [contact, design, logoUrl, shopName],
  );

  const textOnBg = contrastRatio("#12241C", design.background);
  const warning = textOnBg < 4.5;

  function patch(next: Partial<ReceiptDesign>) {
    setDesign((current) => ({ ...current, ...next }));
  }

  async function save() {
    setSaving(true);
    setMessage("");
    const res = await fetch("/api/shop/receipts/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(design),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) setMessage(data.error || "Unable to save this receipt design.");
    else if (data.warning === "low_contrast") {
      setMessage("Saved. Contrast was low — printed receipts will automatically use readable text.");
    } else {
      setMessage("Receipt design saved. New receipts will use this look.");
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
      <form
        className="lg-card grid gap-4 p-5"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#D4AF37]">Receipt settings</p>
          <h2 className="mt-1 text-lg font-semibold">Template</h2>
        </div>
        <div className="grid gap-2">
          {RECEIPT_TEMPLATES.map((template) => (
            <label key={template} className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm">
              <input
                type="radio"
                name="template"
                checked={design.template === template}
                onChange={() => patch({ template })}
              />
              <span>
                <span className="font-medium">{TEMPLATE_LABELS[template].name}</span>
                <span className="mt-0.5 block text-xs text-[#6B7280]">{TEMPLATE_LABELS[template].hint}</span>
              </span>
            </label>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            Primary
            <input type="color" className="mt-1 h-10 w-full" value={design.primary} onChange={(e) => patch({ primary: e.target.value })} />
          </label>
          <label className="text-sm">
            Secondary
            <input type="color" className="mt-1 h-10 w-full" value={design.secondary} onChange={(e) => patch({ secondary: e.target.value })} />
          </label>
          <label className="text-sm">
            Accent
            <input type="color" className="mt-1 h-10 w-full" value={design.accent} onChange={(e) => patch({ accent: e.target.value })} />
          </label>
          <label className="text-sm">
            Background
            <input type="color" className="mt-1 h-10 w-full" value={design.background} onChange={(e) => patch({ background: e.target.value })} />
          </label>
        </div>
        {warning ? (
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Dark text on this background is below WCAG contrast. Print view will automatically switch to readable text.
          </p>
        ) : null}
        <label className="text-sm">
          Header layout
          <select className="mt-1 w-full rounded-xl border px-3 py-2" value={design.headerLayout} onChange={(e) => patch({ headerLayout: e.target.value as ReceiptDesign["headerLayout"] })}>
            {RECEIPT_HEADER_LAYOUTS.map((layout) => (
              <option key={layout} value={layout}>
                {layout}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Receipt size
          <select className="mt-1 w-full rounded-xl border px-3 py-2" value={design.size} onChange={(e) => patch({ size: e.target.value as ReceiptDesign["size"] })}>
            {RECEIPT_SIZES.map((size) => (
              <option key={size} value={size}>
                {size === "a4" ? "Standard" : size === "thermal80" ? "80mm POS" : "58mm POS"}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Business header
          <input className="mt-1 w-full rounded-xl border px-3 py-2" value={design.header} onChange={(e) => patch({ header: e.target.value })} placeholder="Thank you for shopping with us" />
        </label>
        <label className="text-sm">
          Footer message
          <input className="mt-1 w-full rounded-xl border px-3 py-2" value={design.footerMessage} onChange={(e) => patch({ footerMessage: e.target.value })} placeholder="Returns within 7 days" />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={design.showLogo} onChange={(e) => patch({ showLogo: e.target.checked })} />
          Show logo (uses your storefront logo)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={design.showContact} onChange={(e) => patch({ showContact: e.target.checked })} />
          Show contact details
        </label>
        <button disabled={saving} className="rounded-full bg-[#0B6E4F] px-4 py-2 text-white">
          {saving ? "Saving…" : "Save receipt design"}
        </button>
        {message ? <p className="text-sm text-[#0B6E4F]">{message}</p> : null}
      </form>
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#D4AF37]">Live preview</p>
        <ReceiptDocument receipt={preview} />
      </div>
    </div>
  );
}

export { designFromShop };
