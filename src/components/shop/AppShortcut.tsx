import Link from "next/link";

export function AppShortcut({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <Link href={href} className="flex flex-col items-center gap-1.5 rounded-2xl px-1 py-2.5 text-center">
      <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#E8F4EE] text-[#0B6E4F]">{icon}</span>
      <span className="text-[11px] font-medium leading-tight text-[var(--lagecto-text)]">{label}</span>
    </Link>
  );
}
