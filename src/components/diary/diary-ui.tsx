"use client";

import Image from "next/image";
import Link from "next/link";
import { DIARY_ART, DIARY_MOODS, moodMeta } from "@/lib/diary-visuals";

export function DiaryArt({
  src,
  alt = "",
  size = 88,
  priority = false,
}: {
  src: string;
  alt?: string;
  size?: number;
  priority?: boolean;
}) {
  return (
    <Image
      src={src}
      alt={alt}
      width={size}
      height={size}
      priority={priority}
      className="h-auto w-full max-w-full object-contain"
      sizes={`${size}px`}
    />
  );
}

export function EmptyDiary({
  title,
  body,
  actionHref,
  actionLabel,
  art = DIARY_ART.empty,
}: {
  title: string;
  body: string;
  actionHref?: string;
  actionLabel?: string;
  art?: string;
}) {
  return (
    <div className="lg-card diary-rise overflow-hidden p-6 text-center">
      <div className="mx-auto mb-3 w-28">
        <DiaryArt src={art} size={160} />
      </div>
      <p className="font-semibold">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-[var(--lagecto-muted)]">{body}</p>
      {actionHref && actionLabel ? (
        <Link href={actionHref} className="mt-4 inline-flex rounded-full bg-[#0B6E4F] px-4 py-2 text-sm font-semibold text-white">
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}

export function ProgressBar({ value, label }: { value: number; label?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div>
      {label ? <p className="mb-1 text-xs font-medium text-[var(--lagecto-muted)]">{label}</p> : null}
      <div className="diary-progress h-2.5 overflow-hidden rounded-full bg-[#ece6d6]">
        <span style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-xs font-semibold text-[#0B6E4F]">{pct}%</p>
    </div>
  );
}

export function RingProgress({ value, label }: { value: number; label: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const r = 28;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;
  return (
    <div className="grid place-items-center">
      <svg width="76" height="76" viewBox="0 0 76 76" className="-rotate-90">
        <circle cx="38" cy="38" r={r} fill="none" stroke="#ece6d6" strokeWidth="8" />
        <circle
          cx="38"
          cy="38"
          r={r}
          fill="none"
          stroke="#0B6E4F"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
        />
      </svg>
      <p className="-mt-12 text-sm font-semibold">{pct}%</p>
      <p className="mt-8 text-[11px] text-[var(--lagecto-muted)]">{label}</p>
    </div>
  );
}

export function MoodPicker({
  value,
  onChange,
}: {
  value?: string | null;
  onChange: (mood: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {DIARY_MOODS.map((mood) => {
        const active = value === mood.value;
        return (
          <button
            key={mood.value}
            type="button"
            onClick={() => onChange(mood.value)}
            className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition ${
              active ? "bg-[#0B6E4F] text-white shadow-[0_8px_18px_rgba(11,110,79,0.22)]" : "bg-white text-[#12241c] ring-1 ring-[var(--lagecto-border)]"
            }`}
          >
            <span className="text-lg leading-none">{mood.emoji}</span>
            {mood.label}
          </button>
        );
      })}
    </div>
  );
}

export function MoodChip({ value }: { value?: string | null }) {
  const mood = moodMeta(value);
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#0B6E4F]/8 px-2 py-0.5 text-xs font-medium text-[#0B6E4F]">
      {mood.emoji} {mood.label}
    </span>
  );
}

export function QuickAction({
  href,
  label,
  art,
}: {
  href: string;
  label: string;
  art: string;
}) {
  return (
    <Link
      href={href}
      className="lg-card flex min-h-[108px] flex-col items-center justify-center gap-2 p-3 text-center"
    >
      <span className="block w-14">
        <DiaryArt src={art} size={80} />
      </span>
      <span className="text-xs font-semibold leading-tight">{label}</span>
    </Link>
  );
}
