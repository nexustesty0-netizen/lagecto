"use client";

import { shopWhatsAppUrl, CONTACT } from "@/lib/brand";
import { buildReceiptHtml } from "@/lib/receipts/templates";
import { whatsappReceiptText, type ReceiptView as ReceiptData } from "@/lib/receipts";
import { saveReceiptAsImage, saveReceiptAsPdf } from "@/lib/receipts/export-file";
import { ReceiptDocument } from "@/components/receipts/ReceiptDocument";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function ReceiptView({
  receipt,
  backHref,
  canManage = false,
}: {
  receipt: ReceiptData & { id?: string; customer_id?: string | null };
  backHref: string;
  canManage?: boolean;
}) {
  const router = useRouter();
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const [saving, setSaving] = useState(false);

  function printReceipt() {
    const html = buildReceiptHtml(receipt);
    const popup = window.open("", "_blank");
    if (!popup) return;
    popup.document.write(html);
    popup.document.close();
    popup.focus();
    popup.print();
  }

  async function saveFile(kind: "image" | "pdf") {
    if (saving) return;
    setSaving(true);
    setNotice(kind === "pdf" ? "Saving PDF…" : "Saving image…");
    try {
      if (kind === "pdf") await saveReceiptAsPdf(receipt);
      else await saveReceiptAsImage(receipt);
      setNotice(kind === "pdf" ? "PDF saved." : "Image saved.");
    } catch {
      setNotice("Unable to save this receipt as a file. Use Print and choose Save as PDF.");
    } finally {
      setSaving(false);
    }
  }

  async function sendInApp() {
    if (!receipt.id) return;
    const res = await fetch("/api/receipts/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ receiptId: receipt.id }),
    });
    const data = await res.json();
    setNotice(data.error || "Receipt sent to the customer in LaGecto.");
  }

  async function shareReceipt() {
    const text = whatsappReceiptText(receipt);
    if (navigator.share) {
      await navigator.share({ title: receipt.receipt_number, text });
      return;
    }
    window.open(`${CONTACT.whatsappUrl}?text=${encodeURIComponent(text)}`, "_blank");
  }

  const whatsapp = shopWhatsAppUrl(receipt.shop_details?.phone, whatsappReceiptText(receipt)) || `${CONTACT.whatsappUrl}?text=${encodeURIComponent(whatsappReceiptText(receipt))}`;

  return (
    <article className="mx-auto max-w-3xl">
      <Link href={backHref} className="no-print text-sm text-[#0B6E4F]">
        Back
      </Link>
      <div className="mt-4">
        <ReceiptDocument receipt={receipt} />
      </div>
      <div className="no-print mt-4 flex flex-wrap gap-2">
        <button onClick={printReceipt} className="rounded-full bg-[#0B6E4F] px-4 py-2 text-white">
          Print
        </button>
        <button type="button" disabled={saving} onClick={() => void saveFile("image")} className="rounded-full border px-4 py-2">
          Save as image
        </button>
        <button type="button" disabled={saving} onClick={() => void saveFile("pdf")} className="rounded-full border px-4 py-2">
          Save as PDF
        </button>
        <button onClick={shareReceipt} className="rounded-full border px-4 py-2">
          Share
        </button>
        {receipt.customer_id ? (
          <button onClick={sendInApp} className="rounded-full border px-4 py-2">
            Send in LaGecto
          </button>
        ) : null}
        <a className="rounded-full bg-[#25D366] px-4 py-2 text-white" href={whatsapp} target="_blank" rel="noreferrer">
          WhatsApp
        </a>
        {canManage && receipt.id ? (
          <>
            <Link href={`/shop/receipts/${receipt.id}/edit`} className="rounded-full border px-4 py-2">
              Edit
            </Link>
            <button type="button" className="rounded-full border px-4 py-2 text-red-700" onClick={() => setPending(true)}>
              Delete
            </button>
          </>
        ) : null}
      </div>
      {notice ? <p className="no-print mt-2 text-sm text-[#0B6E4F]">{notice}</p> : null}
      <ConfirmDialog
        open={pending}
        title="Delete this receipt?"
        body="Use this only for a mistake. If it is linked to a sale, that sale is removed too and catalogue stock is returned."
        onCancel={() => setPending(false)}
        onConfirm={() => {
          if (!receipt.id) return;
          void (async () => {
            const res = await fetch("/api/shop/receipts", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "delete", id: receipt.id }),
            });
            const data = await res.json();
            setPending(false);
            if (!res.ok) {
              setNotice(data.error || "Unable to delete this receipt.");
              return;
            }
            router.push("/shop/receipts");
            router.refresh();
          })();
        }}
      />
    </article>
  );
}
