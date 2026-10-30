"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BUG_AREAS, FEEDBACK_CATEGORIES, SHOP_REPORT_REASONS, SUPPORT_CATEGORIES, SHOP_EXTRA_CATEGORIES } from "@/lib/support/constants";
import { IMAGE_SIZE_HINT, validateUpload } from "@/lib/media";
import type { SupportKind } from "@/lib/support/constants";

export function SupportCaseForm({
  kind,
  basePath,
  shopId,
  shopName,
  forShopOwner,
}: {
  kind: SupportKind;
  basePath: string;
  shopId?: string;
  shopName?: string;
  forShopOwner?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ ticket_number: string; id: string } | null>(null);
  const categories = [...new Set(forShopOwner ? [...SUPPORT_CATEGORIES, ...SHOP_EXTRA_CATEGORIES] : [...SUPPORT_CATEGORIES])];

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = event.currentTarget;
    const data = new FormData(form);
    const screenshot = data.get("file");
    if (screenshot instanceof File && screenshot.size > 0) {
      const sizeCheck = validateUpload(screenshot, "image");
      if (!sizeCheck.ok) {
        setBusy(false);
        setError(sizeCheck.error);
        return;
      }
    }
    data.set("kind", kind);
    if (shopId) data.set("shop_id", shopId);
    const res = await fetch("/api/support/create", { method: "POST", body: data });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(json.error || "Unable to submit.");
      return;
    }
    setDone({ ticket_number: json.ticket_number, id: json.id });
    form.reset();
    router.refresh();
  }

  if (done) {
    return (
      <div className="lg-card p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#D4AF37]">Received</p>
        <h2 className="mt-2 text-2xl font-semibold">
          {kind === "shop_report" ? "Thanks for helping keep LaGecto safe." : "We have your request."}
        </h2>
        <p className="mt-2 text-sm text-[var(--lagecto-muted)]">
          {kind === "shop_report"
            ? "Your report has been submitted for review. We do not promise a specific outcome or an immediate suspension."
            : "Support will review this and reply in My requests."}
        </p>
        <p className="mt-4 font-mono text-[#0B6E4F]">Report ID {done.ticket_number}</p>
        <a href={`${basePath}/tickets/${done.id}`} className="mt-4 inline-block text-sm font-semibold text-[#0B6E4F]">
          Open this request
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="lg-card grid gap-3 p-5">
      {kind === "shop_report" ? (
        <>
          <p className="text-sm text-[var(--lagecto-muted)]">
            Help keep LaGecto safe. Only report a shop if you believe there is a genuine problem. This is a customer report for review, not an automatic finding against the shop.
          </p>
          {shopId ? (
            shopName ? (
              <p className="text-sm">
                Shop: <strong>{shopName}</strong>
              </p>
            ) : (
              <input type="hidden" name="shop_id" value={shopId} />
            )
          ) : (
            <input name="shop_id" required placeholder="Shop ID (from the shop page URL)" className="rounded-xl border px-3 py-2" />
          )}
          <label className="text-sm font-medium">
            Reason
            <select name="category" required className="mt-1 w-full rounded-xl border px-3 py-2" defaultValue="scam">
              {SHOP_REPORT_REASONS.map((reason) => (
                <option key={reason.id} value={reason.id}>
                  {reason.label}
                </option>
              ))}
            </select>
          </label>
        </>
      ) : kind === "feedback" ? (
        <label className="text-sm font-medium">
          What do you think about LaGecto?
          <select name="category" className="mt-1 w-full rounded-xl border px-3 py-2" defaultValue="general">
            {FEEDBACK_CATEGORIES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
      ) : kind === "bug" ? (
        <label className="text-sm font-medium">
          Where did it happen?
          <select name="area" className="mt-1 w-full rounded-xl border px-3 py-2" defaultValue="other">
            {BUG_AREAS.map((area) => (
              <option key={area} value={area}>
                {area}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <label className="text-sm font-medium">
          Issue type
          <select name="category" className="mt-1 w-full rounded-xl border px-3 py-2" defaultValue="other">
            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
      )}

      {kind !== "shop_report" ? (
        <input name="subject" required maxLength={120} placeholder={kind === "feedback" ? "What should we improve?" : "Subject"} className="rounded-xl border px-3 py-2" />
      ) : (
        <input type="hidden" name="subject" value={shopName ? `Report: ${shopName}` : "Shop report"} />
      )}

      {kind === "bug" ? (
        <>
          <textarea name="description" required maxLength={4000} placeholder="What happened?" className="min-h-28 rounded-xl border px-3 py-2" />
          <textarea name="trying" maxLength={1000} placeholder="What were you trying to do?" className="min-h-20 rounded-xl border px-3 py-2" />
          <textarea name="steps_to_reproduce" maxLength={2000} placeholder="Steps to reproduce" className="min-h-24 rounded-xl border px-3 py-2" />
          <select name="severity" className="rounded-xl border px-3 py-2" defaultValue="moderate">
            <option value="minor">Minor</option>
            <option value="moderate">Moderate</option>
            <option value="major">Major</option>
            <option value="blocking">Blocking</option>
          </select>
        </>
      ) : (
        <textarea name="description" required maxLength={4000} placeholder={kind === "shop_report" ? "What happened?" : "Description"} className="min-h-32 rounded-xl border px-3 py-2" />
      )}

      {kind === "feedback" ? (
        <label className="text-sm">
          Optional rating
          <select name="rating" className="mt-1 w-full rounded-xl border px-3 py-2">
            <option value="">No rating</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n} star{n === 1 ? "" : "s"}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {kind === "support" || kind === "technical" ? (
        <label className="text-sm">
          Priority
          <select name="priority" className="mt-1 w-full rounded-xl border px-3 py-2" defaultValue="normal">
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent (payments, security or account only)</option>
          </select>
        </label>
      ) : null}

      {kind === "shop_report" || kind === "support" || kind === "technical" ? (
        <input name="order_number" maxLength={40} placeholder="Optional order number" className="rounded-xl border px-3 py-2" />
      ) : null}

      <label className="text-sm">
        Optional screenshot (JPEG, PNG, WebP or GIF). {IMAGE_SIZE_HINT}
        <input name="file" type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="mt-1 block w-full text-sm" />
      </label>
      <input type="hidden" name="user_agent" value={typeof navigator === "undefined" ? "" : navigator.userAgent.slice(0, 180)} />

      {kind === "shop_report" ? (
        <p className="text-xs text-[var(--lagecto-muted)]">False or abusive reports may be reviewed. Please provide accurate information.</p>
      ) : (
        <p className="text-xs text-[var(--lagecto-muted)]">Do not include passwords, PINs or full card numbers.</p>
      )}

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <button disabled={busy} className="rounded-xl bg-[#0B6E4F] px-4 py-3 font-semibold text-white">
        {busy ? "Sending…" : kind === "shop_report" ? "Submit Report" : "Submit"}
      </button>
    </form>
  );
}
