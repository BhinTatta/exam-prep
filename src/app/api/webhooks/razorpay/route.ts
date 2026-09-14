import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyWebhookSignature } from "@/lib/razorpay/signature";
import { applyPaymentEntity, applyRefundEntity } from "@/lib/payments/sync";
import type { RazorpayPayment, RazorpayRefund } from "@/lib/razorpay/client";

/**
 * Razorpay webhook endpoint.
 *
 * Register this URL in Dashboard -> Account & Settings -> Webhooks:
 *   {NEXT_PUBLIC_APP_URL}/api/webhooks/razorpay
 *
 * Subscribe to: payment.authorized, payment.captured, payment.failed,
 * order.paid, refund.created, refund.processed, refund.failed,
 * payment.dispute.created.
 *
 * Webhooks are the source of truth for fulfilment. The browser callback can
 * never be relied on alone: the customer may close the tab the instant they pay.
 */

// Payment state must never be cached or prerendered.
export const dynamic = "force-dynamic";

type RazorpayWebhookBody = {
  event: string;
  created_at: number;
  payload?: {
    payment?: { entity?: RazorpayPayment };
    refund?: { entity?: RazorpayRefund };
  };
};

export async function POST(req: Request) {
  // The raw bytes, exactly as sent. Parsing the JSON first and re-serialising
  // changes the byte sequence and the HMAC will not match.
  const raw = await req.text();

  let signatureOk: boolean;
  try {
    signatureOk = verifyWebhookSignature(raw, req.headers.get("x-razorpay-signature"));
  } catch (err) {
    // Missing RAZORPAY_WEBHOOK_SECRET — a 500 keeps Razorpay retrying while we fix it.
    console.error("razorpay webhook: not configured", err);
    return new Response("Webhook not configured", { status: 500 });
  }

  if (!signatureOk) {
    return new Response("Invalid signature", { status: 400 });
  }

  let body: RazorpayWebhookBody;
  try {
    body = JSON.parse(raw) as RazorpayWebhookBody;
  } catch {
    return new Response("Malformed payload", { status: 400 });
  }

  // Razorpay's own delivery id. Retries of the same event reuse it, which makes
  // it the idempotency key. Fall back to a synthesised one if the header is
  // ever absent, so a missing header cannot collapse distinct events together.
  const eventId =
    req.headers.get("x-razorpay-event-id") ?? `${body.event}:${body.created_at}:${raw.length}`;

  // Deliveries can lag: Razorpay retries a failure hourly for 24 hours, and those
  // retries carry the ORIGINAL created_at. We deliberately do not drop old events
  // (the Razorpay guide suggests a 5-minute cutoff) — that would discard exactly
  // the events we need after an outage. The HMAC already prevents forgery, and
  // every transition applied below is idempotent, so a replay is harmless.
  const ageSeconds = Math.round(Date.now() / 1000 - (body.created_at ?? 0));

  // Claim the event. The unique constraint on eventId is what makes concurrent
  // deliveries safe: exactly one insert wins.
  const paymentEntity = body.payload?.payment?.entity;
  const refundEntity = body.payload?.refund?.entity;

  try {
    await prisma.webhookEvent.create({
      data: {
        eventId,
        event: body.event,
        payload: body as unknown as Prisma.InputJsonValue,
        razorpayOrderId: paymentEntity?.order_id ?? null,
        razorpayPaymentId: paymentEntity?.id ?? refundEntity?.payment_id ?? null,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const seen = await prisma.webhookEvent.findUnique({ where: { eventId } });
      // Already handled — acknowledge and stop.
      if (seen?.processedAt) return new Response("Duplicate", { status: 200 });
      // Seen but never finished (a previous attempt threw): fall through and retry it.
    } else {
      console.error("razorpay webhook: could not record event", err);
      return new Response("Storage error", { status: 500 });
    }
  }

  try {
    await handleEvent(body);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("razorpay webhook: processing failed", {
      eventId,
      event: body.event,
      ageSeconds,
      error: message,
    });
    await prisma.webhookEvent
      .update({ where: { eventId }, data: { error: message } })
      .catch(() => undefined);
    // 500 so Razorpay retries. Processing runs inline rather than on a queue:
    // each event is a handful of indexed writes, well inside the 5s budget, and
    // returning 200 before doing the work would forfeit those retries.
    return new Response("Processing failed", { status: 500 });
  }

  await prisma.webhookEvent.update({
    where: { eventId },
    data: { processedAt: new Date(), error: null },
  });

  return new Response("OK", { status: 200 });
}

async function handleEvent(body: RazorpayWebhookBody): Promise<void> {
  const payment = body.payload?.payment?.entity;
  const refund = body.payload?.refund?.entity;

  switch (body.event) {
    case "payment.authorized":
    case "payment.captured":
    case "payment.failed":
      if (payment) await applyPaymentEntity(payment);
      break;

    case "order.paid":
      // Carries the payment that completed the order; the payment.* events do
      // the real work, so this is just a safety net for a missed delivery.
      if (payment) await applyPaymentEntity(payment);
      break;

    case "refund.created":
    case "refund.processed":
      if (refund) await applyRefundEntity(refund);
      break;

    case "refund.failed":
      if (refund) {
        await applyRefundEntity(refund);
        // The money did not go back. Razorpay's guidance is explicit: never
        // retry automatically, a human has to pick this up.
        console.error("razorpay: REFUND FAILED — needs manual follow-up", {
          refundId: refund.id,
          paymentId: refund.payment_id,
          amount: refund.amount,
        });
      }
      break;

    case "payment.dispute.created":
      if (payment?.order_id) {
        const row = await prisma.payment.findUnique({
          where: { razorpayOrderId: payment.order_id },
          select: { bookingId: true },
        });
        if (row) {
          await prisma.booking.updateMany({
            where: { id: row.bookingId, status: { in: ["CONFIRMED", "COMPLETED"] } },
            data: { status: "DISPUTED" },
          });
        }
        console.error("razorpay: DISPUTE RAISED — respond in the Dashboard within 7 days", {
          paymentId: payment.id,
        });
      }
      break;

    default:
      // Recorded in WebhookEvent and acknowledged; nothing to do.
      break;
  }
}
