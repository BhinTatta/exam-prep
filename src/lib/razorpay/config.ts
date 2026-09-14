import "server-only";

// Razorpay credentials. The key secret and webhook secret must never reach the
// browser — this module is server-only so an accidental client import fails the
// build rather than shipping the secret in a bundle.
//
// The key ID is safe to expose (Checkout needs it), but it is still read here
// and handed to the client through the create-order Server Action, so there is
// one source of truth and no NEXT_PUBLIC_ copy to drift.

type RazorpayCredentials = {
  keyId: string;
  keySecret: string;
};

export function razorpayCredentials(): RazorpayCredentials {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error(
      "Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET."
    );
  }
  return { keyId, keySecret };
}

export function razorpayWebhookSecret(): string {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("Razorpay is not configured. Set RAZORPAY_WEBHOOK_SECRET.");
  }
  return secret;
}

/** True when running against test-mode keys — surfaced in the admin UI. */
export function isRazorpayTestMode(): boolean {
  return (process.env.RAZORPAY_KEY_ID ?? "").startsWith("rzp_test");
}
