import { MockPaymentProvider } from "./mock-provider";
import type { PaymentProvider } from "./types";

export type { PaymentProvider, PaymentRequest, PaymentResult, CreatePaymentOutcome, WebhookEvent } from "./types";

const providers: Record<string, () => PaymentProvider> = {
  mock: () => new MockPaymentProvider(),
  // Add real providers here as they're built, e.g.:
  //   paddle: () => new PaddlePaymentProvider(),
  // and switch PAYMENT_PROVIDER in .env.local / Vercel — nothing that
  // calls getPaymentProvider() needs to change.
};

/**
 * The one place that decides which payment provider is active, driven by
 * the PAYMENT_PROVIDER env var (defaults to "mock" — free-plan/no-account
 * test mode). Everything else in the app calls this instead of importing
 * a specific provider.
 */
export function getPaymentProvider(): PaymentProvider {
  const name = process.env.PAYMENT_PROVIDER || "mock";
  const factory = providers[name];
  if (!factory) {
    throw new Error(`Unknown PAYMENT_PROVIDER "${name}". Known providers: ${Object.keys(providers).join(", ")}`);
  }
  return factory();
}

/** Named lookup by provider string (e.g. from a webhook URL's [provider] segment). */
export function getPaymentProviderByName(name: string): PaymentProvider | null {
  const factory = providers[name];
  return factory ? factory() : null;
}
