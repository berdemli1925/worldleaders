import type { CreatePaymentOutcome, PaymentProvider, PaymentRequest, WebhookEvent } from "./types";

// Test-mode provider: every payment succeeds immediately, synchronously —
// no real checkout page, no real webhook round-trip. Still goes through
// the exact same createPayment()/finalize_payment() path a real provider
// would, so the surrounding plumbing (payments table, idempotent
// finalization, claim_throne()'s own validation) is genuinely exercised,
// not bypassed.
export class MockPaymentProvider implements PaymentProvider {
  readonly name = "mock";

  async createPayment(request: PaymentRequest): Promise<CreatePaymentOutcome> {
    const providerReference = `mock_${request.paymentId}_${Date.now()}`;
    return {
      providerReference,
      immediateResult: { ok: true },
    };
  }

  async parseWebhook(): Promise<WebhookEvent | null> {
    // The mock provider never sends a real webhook (createPayment already
    // resolves synchronously above) — this exists purely so the interface
    // shape is complete and /api/payments/webhook/[provider] has
    // something to call regardless of which provider is active.
    return null;
  }
}
