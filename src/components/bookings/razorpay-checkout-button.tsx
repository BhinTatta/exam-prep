"use client";

import { useState, useTransition } from "react";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Loader2, Lock } from "lucide-react";
import {
  createPaymentOrder,
  recordPaymentFailure,
  verifyPayment,
} from "@/app/bookings/actions";
import type { RazorpayCheckoutFailure, RazorpayCheckoutResponse } from "@/types/razorpay";

const CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

/** Matches --primary in globals.css. */
const BRAND_COLOR = "#4f51c6";

/** Dim, translucent wash so the booking page stays visible behind the modal
 *  rather than the page being replaced by a flat field of colour. */
const BACKDROP_COLOR = "rgba(20, 18, 28, 0.72)";

export function RazorpayCheckoutButton({
  bookingId,
  amountLabel,
}: {
  bookingId: string;
  amountLabel: string;
}) {
  const [scriptReady, setScriptReady] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [inCheckout, setInCheckout] = useState(false);
  const router = useRouter();

  const busy = isPending || inCheckout;

  function openCheckout() {
    // Must run inside the click handler — browsers block programmatic popups.
    startTransition(async () => {
      let order;
      try {
        order = await createPaymentOrder(bookingId);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't start the payment");
        return;
      }

      const Razorpay = window.Razorpay;
      if (!Razorpay) {
        toast.error("Payment window didn't load. Check your connection and try again.");
        return;
      }

      setInCheckout(true);

      const rzp = new Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: order.name,
        description: order.description,
        order_id: order.orderId,
        prefill: { name: order.prefill.name, email: order.prefill.email },
        theme: { color: BRAND_COLOR, backdrop_color: BACKDROP_COLOR },
        modal: {
          confirm_close: true,
          ondismiss: () => setInCheckout(false),
        },
        retry: { enabled: true, max_count: 4 },
        handler: (response: RazorpayCheckoutResponse) => {
          // Fulfilment does not depend on this firing — the webhook confirms the
          // booking even if the tab closes here. This just gets the payer a fast
          // answer instead of making them wait on the webhook.
          void (async () => {
            try {
              await verifyPayment({
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              });
              toast.success("Payment received — your session is confirmed");
            } catch (e) {
              toast.error(
                e instanceof Error
                  ? e.message
                  : "We received your payment but couldn't confirm it here. It'll update shortly."
              );
            } finally {
              setInCheckout(false);
              router.refresh();
            }
          })();
        },
      });

      rzp.on("payment.failed", (response: RazorpayCheckoutFailure) => {
        setInCheckout(false);
        toast.error(response.error.description || "Payment failed. Please try again.");
        void recordPaymentFailure({
          razorpayOrderId: order.orderId,
          code: response.error.code,
          description: response.error.description,
        }).catch(() => undefined);
      });

      rzp.open();
    });
  }

  return (
    <>
      <Script
        src={CHECKOUT_SRC}
        strategy="afterInteractive"
        onReady={() => setScriptReady(true)}
        onError={() => toast.error("Couldn't load the payment window. Please refresh.")}
      />
      <Button className="w-full gap-1.5" disabled={!scriptReady || busy} onClick={openCheckout}>
        {busy ? (
          <>
            <Loader2 className="size-4 animate-spin" /> Opening secure checkout…
          </>
        ) : (
          <>
            <Lock className="size-4" /> Pay {amountLabel}
          </>
        )}
      </Button>
    </>
  );
}
