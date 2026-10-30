"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function OsSurface({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`os-surface ${className}`}>{children}</section>;
}

export function OsKicker({ children }: { children: React.ReactNode }) {
  return <p className="os-kicker">{children}</p>;
}

export function InitialsAvatar({
  name,
  photoUrl,
  size = 48,
}: {
  name?: string | null;
  photoUrl?: string | null;
  size?: number;
}) {
  const initials = String(name || "LG")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt=""
        width={size}
        height={size}
        className="rounded-2xl object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className="grid place-items-center rounded-2xl bg-[#0B6E4F] text-xs font-semibold text-white"
      style={{ width: size, height: size, fontSize: size > 40 ? 14 : 11 }}
    >
      {initials || "LG"}
    </span>
  );
}

export function AnimatedStat({ value }: { value: string }) {
  const [shown, setShown] = useState(value);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setShown(value);
      return;
    }
    setShown(value);
  }, [value]);
  return <span className="os-stat-value">{shown}</span>;
}

export function SegmentedControl({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="os-segmented">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={value === option.value ? "is-active" : ""}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1 text-xs font-medium text-[var(--lagecto-muted)]">
      {label}
      {children}
    </label>
  );
}

export function BarChart({
  items,
  empty = "Not enough data yet.",
}: {
  items: { label: string; value: number }[];
  empty?: string;
}) {
  const max = Math.max(...items.map((item) => item.value), 0);
  if (!items.length || max <= 0) {
    return <p className="text-sm text-[var(--lagecto-muted)]">{empty}</p>;
  }
  return (
    <ul className="grid gap-3">
      {items.map((item) => (
        <li key={item.label}>
          <div className="mb-1 flex justify-between gap-3 text-sm">
            <span>{item.label}</span>
            <span className="font-medium">{item.value}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[#efe8d4]">
            <span className="block h-full rounded-full bg-[#0B6E4F]" style={{ width: `${Math.max(6, (item.value / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function CompareBars({
  left,
  right,
}: {
  left: { label: string; value: number; tone?: "good" | "warn" };
  right: { label: string; value: number; tone?: "good" | "warn" };
}) {
  const max = Math.max(left.value, right.value, 1);
  return (
    <div className="grid gap-4">
      {[left, right].map((item) => (
        <div key={item.label}>
          <div className="mb-1 flex justify-between text-sm">
            <span>{item.label}</span>
            <span className="font-medium">{item.value}</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-[#efe8d4]">
            <span
              className={`block h-full rounded-full ${item.tone === "warn" ? "bg-[#C47B12]" : "bg-[#0B6E4F]"}`}
              style={{ width: `${Math.max(4, (item.value / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ResultPill({ result }: { result: "profit" | "loss" | "break_even" }) {
  const label = result === "profit" ? "Profit" : result === "loss" ? "Loss" : "Break-even";
  const tone =
    result === "profit" ? "bg-emerald-50 text-emerald-800" : result === "loss" ? "bg-red-50 text-red-800" : "bg-[#f3eee0] text-[var(--lagecto-muted)]";
  return <span className={`badge ${tone}`}>{label}</span>;
}

export function QuietLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-sm font-semibold text-[#0B6E4F]">
      {children}
    </Link>
  );
}
