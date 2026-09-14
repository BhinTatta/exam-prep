import "server-only";

import crypto from "node:crypto";
import { razorpayCredentials, razorpayWebhookSecret } from "./config";

/**
 * Constant-time compare of two hex digests.
 *
 * `crypto.timingSafeEqual` throws when the buffers differ in length, and a
 * malformed `signature` from the client would otherwise turn a failed check
 * into a 500. Length is not secret, so short-circuiting on it is fine.
 */
function hexEquals(expected: string, received: string): boolean {
  if (typeof received !== "string" || !/^[0-9a-f]+$/i.test(received)) return false;
  if (expected.length !== received.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(received, "hex"));
}

/**
 * Verifies the signature Checkout hands back to the browser after a successful
 * payment: HMAC-SHA256 of "<order_id>|<payment_id>" keyed with the key secret.
 *
 * Pass the order id from OUR database, never the one in the request body —
 * that is the whole point of the check.
 */
export function verifyPaymentSignature(
  razorpayOrderId: string,
  razorpayPaymentId: string,
  signature: string
): boolean {
  const { keySecret } = razorpayCredentials();
  const expected = crypto
    .createHmac("sha256", keySecret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");
  return hexEquals(expected, signature);
}

/**
 * Verifies the X-Razorpay-Signature header on an incoming webhook.
 *
 * `rawBody` must be the exact bytes Razorpay sent. Parsing the JSON and
 * re-serialising it changes the byte sequence and the HMAC will not match,
 * even when the content is identical.
 */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  if (!signature) return false;
  const expected = crypto
    .createHmac("sha256", razorpayWebhookSecret())
    .update(rawBody)
    .digest("hex");
  return hexEquals(expected, signature);
}
