"use client";

import { useState } from "react";
import Link from "next/link";
import { CategoryPicker } from "@/components/ui/CategoryPicker";

export function RegisterShopForm({ selfServe }: { selfServe: boolean }) {
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [publicRef, setPublicRef] = useState("");
  const [shopId, setShopId] = useState("");
  const [shopName, setShopName] = useState("");
  const [lookupRef, setLookupRef] = useState("");
  const [lookupPhone, setLookupPhone] = useState("");
  const [lookupResult, setLookupResult] = useState("");
  const [lookupNotes, setLookupNotes] = useState("");
  const [lookingUp, setLookingUp] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setStatus("");
    setPublicRef("");
    setShopId("");
    const form = event.currentTarget;
    const payload = new FormData(form);
    if (selfServe && String(payload.get("password") || "") !== String(payload.get("confirm") || "")) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/shop-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact_name: String(payload.get("contact_name") || ""),
          shop_name: String(payload.get("shop_name") || ""),
          category: String(payload.get("category") || "other"),
          phone: String(payload.get("phone") || ""),
          email: String(payload.get("email") || ""),
          about: String(payload.get("about") || ""),
          provider_type: String(payload.get("provider_type") || "both"),
          password: String(payload.get("password") || ""),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Unable to create this shop.");
        return;
      }
      if (data.created && data.login_shop_id) {
        setShopId(String(data.login_shop_id));
        setShopName(String(data.shop_name || payload.get("shop_name") || "Your shop"));
        form.reset();
        return;
      }
      setPublicRef(String(data.ref || ""));
      setStatus("Request submitted. Keep your reference number — LaGecto will review it and activate your shop.");
      form.reset();
    } catch {
      setError("Unable to submit this right now.");
    } finally {
      setLoading(false);
    }
  }

  async function onLookup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLookupResult("");
    setLookupNotes("");
    setLookingUp(true);
    try {
      const params = new URLSearchParams({ ref: lookupRef.trim(), phone: lookupPhone.trim() });
      const res = await fetch(`/api/shop-requests?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setLookupResult(data.error || "Request not found.");
        return;
      }
      setLookupResult(`${data.shop_name}: ${String(data.status || "pending").replace(/_/g, " ")}`);
      setLookupNotes(data.admin_notes || "No instructions yet. Admins will add notes after they review your request.");
    } catch {
      setLookupResult("Unable to look up this request.");
    } finally {
      setLookingUp(false);
    }
  }

  if (shopId) {
    return (
      <div className="mt-8 grid gap-4 rounded-3xl bg-white p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#0B6E4F]">Shop created</p>
        <h2 className="text-2xl font-semibold">{shopName} is ready</h2>
        <p className="text-sm text-[#6B7280]">
          Save this Shop ID. Use it with the password you just set to sign in. Founding listing lasts 1 month and 3 weeks, then you have 5 days to pay.
        </p>
        <p className="break-all rounded-2xl bg-[#F7F3E3] px-4 py-4 text-center font-mono text-xl font-semibold text-[#0B6E4F]">{shopId}</p>
        <Link href="/login" className="min-h-11 rounded-xl bg-[#0B6E4F] px-4 py-3 text-center font-semibold text-white">
          Sign in with your Shop ID
        </Link>
      </div>
    );
  }

  return (
    <>
      <form onSubmit={onSubmit} className="mt-8 flex min-w-0 flex-col gap-4 overflow-hidden rounded-3xl bg-white p-4 sm:p-6">
        <label className="grid min-w-0 gap-1 text-sm">
          Contact name
          <input name="contact_name" required className="min-w-0 rounded-xl border px-3 py-3" autoComplete="name" />
        </label>
        <label className="grid min-w-0 gap-1 text-sm">
          Shop name
          <input name="shop_name" required className="min-w-0 rounded-xl border px-3 py-3" />
        </label>
        <CategoryPicker name="category" />
        <label className="grid min-w-0 gap-1 text-sm">
          Phone
          <input name="phone" required className="min-w-0 rounded-xl border px-3 py-3" autoComplete="tel" placeholder="+27 82 123 4567" />
        </label>
        <label className="grid min-w-0 gap-1 text-sm">
          Email{selfServe ? "" : " (optional)"}
          <input name="email" type="email" required={selfServe} className="min-w-0 rounded-xl border px-3 py-3" autoComplete="email" />
        </label>
        <label className="grid min-w-0 gap-1 text-sm">
          Provider type
          <select name="provider_type" className="min-w-0 rounded-xl border px-3 py-3">
            <option value="both">Products and services</option>
            <option value="products">Products</option>
            <option value="services">Services</option>
          </select>
        </label>
        <label className="grid min-w-0 gap-1 text-sm">
          About the shop
          <textarea name="about" className="min-h-24 min-w-0 rounded-xl border px-3 py-3" />
        </label>
        {selfServe ? (
          <div className="grid min-w-0 gap-4">
            <label className="grid min-w-0 gap-1 text-sm">
              Password
              <input name="password" type="password" required minLength={8} className="min-w-0 rounded-xl border px-3 py-3" autoComplete="new-password" />
            </label>
            <label className="grid min-w-0 gap-1 text-sm">
              Confirm password
              <input name="confirm" type="password" required minLength={8} className="min-w-0 rounded-xl border px-3 py-3" autoComplete="new-password" />
            </label>
            <p className="text-xs leading-5 text-[#6B7280]">
              Use at least 8 characters with letters and numbers. After creating the shop you sign in with the Shop ID, not your email.
            </p>
          </div>
        ) : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {status ? <p className="text-sm text-emerald-700">{status}</p> : null}
        {publicRef ? <p className="text-sm font-semibold">Your reference: {publicRef}</p> : null}
        <button disabled={loading} className="min-h-11 w-full rounded-xl bg-[#0B6E4F] px-4 py-3 font-semibold text-white">
          {loading ? (selfServe ? "Creating shop…" : "Submitting…") : selfServe ? "Create shop" : "Submit request"}
        </button>
      </form>

      {selfServe ? null : (
        <form onSubmit={onLookup} className="mt-8 grid gap-4 rounded-3xl bg-white p-6">
          <h2 className="font-semibold">Check your request</h2>
          <p className="text-sm text-[#6B7280]">Use your reference number and the phone you submitted. Admins leave instructions here.</p>
          <label className="grid gap-1 text-sm">
            Reference
            <input value={lookupRef} onChange={(e) => setLookupRef(e.target.value)} required className="rounded-xl border px-3 py-3" placeholder="LG-XXXXXXXX" />
          </label>
          <label className="grid gap-1 text-sm">
            Phone
            <input value={lookupPhone} onChange={(e) => setLookupPhone(e.target.value)} required className="rounded-xl border px-3 py-3" />
          </label>
          <button disabled={lookingUp} className="min-h-11 rounded-xl border border-[#0B6E4F] px-4 py-3 font-semibold text-[#0B6E4F]">
            {lookingUp ? "Checking…" : "Check status"}
          </button>
          {lookupResult ? <p className="text-sm font-medium">{lookupResult}</p> : null}
          {lookupNotes ? <p className="text-sm text-[#6B7280]">{lookupNotes}</p> : null}
        </form>
      )}
    </>
  );
}
