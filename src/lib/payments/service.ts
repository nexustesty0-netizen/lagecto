import { createHash, randomUUID } from "crypto";
import { createServerSupabase } from "@/lib/supabase/server";
import { createServiceSupabase } from "@/lib/supabase/service";
import { getSiteUrl } from "@/lib/env";
import {
  assertProviderCanCollect,
  digitalProviderForMethod,
  getConfiguredProvider,
  getPaymentMode,
  MARKETPLACE_PAYMENTS_DISABLED_MESSAGE,
  marketplaceOnlinePaymentsEnabled,
} from "@/lib/payments/config";
import { sandboxGateway } from "@/lib/payments/providers/sandbox";
import { paynowGateway } from "@/lib/payments/providers/paynow";
import { normalizePaymentMethod, type PaymentMethod } from "@/lib/payments/methods";
import type { PaymentGateway, ProviderVerification } from "@/lib/payments/types";

function gatewayFor(provider: string): PaymentGateway {
  if (provider === "paynow") return paynowGateway;
  return sandboxGateway;
}

function payloadHash(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}

export const PaymentService = {
  createPayment,
  verifyPayment,
  getPaymentStatus,
  handleWebhook,
  refundPayment,
};

async function createPayment(input: {
  orderId: string;
  method: string;
  customerPhone?: string | null;
  idempotencyKey?: string | null;
}) {
  if (!marketplaceOnlinePaymentsEnabled()) {
    return { ok: false as const, error: MARKETPLACE_PAYMENTS_DISABLED_MESSAGE };
  }
  const method = normalizePaymentMethod(input.method);
  if (!method) return { ok: false as const, error: "Choose Visa, Mastercard, EcoCash, or Cash." };

  const supabase = await createServerSupabase();
  const service = createServiceSupabase();
  const provider = method === "cash" ? "cash" : digitalProviderForMethod(method);

  try {
    assertProviderCanCollect(method);
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Payments are not configured." };
  }

  const { data: allowed } = await service.rpc("check_auth_rate_limit", {
    p_bucket_key: `pay:${input.orderId}`,
    p_max_hits: 8,
    p_window_seconds: 120,
  });
  if (allowed === false) {
    return { ok: false as const, error: "Too many payment attempts. Please wait a moment." };
  }

  const idempotencyKey = input.idempotencyKey || `${input.orderId}:${method}`;
  const created = await supabase.rpc("create_order_payment", {
    p_order_id: input.orderId,
    p_payment_method: method,
    p_idempotency_key: idempotencyKey,
    p_provider: provider,
  });
  if (created.error) return { ok: false as const, error: "Unable to start this payment." };
  if (created.data?.ok === false) return { ok: false as const, error: created.data.error };
  const payment = created.data as {
    payment_id: string;
    amount: number;
    currency: string;
    payment_method: PaymentMethod;
    payment_provider: string;
    order_id: string;
    order_number: string;
    shop_id: string;
    status: string;
    browser_url?: string | null;
    reused?: boolean;
    review_required?: boolean;
  };

  if (payment.review_required) {
    return { ok: false as const, error: "This payment needs review before another attempt." };
  }

  if (method === "cash") {
    return {
      ok: true as const,
      paymentId: payment.payment_id,
      status: "pending",
      amount: payment.amount,
      currency: payment.currency,
      method,
      next: "cash_pending" as const,
    };
  }

  if (payment.reused) {
    return {
      ok: true as const,
      paymentId: payment.payment_id,
      status: payment.status,
      amount: payment.amount,
      currency: payment.currency,
      method,
      redirectUrl: payment.browser_url,
      next: payment.browser_url ? ("redirect" as const) : ("wait" as const),
    };
  }

  const { data: order } = await service
    .from("orders")
    .select("customer_email, customer_phone")
    .eq("id", payment.order_id)
    .maybeSingle();

  const site = getSiteUrl();
  const gateway = gatewayFor(provider);
  try {
    const session = await gateway.createPayment({
      paymentId: payment.payment_id,
      orderId: payment.order_id,
      orderNumber: payment.order_number,
      shopId: payment.shop_id,
      amount: Number(payment.amount),
      currency: payment.currency,
      method,
      customerEmail: order?.customer_email || null,
      customerPhone: input.customerPhone || order?.customer_phone || null,
      returnUrl: `${site}/customer/payments/${payment.payment_id}/return`,
      resultUrl: `${site}/api/payments/webhooks/${gateway.id}`,
      idempotencyKey,
    });

    await service.rpc("attach_payment_provider_session", {
      p_payment_id: payment.payment_id,
      p_provider_transaction_id: session.providerTransactionId || "",
      p_poll_url: session.pollUrl || "",
      p_browser_url: session.redirectUrl || "",
      p_status: "processing",
    });

    return {
      ok: true as const,
      paymentId: payment.payment_id,
      status: "processing",
      amount: payment.amount,
      currency: payment.currency,
      method,
      redirectUrl: session.redirectUrl,
      instructions: session.instructions,
      next: session.redirectUrl ? ("redirect" as const) : ("wait" as const),
    };
  } catch (error) {
    await service.rpc("fail_payment_attempt", {
      p_payment_id: payment.payment_id,
      p_reason: error instanceof Error ? error.message : "Provider error",
    });
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "The payment provider could not start this payment.",
    };
  }
}

