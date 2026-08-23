// Provider-agnostic payment interface — the whole point is that swapping
// the mock provider for Paddle (or anyone else) later only means adding a
// new file that implements this interface and pointing getPaymentProvider()
// (see index.ts) at it. Nothing outside src/lib/payments/ should ever
// import a specific provider directly.

export interface PaymentRequest {
  /** Our internal payments.id — already inserted with status='pending' before this is called. */
  paymentId: number;
  countryIsoCode: string;
  xHandle: string;
  /** Net amount to actually charge, in USD, after credit has been applied. */
  amount: number;
  description: string;
}

export interface PaymentResult {
  ok: boolean;
  /** Present when ok is false — never shown verbatim to the payer beyond a generic message. */
  reason?: string;
}

export interface CreatePaymentOutcome {
  /** Opaque id this provider uses to refer to the payment — stored on payments.provider_reference. */
  providerReference: string;
  /** Present for a redirect-based provider — the caller should send the payer here to complete payment. */
  checkoutUrl?: string;
  /**
   * Present for a provider that can resolve synchronously (the mock
   * provider always does — "test mode always succeeds"). When absent, the
   * outcome arrives later via parseWebhook() instead.
   */
  immediateResult?: PaymentResult;
}

export interface WebhookEvent {
  providerReference: string;
  result: PaymentResult;
}

export interface PaymentProvider {
  readonly name: string;
  createPayment(request: PaymentRequest): Promise<CreatePaymentOutcome>;
  /**
   * Verifies and normalizes an incoming webhook request into a
   * WebhookEvent, or null if the request isn't a recognized/validly-signed
   * event from this provider. Never throws for "not our event" — only for
   * genuinely unexpected errors.
   */
  parseWebhook(request: Request): Promise<WebhookEvent | null>;
}
