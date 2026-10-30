"use client";

import { useState } from "react";
import Link from "next/link";
import { Alert, PasswordField, PasswordMeter, PrimaryButton, TextField } from "@/components/ui/forms";

export function SignupForm() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (loading) return;
    setError("");
    setSuccess("");
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, email, username, phone, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Unable to create this account.");
        return;
      }
      setSuccess(
        data.needsEmailVerification
          ? "Account created. Check your email to verify, then sign in."
          : "Account created. You can now sign in.",
      );
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="grid gap-4">
        <Alert tone="success">{success}</Alert>
        <Link href="/login" className="h-12 rounded-2xl bg-[#0B6E4F] px-4 text-center text-sm font-semibold leading-[48px] text-white">
          Continue to sign in
        </Link>
      </div>
    );
  }

  return (
    <>
      <form onSubmit={onSubmit} className="grid gap-4">
        <TextField label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} required autoComplete="name" />
        <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        <TextField label="Username" value={username} onChange={(e) => setUsername(e.target.value)} required autoComplete="username" />
        <TextField label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder="0771234567" autoComplete="tel" />
        <PasswordField label="Password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" />
        <PasswordMeter password={password} />
        <PasswordField label="Confirm password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required autoComplete="new-password" />
        {error ? <Alert>{error}</Alert> : null}
        <PrimaryButton type="submit" loading={loading}>
          {loading ? "Creating…" : "Create account"}
        </PrimaryButton>
      </form>
      <p className="mt-5 text-center text-sm text-[var(--lagecto-muted)]">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-[#0B6E4F]">
          Sign in
        </Link>
      </p>
      <p className="mt-3 text-center text-sm text-[var(--lagecto-muted)]">
        Opening a business?{" "}
        <Link href="/register-shop" className="font-medium text-[#0B6E4F]">
          Register a shop
        </Link>
      </p>
    </>
  );
}
