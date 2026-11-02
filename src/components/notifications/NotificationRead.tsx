import type { ReactNode } from "react";
import Link from "next/link";
import { formatDateTime } from "@/lib/format";
import { relatedRecordLabel, type NoticeRow } from "@/lib/notifications";
import { PageHeader } from "@/components/ui/primitives";

export function NotificationRead({
  item,
  backHref,
  relatedHref,
  children,
}: {
  item: NoticeRow;
  backHref: string;
  relatedHref?: string | null;
  children?: ReactNode;
}) {
  return (
    <>
      <PageHeader
        title={item.title}
        subtitle={item.type ? String(item.type).replace(/_/g, " ") : "Notification"}
        action={
          <Link href={backHref} className="text-sm font-medium text-[#0B6E4F]">
            All notifications
          </Link>
        }
      />
      <article className="rounded-2xl bg-white p-5">
        <p className="whitespace-pre-wrap text-sm leading-7 text-[var(--lagecto-text)]">{item.message}</p>
        <p className="mt-4 text-xs text-[var(--lagecto-muted)]">{formatDateTime(item.created_at)}</p>
        {relatedHref ? (
          <Link href={relatedHref} className="mt-4 inline-flex min-h-11 items-center rounded-full bg-[#0B6E4F] px-4 text-sm font-semibold text-white">
            {relatedRecordLabel(item.type)}
          </Link>
        ) : null}
      </article>
      {children}
    </>
  );
}
