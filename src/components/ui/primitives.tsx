import Link from "next/link";
import Image from "next/image";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-[1.7rem] font-semibold tracking-tight text-[var(--lagecto-text)]">{title}</h1>
        {subtitle ? <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--lagecto-muted)]">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <article className="lg-card relative overflow-hidden p-5">
      <span className="absolute -right-6 -top-8 h-24 w-24 rounded-full bg-[#0B6E4F]/8" />
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--lagecto-muted)]">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-[#0B6E4F]">{value}</p>
      {hint ? <p className="mt-2 text-xs text-[var(--lagecto-muted)]">{hint}</p> : null}
    </article>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="lg-card overflow-hidden p-8 text-center">
      <div className="relative mx-auto mb-4 h-28 w-28 overflow-hidden rounded-3xl">
        <Image src="/visuals/empty-still.png" alt="" fill sizes="112px" className="object-cover" />
      </div>
      <p className="font-semibold">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--lagecto-muted)]">{body}</p>
    </div>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
      {message}
    </div>
  );
}

export function StatusBadge({ value }: { value: string }) {
  const tone =
    value === "active" || value === "completed" || value === "verified" || value === "paid" || value === "succeeded" || value === "approved" || value === "accepted"
      ? "bg-emerald-50 text-emerald-800"
      : value === "pending" || value === "locked" || value === "processing" || value === "requested" || value === "contacted" || value === "draft" || value === "sent"
        ? "bg-amber-50 text-amber-900"
        : value === "cancelled" || value === "rejected" || value === "disabled" || value === "failed" || value === "refunded" || value === "declined" || value === "expired"
          ? "bg-red-50 text-red-800"
          : value === "review_required"
            ? "bg-orange-50 text-orange-900"
            : "bg-[#f3eee0] text-[var(--lagecto-muted)]";
  return <span className={`badge ${tone}`}>{value.replaceAll("_", " ")}</span>;
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`lg-card p-5 ${className}`}>{children}</section>;
}

export function ActionTile({
  href,
  title,
  hint,
}: {
  href: string;
  title: string;
  hint?: string;
}) {
  return (
    <Link href={href} className="lg-card group block p-4 transition hover:-translate-y-0.5 hover:shadow-[var(--lg-shadow-hover)]">
      <p className="font-semibold">{title}</p>
      {hint ? <p className="mt-1 text-sm text-[var(--lagecto-muted)]">{hint}</p> : null}
      <span className="mt-3 inline-block text-xs font-semibold uppercase tracking-[0.14em] text-[#0B6E4F]">Open</span>
    </Link>
  );
}

export function Skeleton({ className = "h-24" }: { className?: string }) {
  return <div className={`lg-shimmer rounded-2xl ${className}`} aria-hidden />;
}
