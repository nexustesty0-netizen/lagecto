import Link from "next/link";
import { linkifyNewsText } from "@/lib/news/linkify";

export function LinkedNewsBody({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const parts = linkifyNewsText(text);
  return (
    <div className={className}>
      {parts.map((part, index) =>
        part.href ? (
          part.href.startsWith("/") ? (
            <Link key={`${part.href}-${index}`} href={part.href} className="font-medium text-[#0B6E4F] underline underline-offset-2">
              {part.text}
            </Link>
          ) : (
            <a
              key={`${part.href}-${index}`}
              href={part.href}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-[#0B6E4F] underline underline-offset-2"
            >
              {part.text}
            </a>
          )
        ) : (
          <span key={`text-${index}`}>{part.text}</span>
        ),
      )}
    </div>
  );
}
