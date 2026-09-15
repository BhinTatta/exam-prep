// Types for Razorpay's Standard Checkout script, which attaches a `Razorpay`
// constructor to `window`. Loaded from the Razorpay CDN (never self-hosted) by
// src/components/bookings/razorpay-checkout-button.tsx.

export type RazorpayCheckoutResponse = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

export type RazorpayCheckoutFailure = {
  error: {
    code: string;
    description: string;
    source?: string;
    step?: string;
    reason?: string;
    metadata?: { order_id?: string; payment_id?: string };
  };
};

export type RazorpayCheckoutOptions = {
  key: string;
  amount: number; // paise — must match the order exactly
  currency: string;
  name: string;
  description?: string;
  image?: string;
  order_id: string;
  handler?: (response: RazorpayCheckoutResponse) => void;
  prefill?: { name?: string; email?: string; contact?: string };
  notes?: Record<string, string>;
  theme?: {
    color?: string;
    /** Colour of the area around the modal. Left to Razorpay's default, this
     *  has rendered as flat white over the site. */
    backdrop_color?: string;
    hide_topbar?: boolean;
  };
  modal?: {
    confirm_close?: boolean;
    escape?: boolean;
    backdropclose?: boolean;
    animation?: boolean;
    ondismiss?: () => void;
  };
  retry?: { enabled?: boolean; max_count?: number };
  timeout?: number; // seconds
};

export interface RazorpayInstance {
  open(): void;
  close(): void;
  on(event: "payment.failed", handler: (response: RazorpayCheckoutFailure) => void): void;
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => RazorpayInstance;
  }
}
