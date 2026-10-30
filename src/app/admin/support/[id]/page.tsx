import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { PageHeader, StatusBadge } from "@/components/ui/primitives";
import { TicketThread } from "@/components/support/TicketThread";
import { AdminCaseDesk } from "@/components/admin/AdminCaseDesk";
import { loadMyCase, loadSimilarBugs } from "@/lib/support/load";
import { formatDateTime } from "@/lib/format";

export default async function AdminSupportCasePage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireRole("admin");
  const { id } = await params;
  const packed = await loadMyCase(id, profile.id, true);
  if (!packed) notFound();
  const supabase = await createServerSupabase();
  const [{ data: reporter }, { data: shop }] = await Promise.all([
    supabase.from("users").select("id, name, email, username").eq("id", packed.ticket.reporter_user_id).maybeSingle(),
    packed.ticket.shop_id
      ? supabase.from("shops").select("id, name, login_shop_id, status").eq("id", packed.ticket.shop_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const similar = packed.ticket.kind === "bug" ? await loadSimilarBugs(packed.ticket) : [];

  return (
    <>
      <PageHeader
        title={packed.ticket.ticket_number}
        subtitle={`${packed.ticket.kind} · last updated ${formatDateTime(packed.ticket.updated_at)}`}
        action={
          <Link href="/admin/support" className="rounded-full border px-4 py-2 text-sm">
            Back to queue
          </Link>
        }
      />
      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <article className="lg-card p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-[#D4AF37]">Reporter</p>
          <p className="mt-2 font-semibold">{reporter?.name || reporter?.username || "Customer"}</p>
          <p className="text-sm text-[var(--lagecto-muted)]">{reporter?.email}</p>
          <p className="mt-2 text-xs text-[var(--lagecto-muted)]">Shown to admins only. Do not share this with the shop.</p>
        </article>
        <article className="lg-card p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-[#D4AF37]">Case</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <StatusBadge value={packed.ticket.status} />
            <StatusBadge value={packed.ticket.priority} />
          </div>
          <p className="mt-2 text-sm">{packed.ticket.category}{packed.ticket.area ? ` · ${packed.ticket.area}` : ""}</p>
          {packed.ticket.order_number ? <p className="text-sm">Order {packed.ticket.order_number}</p> : null}
          {packed.ticket.rating ? <p className="text-sm">Rating {packed.ticket.rating}/5</p> : null}
        </article>
        <article className="lg-card p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-[#D4AF37]">Shop</p>
          {shop ? (
            <>
              <p className="mt-2 font-semibold">{shop.name}</p>
              <p className="text-sm text-[var(--lagecto-muted)]">{shop.login_shop_id} · {shop.status}</p>
              <Link href={`/admin/shops/${shop.id}`} className="mt-2 inline-block text-sm font-semibold text-[#0B6E4F]">
                Review shop
              </Link>
            </>
          ) : (
            <p className="mt-2 text-sm text-[var(--lagecto-muted)]">No shop linked</p>
          )}
        </article>
      </div>
      {packed.ticket.steps_to_reproduce ? (
        <article className="lg-card mb-6 p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-[#D4AF37]">Steps to reproduce</p>
          <p className="mt-2 whitespace-pre-wrap text-sm">{packed.ticket.steps_to_reproduce}</p>
        </article>
      ) : null}
      <div className="grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
        <TicketThread ticket={packed.ticket} messages={packed.messages} notes={packed.notes} isAdmin />
        <AdminCaseDesk ticket={packed.ticket} similar={similar} />
      </div>
    </>
  );
}
