"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium">
      {label}
      {children}
    </label>
  );
}

export function TextField({
  label,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <Field label={label}>
      <input {...props} className={`h-12 rounded-2xl px-4 ${props.className || ""}`} />
    </Field>
  );
}

export function PasswordField({
  label,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const [show, setShow] = useState(false);
  return (
    <Field label={label}>
      <span className="relative block">
        <input
          {...props}
          type={show ? "text" : "password"}
          className={`h-12 w-full rounded-2xl px-4 pr-12 ${props.className || ""}`}
        />
        <button
          type="button"
          className="absolute inset-y-0 right-0 grid w-12 place-items-center text-[var(--lagecto-muted)]"
          onClick={() => setShow((value) => !value)}
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </span>
    </Field>
  );
}

export function PrimaryButton({
  children,
  loading,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={`h-12 w-full rounded-2xl bg-[#0B6E4F] px-4 font-semibold text-white shadow-[0_10px_24px_rgba(11,110,79,0.28)] disabled:cursor-not-allowed disabled:opacity-60 ${props.className || ""}`}
    >
      {loading ? (
        <span className="inline-flex items-center gap-2">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden />
          {children}
        </span>
      ) : (
        children
      )}
    </button>
  );
}

export function Alert({
  tone = "error",
  children,
}: {
  tone?: "error" | "success" | "warning";
  children: React.ReactNode;
}) {
  const styles = {
    error: "border-red-200 bg-red-50 text-red-800",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
  };
  return (
    <p className={`rounded-2xl border px-4 py-3 text-sm ${styles[tone]}`} role="alert">
      {children}
    </p>
  );
}

export function PasswordMeter({ password }: { password: string }) {
  const checks = [
    password.length >= 8,
    /[A-Za-z]/.test(password),
    /[0-9]/.test(password),
  ];
  const score = checks.filter(Boolean).length;
  return (
    <div className="grid gap-2">
      <div className="flex gap-1">
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            className={`h-1.5 flex-1 rounded-full ${index < score ? "bg-[#0B6E4F]" : "bg-black/10"}`}
          />
        ))}
      </div>
      <p className="text-xs text-[var(--lagecto-muted)]">Use at least 8 characters with letters and numbers.</p>
    </div>
  );
}
