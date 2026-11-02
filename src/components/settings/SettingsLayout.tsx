import Link from "next/link";
import type { SettingsTab, ShopSettingsLink } from "@/lib/settings-nav";

export function SettingsLayout({
  basePath,
  tabs,
  current,
  children,
}: {
  basePath: string;
  tabs: SettingsTab[];
  current: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
      <nav aria-label="Settings categories" className="flex flex-wrap gap-2 lg:flex-col">
        {tabs.map((tab, index) => {
          const href = index === 0 ? basePath : `${basePath}?tab=${tab.id}`;
          const active = current === tab.id;
          return (
            <Link
              key={tab.id}
              href={href}
              className={`rounded-full px-4 py-2 text-sm font-medium ${active ? "bg-[#0B6E4F] text-white" : "border border-[var(--lagecto-border)] bg-white"}`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function SettingsPanel({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-lg font-semibold">{title}</h2>
      {hint ? <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--lagecto-muted)]">{hint}</p> : null}
      <div className="mt-4 grid gap-4">{children}</div>
    </section>
  );
}

export function SettingsLinkGrid({ items }: { items: ShopSettingsLink[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <Link key={item.href} href={item.href} className="lg-card p-4">
          <p className="font-semibold">{item.title}</p>
          <p className="mt-1 text-sm text-[var(--lagecto-muted)]">{item.hint}</p>
        </Link>
      ))}
    </div>
  );
}
