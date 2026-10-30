import type { CreatePaymentInput, CreatePaymentResult, PaymentGateway, ProviderVerification, RefundProviderResult } from "@/lib/payments/types";

export const sandboxGateway: PaymentGateway = {
  id: "sandbox",

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    return {
      provider: "sandbox",
      redirectUrl: `/customer/payments/${input.paymentId}/sandbox`,
      pollUrl: null,
      providerTransactionId: `SANDBOX-${input.paymentId}`,
      instructions: "Test mode: no real money is charged. Confirm or fail the payment on the next screen.",
      status: "processing",
    };
  },

  async verifyPayment(input): Promise<ProviderVerification> {
    return {
      status: "processing",
      providerStatus: "sandbox_pending",
      amount: 0,
      currency: "USD",
      providerTransactionId: input.providerTransactionId || `SANDBOX-${input.paymentId}`,
    };
  },

  async handleWebhook(): Promise<{ reference: string; verification: ProviderVerification; signatureValid: boolean }> {
    throw new Error("Sandbox payments are confirmed in LaGecto test checkout, not by a provider webhook.");
  },

  async refundPayment(): Promise<RefundProviderResult> {
    return {
      supported: false,
      status: "requested",
      message: "Sandbox does not move real funds. Record the refund request, then complete a cash refund or a provider refund once Paynow is connected.",
    };
  },
};
