"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SHOP_PROVIDER_TYPES } from "@/lib/brand";
import { CategorySelect } from "@/components/ui/CategoryIcon";
import { VerifiedBadge } from "@/components/shop/VerifiedBadge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { filterAdminShops } from "@/lib/admin/control-centre";
import Link from "next/link";

type ShopRow = {
  id: string;
  name: string;
  login_shop_id: string | null;
  owner_name: string | null;
  owner_email: string | null;
  status: string;
  verification_status: string;
  category: string | null;
  provider_type: string | null;
  phone: string | null;
  package_label?: string | null;
};

type PlanOption = {
  id: string;
  name: string;
  package_key: string | null;
  duration_key?: string | null;
  duration_months?: number | null;
  price?: number | null;
};

export function ShopManageClient({
  shops,
  plans,
  initialQuery = "",
  canRegenerate = false,
  canAssignPlan = false,
  canDelete = false,
  canMutate = false,
  canSeeContact = false,
  canMessage = false,
}: {
  shops: ShopRow[];
  plans: PlanOption[];
  initialQuery?: string;
  canRegenerate?: boolean;
  canAssignPlan?: boolean;
  canDelete?: boolean;
  canMutate?: boolean;
  canSeeContact?: boolean;
  canMessage?: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [status, setStatus] = useState("all");
  const [verification, setVerification] = useState("all");
  const [error, setError] = useState("");
  const [result, setResult] = useState("");
  const [pendingRegen, setPendingRegen] = useState<ShopRow | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ShopRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const visible = useMemo(
    () => filterAdminShops(shops, query, status, verification),
    [shops, query, status, verification],
  );

  async function call(payload: Record<string, unknown>) {
    setError("");
    setResult("");
    const shopId = String(payload.shopId || "");
    setBusyId(shopId);
    const response = await fetch("/api/admin/shops", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    setBusyId(null);
    if (!response.ok) {
      setError(data.error || "Unable to update this shop.");
      return;
    }
    if (payload.action === "regenerate_login_id" && data.login_shop_id) {
      setResult(
        `New Shop ID for ${data.shop_name || "this shop"}: ${data.login_shop_id}. Give this to the owner. The old ID no longer works.`,
      );
    }
    if (payload.action === "delete") {
      setResult(`${data.shop_name || "Shop"} was deleted.`);
    }
    router.refresh();
  }

  return (
    <div className="grid gap-3">
      <div className="grid gap-2 md:grid-cols-[1fr_10rem_10rem]">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search shop, Shop ID or owner"
          className="rounded-xl border px-3 py-2"
        />
        <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-xl border px-3 py-2">
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Suspended</option>
          <option value="pending">Pending</option>
        </select>
        <select value={verification} onChange={(event) => setVerification(event.target.value)} className="rounded-xl border px-3 py-2">
          <option value="all">All verification</option>
          <option value="verified">Verified</option>
          <option value="pending">Pending</option>
          <option value="unverified">Unverified</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>
      <p className="text-sm text-[var(--lagecto-muted)]">{visible.length} shop{visible.length === 1 ? "" : "s"}</p>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {result ? <p className="rounded-xl bg-[#0B6E4F]/10 px-4 py-3 text-sm font-medium text-[#0B6E4F]">{result}</p> : null}
      {visible.map((shop) => (
        <article key={shop.id} className="grid gap-3 rounded-2xl bg-white p-4 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold">{shop.name}</p>
              <VerifiedBadge verified={shop.verification_status === "verified"} />
            </div>
            <p className="font-mono text-sm">{shop.login_shop_id}</p>
            <p className="mt-1 text-xs text-[#6B7280]">
              {shop.owner_name || "Owner"}
              {canSeeContact && shop.owner_email ? ` · ${shop.owner_email}` : ""}
            </p>
            <p className="text-xs text-[#0B6E4F]">
              {shop.provider_type === "products"
                ? "Products only"
                : shop.provider_type === "services"
                  ? "Services only"
                  : "Products and services"}
              {shop.package_label ? ` · ${shop.package_label}` : " · no active package"}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
              <Link href={`/admin/shops/${shop.id}`} className="text-xs font-semibold text-[#0B6E4F]">
                Review shop
              </Link>
              {canMessage ? <ShopMessageButton shopId={shop.id} compact /> : null}
              {canRegenerate ? (
                <button
                  type="button"
                  disabled={busyId === shop.id}
                  className="text-xs font-semibold text-[#C2413B] disabled:opacity-50"
                  onClick={() => setPendingRegen(shop)}
                >
                  Regenerate Shop ID
                </button>
              ) : null}
              {canDelete ? (
                <button
                  type="button"
                  disabled={busyId === shop.id}
                  className="text-xs font-semibold text-[#C2413B] disabled:opacity-50"
                  onClick={() => setPendingDelete(shop)}
                >
                  Delete shop
                </button>
              ) : null}
            </div>
          </div>
          {canMutate ? (
            <select
              defaultValue={shop.status || "pending"}
              className="rounded-xl border px-3 py-2 text-sm"
              onChange={(event) => call({ action: "update", shopId: shop.id, status: event.target.value })}
            >
              <option value="active">active</option>
              <option value="inactive">suspended</option>
              <option value="pending">pending</option>
            </select>
          ) : (
            <p className="self-center text-sm text-[var(--lagecto-muted)]">{shop.status}</p>
          )}
          {canAssignPlan ? (
            <select
              defaultValue=""
              className="rounded-xl border px-3 py-2 text-sm"
              onChange={(event) => event.target.value && call({ action: "assign_plan", shopId: shop.id, planId: event.target.value })}
            >
              <option value="">Assign package (verifies shop)…</option>
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name} · {plan.package_key || "custom"} · {plan.duration_key || `${plan.duration_months || 1} mo`}
                  {plan.price != null ? ` · $${Number(plan.price)}` : ""}
                </option>
              ))}
            </select>
          ) : (
            <div />
          )}
          {canMutate ? (
            <form
              className="lg:col-span-4 grid gap-2 md:grid-cols-6"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                call({
                  action: "update",
                  shopId: shop.id,
                  name: form.get("name"),
                  phone: form.get("phone"),
                  category: form.get("category"),
                  providerType: form.get("providerType"),
                  verificationStatus: form.get("verificationStatus"),
                });
              }}
            >
              <input name="name" defaultValue={shop.name} className="rounded-xl border px-3 py-2" />
              <input name="phone" defaultValue={shop.phone || ""} placeholder="Phone" className="rounded-xl border px-3 py-2" />
              <CategorySelect name="category" defaultValue={shop.category || "other"} />
              <select name="providerType" defaultValue={shop.provider_type || "both"} className="rounded-xl border px-3 py-2">
                {SHOP_PROVIDER_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
              <select name="verificationStatus" defaultValue={shop.verification_status || "unverified"} className="rounded-xl border px-3 py-2">
                <option value="unverified">unverified</option>
                <option value="pending">pending</option>
                <option value="verified">verified</option>
                <option value="rejected">rejected</option>
              </select>
              <button className="rounded-xl bg-[#0B6E4F] px-4 py-2 text-white">Save shop</button>
            </form>
          ) : null}
        </article>
      ))}
      {!visible.length ? <p className="rounded-2xl bg-white p-4 text-sm text-[#6B7280]">No shops match this search.</p> : null}
      <ConfirmDialog
        open={Boolean(pendingRegen)}
        title="Regenerate this Shop ID?"
        body={
          pendingRegen
            ? `This creates a new Shop ID for ${pendingRegen.name}. The current ID ${pendingRegen.login_shop_id || "—"} will stop working. Use this only if the owner lost their Shop ID.`
            : ""
        }
        confirmLabel="Regenerate Shop ID"
        onCancel={() => setPendingRegen(null)}
        onConfirm={() => {
          const shop = pendingRegen;
          setPendingRegen(null);
          if (shop) void call({ action: "regenerate_login_id", shopId: shop.id });
        }}
      />
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete this shop?"
        body={
          pendingDelete
            ? `${pendingDelete.name} will be permanently removed, including its products, orders, and storefront. This cannot be undone.`
            : ""
        }
        confirmLabel="Delete shop"
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          const shop = pendingDelete;
          setPendingDelete(null);
          if (shop) void call({ action: "delete", shopId: shop.id });
        }}
      />
    </div>
  );
}

