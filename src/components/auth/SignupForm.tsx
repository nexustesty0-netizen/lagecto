"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AuthAlert, AuthInput, AuthSubmit } from "@/components/auth/AuthFields";

export function SignupForm() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (loading) return;
    setError("");
    if (!agreed) {
      setError("Please agree to the Terms and Conditions.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, email, phone, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Unable to create this account.");
        return;
      }
      if (data.needsEmailVerification) {
        router.push(`/verify-email?email=${encodeURIComponent(email)}`);
        return;
      }
      router.push("/login");
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <h1 className="auth-title">Create account</h1>
      <p className="auth-subtitle">Join LaGecto to shop local businesses.</p>
      <form onSubmit={onSubmit} className="mt-6 grid gap-3.5">
        <div className="grid gap-3.5 sm:grid-cols-2">
          <AuthInput label="First name" icon="user" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" required />
          <AuthInput label="Last name" icon="user" value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" required />
        </div>
        <AuthInput label="Email address" icon="mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        <AuthInput label="Phone number" icon="phone" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" required />
        <AuthInput label="Password" icon="lock" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required />
        <AuthInput label="Confirm password" icon="lock" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="auth-check mt-0.5" />
          <span>
            I agree to the{" "}
            <Link href="/support/terms" className="auth-link-strong">
              Terms and Conditions
            </Link>
          </span>
        </label>
        {error ? <AuthAlert>{error}</AuthAlert> : null}
        <AuthSubmit type="submit" loading={loading}>
          {loading ? "Creating…" : "Create account"}
        </AuthSubmit>
      </form>
      <p className="auth-footer">
        Already have an account?{" "}
        <Link href="/login" className="auth-link-strong">
          Sign in
        </Link>
      </p>
    </>
  );
}
