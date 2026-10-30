import type { PaymentMethod, PaymentProviderId, PaymentStatus } from "@/lib/payments/methods";

export type CreatePaymentInput = {
  paymentId: string;
  orderId: string;
  orderNumber: string;
  shopId: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  customerEmail?: string | null;
  customerPhone?: string | null;
  returnUrl: string;
  resultUrl: string;
  idempotencyKey: string;
};

export type CreatePaymentResult = {
  provider: PaymentProviderId;
  redirectUrl?: string | null;
  pollUrl?: string | null;
  providerTransactionId?: string | null;
  instructions?: string | null;
  status: "pending" | "processing";
};

export type ProviderVerification = {
  status: PaymentStatus | "processing";
  providerStatus: string;
  amount: number;
  currency: string;
  providerTransactionId?: string | null;
  maskedInstrument?: string | null;
  pollUrl?: string | null;
};

export type RefundProviderResult = {
  supported: boolean;
  status: "requested" | "completed" | "failed";
  providerRefundId?: string | null;
  message: string;
};

export type PaymentGateway = {
  id: Exclude<PaymentProviderId, "cash">;
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  verifyPayment(input: {
    paymentId: string;
    pollUrl?: string | null;
    providerTransactionId?: string | null;
  }): Promise<ProviderVerification>;
  handleWebhook(rawBody: string, headers: Headers): Promise<{
    reference: string;
    verification: ProviderVerification;
    signatureValid: boolean;
  }>;
  refundPayment(input: {
    paymentId: string;
    providerTransactionId?: string | null;
    amount: number;
    reason?: string | null;
  }): Promise<RefundProviderResult>;
};
