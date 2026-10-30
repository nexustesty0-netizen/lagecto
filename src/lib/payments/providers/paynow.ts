import { getPaynowCredentials } from "@/lib/payments/config";
import { parseFormPairs, paynowHash, toPaynowQuery, verifyPaynowHash } from "@/lib/payments/paynow-hash";
import { maskInstrument } from "@/lib/payments/sanitize";
import type {
  CreatePaymentInput,
  CreatePaymentResult,
  PaymentGateway,
  ProviderVerification,
  RefundProviderResult,
} from "@/lib/payments/types";
import type { PaymentStatus } from "@/lib/payments/methods";

const INITIATE_URL = "https://www.paynow.co.zw/interface/initiatetransaction";
const REMOTE_URL = "https://www.paynow.co.zw/interface/remotetransaction";

function requireCredentials() {
  const creds = getPaynowCredentials();
  if (!creds.configured) {
    throw new Error("Paynow is not configured. Set PAYNOW_INTEGRATION_ID and PAYNOW_INTEGRATION_KEY on the server.");
  }
  return creds;
}

function mapPaynowStatus(status: string): PaymentStatus | "processing" {
  const value = status.trim().toLowerCase();
  if (value === "paid" || value === "awaiting delivery" || value === "delivered") return "paid";
  if (value === "cancelled" || value === "canceled") return "cancelled";
  if (value === "refunded") return "refunded";
  if (value === "disputed") return "review_required";
  return "processing";
}

function pairsToObject(pairs: Array<[string, string]>) {
  return Object.fromEntries(pairs.map(([key, value]) => [key.toLowerCase(), value]));
}

function verificationFromPairs(pairs: Array<[string, string]>, signatureValid: boolean): ProviderVerification {
  const fields = pairsToObject(pairs);
  const amount = Number(fields.amount || 0);
  return {
    status: mapPaynowStatus(fields.status || ""),
    providerStatus: fields.status || "Unknown",
    amount,
    currency: "USD",
    providerTransactionId: fields.paynowreference || null,
    maskedInstrument: maskInstrument(fields.paymentinstrument),
    pollUrl: fields.pollurl || null,
  };
}

async function postPaynow(url: string, fields: Array<[string, string]>) {
  const body = toPaynowQuery(fields);
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const raw = await response.text();
  const pairs = parseFormPairs(raw.replace(/\r/g, ""));
  return { raw, pairs, ok: response.ok };
}

function initiateFields(input: CreatePaymentInput, creds: { integrationId: string; integrationKey: string }) {
  const fields: Array<[string, string]> = [
    ["id", creds.integrationId],
    ["reference", input.paymentId],
    ["amount", Number(input.amount).toFixed(2)],
    ["additionalinfo", `LaGecto ${input.orderNumber} ${input.method}`],
    ["returnurl", input.returnUrl],
    ["resulturl", input.resultUrl],
    ["status", "Message"],
  ];
  if (input.customerEmail) fields.push(["authemail", input.customerEmail]);
  return fields;
}

export const paynowGateway: PaymentGateway = {
  id: "paynow",

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const creds = requireCredentials();
    const useExpress = input.method === "ecocash" && Boolean(input.customerPhone);
    const fields = initiateFields(input, creds);
    if (useExpress) {
      fields.push(["method", "ecocash"]);
      fields.push(["phone", String(input.customerPhone)]);
    }
    const unsigned = fields.map(([, value]) => value);
    fields.push(["hash", paynowHash(unsigned, creds.integrationKey)]);

    const { pairs } = await postPaynow(useExpress ? REMOTE_URL : INITIATE_URL, fields);
    const data = pairsToObject(pairs);
    if (!verifyPaynowHash(pairs, creds.integrationKey)) {
      throw new Error("Paynow response hash was invalid.");
    }
    if (String(data.status || "").toLowerCase() !== "ok") {
      throw new Error(data.error || data.status || "Paynow did not accept this payment.");
    }

    return {
      provider: "paynow",
      redirectUrl: data.browserurl || null,
      pollUrl: data.pollurl || null,
      providerTransactionId: data.paynowreference || null,
      instructions: useExpress
        ? "Approve the EcoCash prompt on your phone. LaGecto never asks for your EcoCash PIN."
        : "Enter card details on the Paynow checkout page. LaGecto never stores card numbers or CVV.",
      status: "processing",
    };
  },

  async verifyPayment(input): Promise<ProviderVerification> {
    const creds = requireCredentials();
    if (!input.pollUrl) {
      return {
        status: "processing",
        providerStatus: "missing_poll_url",
        amount: 0,
        currency: "USD",
        providerTransactionId: input.providerTransactionId || null,
      };
    }
    const response = await fetch(input.pollUrl, { method: "GET" });
    const raw = await response.text();
    const pairs = parseFormPairs(raw.replace(/\r/g, ""));
    if (!verifyPaynowHash(pairs, creds.integrationKey)) {
      throw new Error("Paynow poll hash was invalid.");
    }
    return verificationFromPairs(pairs, true);
  },

  async handleWebhook(rawBody: string) {
    const creds = requireCredentials();
    const pairs = parseFormPairs(rawBody);
    const signatureValid = verifyPaynowHash(pairs, creds.integrationKey);
    if (!signatureValid) {
      throw new Error("Invalid Paynow webhook signature.");
    }
    const fields = pairsToObject(pairs);
    return {
      reference: fields.reference,
      verification: verificationFromPairs(pairs, true),
      signatureValid: true,
    };
  },

  async refundPayment(): Promise<RefundProviderResult> {
    return {
      supported: false,
      status: "requested",
      message:
        "Paynow merchant refunds are completed in the Paynow dashboard. LaGecto records a refund request until a provider refund reference is confirmed.",
    };
  },
};
