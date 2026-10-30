"use client";

import { useState } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { Alert, PrimaryButton, TextField } from "@/components/ui/forms";

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
    <AuthShell
      title="Reset password"
      subtitle="Enter your email, username or Shop ID. If an account exists, we will send reset instructions."
    >
      {done ? (
        <div className="grid gap-4">
          <Alert tone="success">If an account exists, instructions are on the way.</Alert>
          <Link href="/login" className="text-sm font-medium text-[#0B6E4F]">
            Back to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="grid gap-4">
          <TextField
            label="Email, username or Shop ID"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
          />
          <PrimaryButton type="submit" loading={loading}>
            Send reset link
          </PrimaryButton>
          <Link href="/login" className="text-sm font-medium text-[#0B6E4F]">
            Back to sign in
          </Link>
        </form>
      )}
    </AuthShell>
  );
}
