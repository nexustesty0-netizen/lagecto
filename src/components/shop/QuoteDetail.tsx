"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ReceiptDocument } from "@/components/receipts/ReceiptDocument";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { shopWhatsAppUrl, CONTACT } from "@/lib/brand";
import { buildReceiptHtml } from "@/lib/receipts/templates";
import { saveReceiptAsImage, saveReceiptAsPdf } from "@/lib/receipts/export-file";
import { quotationAsReceipt, whatsappQuotationText, type QuotationRecord } from "@/lib/quotations";

export function QuoteDetail({ quote }: { quote: QuotationRecord }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const view = quotationAsReceipt(quote);

  function printQuote() {
    const html = buildReceiptHtml(view);
    const popup = window.open("", "_blank");
    if (!popup) return;
    popup.document.write(html);
    popup.document.close();
    popup.focus();
    popup.print();
  }

  async function saveFile(kind: "image" | "pdf") {
    setNotice(kind === "pdf" ? "Saving PDF…" : "Saving image…");
    try {
      if (kind === "pdf") await saveReceiptAsPdf(view);
      else await saveReceiptAsImage(view);
      setNotice(kind === "pdf" ? "PDF saved." : "Image saved.");
    } catch {
      setNotice("Unable to save this quotation as a file. Use Print and choose Save as PDF.");
    }
  }

  async function remove() {
    const res = await fetch("/api/shop/quotations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id: quote.id }),
    });
    const data = await res.json();
    setPending(false);
    if (!res.ok) {
      setNotice(data.error || "Unable to delete this quotation.");
      return;
    }
    router.push("/shop/quotations");
    router.refresh();
  }

  const text = whatsappQuotationText(quote);
  const whatsapp = shopWhatsAppUrl(view.shop_details?.phone, text) || `${CONTACT.whatsappUrl}?text=${encodeURIComponent(text)}`;

  return (
    <article className="mx-auto max-w-3xl">
      <ReceiptDocument receipt={view} />
      <div className="no-print mt-4 flex flex-wrap gap-2">
        <button onClick={printQuote} className="rounded-full bg-[#0B6E4F] px-4 py-2 text-white">
          Print
        </button>
        <button type="button" onClick={() => void saveFile("image")} className="rounded-full border px-4 py-2">
          Save as image
        </button>
        <button type="button" onClick={() => void saveFile("pdf")} className="rounded-full border px-4 py-2">
          Save as PDF
        </button>
        <Link href={`/shop/quotations/${quote.id}/edit`} className="rounded-full border px-4 py-2">
          Edit
        </Link>
        <a className="rounded-full bg-[#25D366] px-4 py-2 text-white" href={whatsapp} target="_blank" rel="noreferrer">
          WhatsApp
        </a>
        <button type="button" className="rounded-full border px-4 py-2 text-red-700" onClick={() => setPending(true)}>
          Delete
        </button>
      </div>
      {notice ? <p className="mt-2 text-sm text-[#0B6E4F]">{notice}</p> : null}
      <ConfirmDialog
        open={pending}
        title="Delete this quotation?"
        body="It will be removed. This does not affect sales or receipts."
        onCancel={() => setPending(false)}
        onConfirm={() => void remove()}
      />
    </article>
  );
}