export function ShopDeleteControl({ shopId, shopName }: { shopId: string; shopName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function remove() {
    setBusy(true);
    setError("");
    const response = await fetch("/api/admin/shops", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", shopId }),
    });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    setOpen(false);
    if (!response.ok) {
      setError(data.error || "Unable to delete this shop.");
      return;
    }
    router.push("/admin/shops");
    router.refresh();
  }

  return (
    <div className="os-surface mt-6">
      <h2 className="font-semibold text-[#C2413B]">Delete shop</h2>
      <p className="mt-1 text-sm text-[var(--lagecto-muted)]">
        Permanently remove {shopName}, including products, orders, and the storefront. Only a super admin can do this.
      </p>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      <button
        type="button"
        disabled={busy}
        className="mt-3 rounded-full border border-[#C2413B]/30 px-4 py-2 text-sm font-semibold text-[#C2413B] disabled:opacity-50"
        onClick={() => setOpen(true)}
      >
        Delete shop
      </button>
      <ConfirmDialog
        open={open}
        title="Delete this shop?"
        body={`${shopName} will be permanently removed, including its products, orders, and storefront. This cannot be undone.`}
        confirmLabel="Delete shop"
        onCancel={() => setOpen(false)}
        onConfirm={() => void remove()}
      />
    </div>
  );
}

export function ShopMessageButton({ shopId, compact = false }: { shopId: string; compact?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function start() {
    if (busy) return;
    setBusy(true);
    setError("");
    const res = await fetch("/api/chat/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "shop_admin", shopId }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok || !data.conversation_id) {
      setError(data.error || "Unable to open this shop conversation.");
      return;
    }
    router.push(`/admin/chat?c=${data.conversation_id}`);
  }

  return (
    <div>
      <button
        type="button"
        disabled={busy}
        className={
          compact
            ? "text-xs font-semibold text-[#0B6E4F] disabled:opacity-50"
            : "rounded-full bg-[#0B6E4F] px-4 py-2 text-sm text-white disabled:opacity-50"
        }
        onClick={() => void start()}
      >
        {busy ? "Opening…" : "Message shop"}
      </button>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
