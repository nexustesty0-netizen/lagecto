import { getSiteUrl } from "@/lib/env";
import type { PaymentProviderId } from "@/lib/payments/methods";

export type PaymentMode = "test" | "live";

export function marketplaceOnlinePaymentsEnabled() {
  return process.env.LAGECTO_MARKETPLACE_ONLINE_PAYMENTS === "true";
}

export const MARKETPLACE_PAYMENTS_DISABLED_MESSAGE =
  "LaGecto does not process customer payments. Checkout is via WhatsApp with the shop.";

export function getPaymentMode(): PaymentMode {
  return process.env.PAYMENT_MODE === "live" ? "live" : "test";
}

export function getConfiguredProvider(): PaymentProviderId {
  const value = String(process.env.PAYMENT_PROVIDER || "sandbox").toLowerCase();
  if (value === "paynow") return "paynow";
  if (value === "cash") return "cash";
  return "sandbox";
}

export function getPaynowCredentials() {
  const integrationId = String(process.env.PAYNOW_INTEGRATION_ID || "").trim();
  const integrationKey = String(process.env.PAYNOW_INTEGRATION_KEY || "").trim();
  return {
    integrationId,
    integrationKey,
    configured: Boolean(integrationId && integrationKey),
  };
}

export function getPaymentPublicConfig() {
  const provider = getConfiguredProvider();
  const mode = getPaymentMode();
  const paynow = getPaynowCredentials();
  return {
    provider,
    mode,
    paynowConfigured: provider === "paynow" && paynow.configured,
    canChargeLive: mode === "live" && provider === "paynow" && paynow.configured,
    siteUrl: getSiteUrl(),
  };
}

export function digitalProviderForMethod(method: string): Exclude<PaymentProviderId, "cash"> {
  if (method === "cash") {
    throw new Error("Cash does not use a digital provider.");
  }
  const configured = getConfiguredProvider();
  if (configured === "paynow" && getPaynowCredentials().configured) return "paynow";
  return "sandbox";
}

export function assertProviderCanCollect(method: string) {
  if (method === "cash") return;
  const mode = getPaymentMode();
  const provider = digitalProviderForMethod(method);
  if (mode === "live" && provider === "sandbox") {
    throw new Error("Live card and EcoCash payments are not enabled. Configure Paynow credentials first.");
  }
  if (mode === "live" && provider === "paynow" && !getPaynowCredentials().configured) {
    throw new Error("PAYNOW_INTEGRATION_ID and PAYNOW_INTEGRATION_KEY must be set for live payments.");
  }
}
