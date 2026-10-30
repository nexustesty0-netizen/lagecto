"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Alert, PasswordField, PrimaryButton, TextField } from "@/components/ui/forms";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(params.get("locked") ? "This account is locked. Contact LaGecto support." : "");
  const [loading, setLoading] = useState(false);
  const locked = Boolean(params.get("locked") || error.toLowerCase().includes("locked"));

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Sign in failed.");
        return;
      }
      router.push(params.get("next") || data.redirectTo || "/app");
      router.refresh();
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {params.get("setup") ? (
        <div className="mb-4">
          <Alert tone="warning">Connect the new Supabase project in .env.local before signing in.</Alert>
        </div>
      ) : null}
      {locked && !params.get("setup") ? (
        <div className="mb-4">
          <Alert tone="warning">This account is locked. Contact LaGecto support to restore access.</Alert>
        </div>
      ) : null}
      <form onSubmit={onSubmit} className="grid gap-4">
        <TextField
          label="Email, username or Shop ID"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          autoComplete="username"
          required
        />
        <PasswordField
          label="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
        {error && !locked ? <Alert>{error}</Alert> : null}
        <PrimaryButton type="submit" loading={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </PrimaryButton>
      </form>
      <div className="mt-5 flex flex-wrap justify-between gap-3 text-sm">
        <Link href="/forgot-password" className="font-medium text-[#0B6E4F]">
          Forgot password
        </Link>
        <Link href="/signup" className="font-medium text-[#0B6E4F]">
          Create account
        </Link>
      </div>
      <p className="mt-3 text-center text-sm text-[var(--lagecto-muted)]">
        Shop owners sign in with a Shop ID.{" "}
        <Link href="/register-shop" className="font-medium text-[#0B6E4F]">
          Register a shop
        </Link>
      </p>
    </>
  );
}
