"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AuthAlert, AuthInput, AuthSubmit } from "@/components/auth/AuthFields";
import { safePostLoginPath } from "@/lib/security";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const loggedOut = params.get("logged_out") === "1";
  const oauthError = params.get("error");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState(
    params.get("locked")
      ? "This account is locked. Contact LaGecto support."
      : oauthError === "access_denied"
        ? "Google sign-in was cancelled."
        : oauthError
          ? "Google sign-in did not finish. Try again."
          : "",
  );
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
        body: JSON.stringify({ identifier, password, remember }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Sign in failed.");
        return;
      }
      router.push(safePostLoginPath(params.get("next"), data.redirectTo || "/app"));
      router.refresh();
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <h1 className="auth-title">Welcome back</h1>
      <p className="auth-subtitle">Sign in to your LaGecto account.</p>
      {params.get("setup") ? (
        <AuthAlert>Connect the new Supabase project in .env.local before signing in.</AuthAlert>
      ) : null}
      {loggedOut ? <AuthAlert tone="success">Signed out.</AuthAlert> : null}
      {locked && !params.get("setup") ? (
        <AuthAlert>This account is locked. Contact LaGecto support to restore access.</AuthAlert>
      ) : null}
      <form onSubmit={onSubmit} className="mt-6 grid gap-3.5" autoComplete={loggedOut ? "off" : "on"}>
        <AuthInput
          label="Email"
          icon="mail"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          autoComplete={loggedOut ? "off" : "username"}
          placeholder=""
          required
        />
        <AuthInput
          label="Password"
          icon="lock"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={loggedOut ? "new-password" : "current-password"}
          required
        />
        <div className="flex items-center justify-between gap-3 text-sm">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="auth-check"
            />
            Remember me
          </label>
          <Link href="/forgot-password" className="auth-link">
            Forgot password?
          </Link>
        </div>
        {error && !locked ? <AuthAlert>{error}</AuthAlert> : null}
        <AuthSubmit type="submit" loading={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </AuthSubmit>
      </form>
      <p className="auth-footer">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="auth-link-strong">
          Create account
        </Link>
      </p>
    </>
  );
}
