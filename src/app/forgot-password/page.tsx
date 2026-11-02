"use client";

import { useState } from "react";
import Link from "next/link";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { AuthAlert, AuthInput, AuthSubmit } from "@/components/auth/AuthFields";

export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    await fetch("/api/auth/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier }),
    });
    setLoading(false);
    setDone(true);
  }

  return (
    <AuthLayout>
      <h1 className="auth-title">Forgot your password?</h1>
      <p className="auth-subtitle">
        Enter the email, phone or Shop ID for your account. If it exists, we will send a reset link.
      </p>
      {done ? (
        <div className="mt-6 grid gap-4">
          <AuthAlert tone="success">If an account exists, that inbox has a reset link.</AuthAlert>
          <Link href="/login" className="auth-link-strong">
            Return to login
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-6 grid gap-3.5">
          <AuthInput
            label="Email address"
            icon="mail"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
          />
          <AuthSubmit type="submit" loading={loading}>
            {loading ? "Sending…" : "Send reset link"}
          </AuthSubmit>
          <Link href="/login" className="auth-link text-center">
            Return to login
          </Link>
        </form>
      )}
    </AuthLayout>
  );
}
