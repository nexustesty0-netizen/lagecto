"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { AuthAlert, AuthInput, AuthSubmit } from "@/components/auth/AuthFields";
import { createBrowserSupabase } from "@/lib/supabase/browser";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = createBrowserSupabase();
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) setError("This reset link is invalid or has expired.");
      setReady(true);
    });
  }, []);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (loading) return;
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    setError("");
    const supabase = createBrowserSupabase();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }
    router.push("/login");
  }

  return (
    <AuthLayout>
      <h1 className="auth-title">Set a new password</h1>
      <p className="auth-subtitle">Choose a password with at least 8 characters, including letters and numbers.</p>
      {!ready ? <p className="auth-subtitle mt-6">Checking this link…</p> : null}
      {ready ? (
        <form onSubmit={onSubmit} className="mt-6 grid gap-3.5">
          <AuthInput label="New password" icon="lock" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" />
          <AuthInput label="Confirm new password" icon="lock" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required autoComplete="new-password" />
          {error ? <AuthAlert>{error}</AuthAlert> : null}
          <AuthSubmit type="submit" loading={loading} disabled={Boolean(error && error.includes("expired"))}>
            {loading ? "Updating…" : "Update password"}
          </AuthSubmit>
          <Link href="/login" className="auth-link text-center">
            Return to login
          </Link>
        </form>
      ) : null}
    </AuthLayout>
  );
}