async function getPaymentStatus(paymentId: string) {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("payments")
    .select(
      "id, order_id, shop_id, customer_id, payment_method, payment_provider, amount, currency, status, provider_transaction_id, masked_instrument, failure_reason, review_reason, paid_at, created_at, updated_at",
    )
    .eq("id", paymentId)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

async function applyVerification(paymentId: string, verification: ProviderVerification) {
  const service = createServiceSupabase();
  const { data, error } = await service.rpc("apply_verified_payment", {
    p_payment_id: paymentId,
    p_provider_transaction_id: verification.providerTransactionId || "",
    p_provider_status: verification.providerStatus,
    p_amount: verification.amount,
    p_currency: verification.currency,
    p_masked_instrument: verification.maskedInstrument || "",
  });
  if (error) return { ok: false as const, error: "Unable to apply this payment result." };
  if (data?.ok === false) return { ok: false as const, error: data.error, status: data.status };
  return { ok: true as const, ...data };
}

async function verifyPayment(paymentId: string) {
  const service = createServiceSupabase();
  const { data: payment } = await service.from("payments").select("*").eq("id", paymentId).maybeSingle();
  if (!payment) return { ok: false as const, error: "Payment not found." };
  if (payment.status === "paid") return { ok: true as const, status: "paid", duplicate: true, payment_id: payment.id };
  if (payment.payment_method === "cash") {
    return { ok: true as const, status: payment.status, payment_id: payment.id };
  }

  const gateway = gatewayFor(payment.payment_provider);
  const verification = await gateway.verifyPayment({
    paymentId: payment.id,
    pollUrl: payment.poll_url,
    providerTransactionId: payment.provider_transaction_id,
  });
  if (verification.status === "processing" && verification.amount <= 0) {
    return { ok: true as const, status: payment.status, payment_id: payment.id };
  }
  return applyVerification(payment.id, {
    ...verification,
    amount: verification.amount || Number(payment.amount),
    currency: verification.currency || payment.currency,
  });
}

async function handleWebhook(provider: string, rawBody: string, headers: Headers) {
  if (provider !== "paynow") {
    return { ok: false as const, error: "Unknown payment provider.", status: 400 };
  }
  const service = createServiceSupabase();
  const hash = payloadHash(`${provider}:${rawBody}`);
  let parsed: { reference: string; verification: ProviderVerification; signatureValid: boolean };
  try {
    parsed = await paynowGateway.handleWebhook(rawBody, headers);
  } catch {
    await service.rpc("record_payment_webhook", {
      p_provider: provider,
      p_payload_hash: hash,
      p_provider_transaction_id: "",
      p_signature_valid: false,
    });
    return { ok: false as const, error: "Invalid webhook.", status: 400 };
  }

  const recorded = await service.rpc("record_payment_webhook", {
    p_provider: provider,
    p_payload_hash: hash,
    p_provider_transaction_id: parsed.verification.providerTransactionId || "",
    p_signature_valid: parsed.signatureValid,
  });
  if (recorded.data?.duplicate) {
    return { ok: true as const, duplicate: true };
  }

  const { data: payment } = await service
    .from("payments")
    .select("id, amount, currency, poll_url, payment_provider")
    .eq("id", parsed.reference)
    .maybeSingle();
  if (!payment) {
    return { ok: false as const, error: "Payment not found.", status: 404 };
  }

  let verification = parsed.verification;
  try {
    const polled = await paynowGateway.verifyPayment({
      paymentId: payment.id,
      pollUrl: payment.poll_url || verification.pollUrl,
      providerTransactionId: verification.providerTransactionId,
    });
    verification = {
      ...polled,
      amount: polled.amount || Number(payment.amount),
      currency: polled.currency || payment.currency,
    };
  } catch {
    verification = {
      ...verification,
      amount: verification.amount || Number(payment.amount),
      currency: verification.currency || payment.currency,
    };
  }

  const applied = await applyVerification(payment.id, verification);
  if (recorded.data?.id) {
    await service.rpc("mark_payment_webhook_processed", { p_id: recorded.data.id });
  }
  if (!applied.ok) return { ok: false as const, error: applied.error, status: 409 };
  return { ok: true as const, ...applied };
}

async function refundPayment(input: {
  paymentId: string;
  amount: number;
  reason?: string;
  kind?: "provider" | "cash";
}) {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("request_payment_refund", {
    p_payment_id: input.paymentId,
    p_amount: input.amount,
    p_reason: input.reason || "",
    p_kind: input.kind || "provider",
  });
  if (error) return { ok: false as const, error: "Unable to request this refund." };
  if (data?.ok === false) return { ok: false as const, error: data.error };

  if ((input.kind || "provider") === "cash") {
    return {
      ok: true as const,
      ...data,
      provider: { supported: false, message: "Confirm the cash refund after money is returned." },
    };
  }

  const service = createServiceSupabase();
  const { data: payment } = await service
    .from("payments")
    .select("payment_provider, provider_transaction_id")
    .eq("id", input.paymentId)
    .maybeSingle();
  const gateway = gatewayFor(payment?.payment_provider || "sandbox");
  const providerResult = await gateway.refundPayment({
    paymentId: input.paymentId,
    providerTransactionId: payment?.provider_transaction_id,
    amount: input.amount,
    reason: input.reason,
  });
  return { ok: true as const, ...data, provider: providerResult };
}

export function newIdempotencyKey(orderId: string, method: string) {
  return `${orderId}:${method}:${randomUUID()}`;
}

export function describePaymentEnvironment() {
  return {
    provider: getConfiguredProvider(),
    mode: getPaymentMode(),
  };
}
