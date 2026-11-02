import Link from "next/link";

export function SectionHeading({
  title,
  kicker,
  href,
  linkLabel,
}: {
  title: string;
  kicker?: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-2 sm:mb-5">
      <div>
        {kicker ? <p className="lg-kicker">{kicker}</p> : null}
        <h2 className={`text-lg font-semibold tracking-tight sm:text-2xl ${kicker ? "mt-1" : ""}`}>{title}</h2>
      </div>
      {href && linkLabel ? (
        <Link href={href} className="text-sm font-medium text-[var(--lagecto-primary)]">
          {linkLabel}
        </Link>
      ) : null}
    </div>
  );
}

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
    <div className="page-header mb-5 flex flex-col gap-3 sm:mb-7 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-[1.4rem] font-semibold tracking-tight text-[var(--lagecto-text)] sm:text-[1.7rem]">{title}</h1>
        {subtitle ? <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--lagecto-muted)]">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function DashboardHero({
  title,
  subtitle,
  image,
  kicker,
  action,
}: {
  title: string;
  subtitle?: string;
  image: string;
  kicker?: string;
  action?: React.ReactNode;
}) {
  return (
    <section className="relative mb-5 overflow-hidden rounded-[var(--lg-radius)] sm:mb-7">
      <div className="relative min-h-[14rem] sm:min-h-[17rem] lg:min-h-[19rem]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="relative flex min-h-[14rem] items-end p-4 sm:min-h-[17rem] sm:p-6 lg:min-h-[19rem]">
          <div className="max-w-xl rounded-2xl bg-[#0B6E4F] p-5 text-white sm:p-7">
            {kicker ? <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#FFB000] sm:text-[11px]">{kicker}</p> : null}
            <h1 className="mt-1 text-[1.4rem] font-semibold leading-tight tracking-tight sm:text-3xl">{title}</h1>
            {subtitle ? <p className="mt-1 max-w-xl text-xs leading-5 text-white/90 sm:text-sm sm:leading-6">{subtitle}</p> : null}
            {action ? <div className="mt-4">{action}</div> : null}
          </div>
        </div>
      </div>
    </section>
  );
}

export function PeriodChips({
  selected,
  options,
  hrefFor,
}: {
  selected: string;
  options: Array<[string, string]>;
  hrefFor: (value: string) => string;
}) {
  return (
    <div className="mb-5 flex gap-2 overflow-x-auto pb-1 hide-scrollbar sm:mb-6">
      {options.map(([value, label]) => (
        <Link
          key={value}
          href={hrefFor(value)}
          className={
            selected === value
              ? "lg-btn shrink-0 px-3.5"
              : "min-h-11 shrink-0 rounded-full border border-[var(--lagecto-border)] bg-white px-3.5 py-2 text-sm font-medium sm:px-4"
          }
        >
          {label}
        </Link>
      ))}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "cream",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "cream" | "green" | "gold" | "dark";
}) {
  const wrap =
    tone === "dark"
      ? "rounded-[var(--lg-radius)] bg-[var(--lagecto-primary-deep)] p-3.5 text-white sm:p-5"
      : tone === "gold"
        ? "rounded-[var(--lg-radius)] bg-[#F8F1D8] p-3.5 sm:p-5"
        : tone === "green"
          ? "rounded-[var(--lg-radius)] bg-[#E8F4EE] p-3.5 sm:p-5"
          : "lg-card p-3.5 sm:p-5";
  const valueClass = tone === "dark" ? "text-white" : tone === "gold" ? "text-[#6B5208]" : "text-[var(--lagecto-primary)]";
  const labelClass = tone === "dark" ? "text-[#FFB000]" : "text-[var(--lagecto-muted)]";
  const hintClass = tone === "dark" ? "text-white/70" : "text-[var(--lagecto-muted)]";
  return (
    <article className={wrap}>
      <p className={`text-[10px] font-semibold uppercase tracking-[0.08em] sm:text-xs ${labelClass}`}>{label}</p>
      <p className={`mt-2 text-xl font-semibold tracking-tight sm:mt-3 sm:text-2xl ${valueClass}`}>{value}</p>
      {hint ? <p className={`mt-1 text-[11px] leading-4 sm:mt-2 sm:text-xs ${hintClass}`}>{hint}</p> : null}
    </article>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="lg-card p-8 text-center">
      <p className="font-semibold">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--lagecto-muted)]">{body}</p>
      {action ? <div className="mt-4">{action}</div> : null}
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

export function DataTable({
  caption,
  children,
}: {
  caption?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="app-table-wrap">
      <table className="app-table">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        {children}
      </table>
    </div>
  );
}

export function ActionTile({
  href,
  title,
  hint,
  icon,
}: {
  href: string;
  title: string;
  hint?: string;
  icon?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-3 rounded-[var(--lg-radius)] border border-[var(--lagecto-border)] bg-white p-3 sm:p-4"
    >
      {icon ? (
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[var(--lg-radius-sm)] bg-[#E8F4EE] text-[var(--lagecto-primary)] sm:h-10 sm:w-10">
          {icon}
        </span>
      ) : null}
      <span className="min-w-0">
        <p className="text-sm font-semibold leading-tight sm:text-base">{title}</p>
        {hint ? <p className="mt-0.5 text-[11px] leading-4 text-[var(--lagecto-muted)] sm:text-sm">{hint}</p> : null}
      </span>
    </Link>
  );
}

export function Skeleton({ className = "h-24" }: { className?: string }) {
  return <div className={`lg-shimmer rounded-2xl ${className}`} aria-hidden />;
}

export function PageLoading({ label = "Loading" }: { label?: string }) {
  return (
    <div className="grid gap-4" role="status" aria-live="polite" aria-label={label}>
      <span className="sr-only">{label}</span>
      <Skeleton className="h-16 sm:h-20" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}
