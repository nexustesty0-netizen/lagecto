"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/ui/primitives";

export function PaymentReturnStatus({ paymentId }: { paymentId: string }) {
  const [status, setStatus] = useState("processing");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      const res = await fetch(`/api/payments/${paymentId}/verify`, { method: "POST" });
      const data = await res.json();
      if (cancelled) return;
      if (!res.ok) {
        setError(data.error || "Unable to verify this payment.");
        return;
      }
      setStatus(data.status || "processing");
    }
    poll();
    const timer = setInterval(poll, 4000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [paymentId]);

  return (
    <div className="mx-auto max-w-lg rounded-3xl bg-white p-6 text-center">
      <h1 className="text-2xl font-semibold">Payment status</h1>
      <div className="mt-4 flex justify-center">
        <StatusBadge value={status} />
      </div>
      <p className="mt-3 text-sm text-[#6B7280]">
        LaGecto confirms payment with the provider. A browser success message is not enough to mark an order paid.
      </p>
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      <Link href="/customer/orders" className="mt-6 inline-block text-sm text-[#0B6E4F]">
        Back to orders
      </Link>
    </div>
  );
}
