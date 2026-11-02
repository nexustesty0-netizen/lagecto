"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { MailCheck } from "lucide-react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { AuthAlert, AuthSubmit } from "@/components/auth/AuthFields";

function VerifyEmailInner() {
  const params = useSearchParams();
  const email = params.get("email") || "";
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function resend() {
    if (!email || loading) return;
    setLoading(true);
    await fetch("/api/auth/resend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setMessage("If this email can be verified, a new message is on the way.");
    setLoading(false);
  }

  return (
    <>
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-[#006B35]/12 text-[#006B35] md:bg-[#F3F8F4]">
        <MailCheck size={28} />
      </div>
      <h1 className="auth-title">Check your email</h1>
      <p className="auth-subtitle">
        We sent a verification link{email ? ` to ${email}` : ""}. Open it to finish creating your account, then sign in.
      </p>
      {message ? <AuthAlert tone="success">{message}</AuthAlert> : null}
      <div className="mt-6 grid gap-3">
        <AuthSubmit type="button" loading={loading} onClick={() => void resend()} disabled={!email}>
          {loading ? "Sending…" : "Resend verification email"}
        </AuthSubmit>
        <Link href="/login" className="auth-link text-center">
          Return to login
        </Link>
      </div>
    </>
  );
}

export default function VerifyEmailPage() {
  return (
    <AuthLayout>
      <Suspense>
        <VerifyEmailInner />
      </Suspense>
    </AuthLayout>
  );
}
