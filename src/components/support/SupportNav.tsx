import Link from "next/link";
import { supportNav } from "@/lib/support/constants";

export function SupportNav({ basePath, current }: { basePath: string; current: string }) {
  const items = supportNav(basePath);
  return (
    <nav className="lg-support-nav" aria-label="Help and Support">
      {items.map((item) => {
        const active = current === item.href || (item.href !== basePath && current.startsWith(item.href));
        return (
          <Link key={item.href} href={item.href} className={active ? "is-active" : ""}>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
