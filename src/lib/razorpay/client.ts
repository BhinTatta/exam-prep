import "server-only";

import { razorpayCredentials } from "./config";

// A thin `fetch` wrapper over the handful of Razorpay REST endpoints we use.
// The official `razorpay` npm package wraps the same calls plus two HMAC
// helpers that are a few lines of node:crypto (see ./signature.ts), and
// PROJECT_BRIEF.md asks us to keep vendor surface small and swappable.

const API_BASE = "https://api.razorpay.com/v1";

/** Razorpay's error envelope: { error: { code, description, field, ... } }. */
type RazorpayErrorBody = {
  error?: {
    code?: string;
    description?: string;
    field?: string;
    reason?: string;
  };
};

export class RazorpayApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly field?: string;

  constructor(status: number, body: RazorpayErrorBody) {
    // Razorpay's `description` is written for humans ("Order amount less than
    // minimum amount allowed"), so it is safe to surface through the repo's
    // toast.error(e.message) convention.
    super(body.error?.description ?? `Razorpay request failed (HTTP ${status})`);
    this.name = "RazorpayApiError";
    this.status = status;
    this.code = body.error?.code;
    this.field = body.error?.field;
  }
}

async function request<T>(
  path: string,
  init?: { method?: "GET" | "POST"; body?: unknown }
): Promise<T> {
  const { keyId, keySecret } = razorpayCredentials();
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");

  const res = await fetch(`${API_BASE}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Basic ${auth}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
    // Payment state must never be served from a cache.
    cache: "no-store",
  });

  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    throw new RazorpayApiError(res.status, {
      error: { description: `Razorpay returned a non-JSON response (HTTP ${res.status})` },
    });
  }

  if (!res.ok) throw new RazorpayApiError(res.status, parsed as RazorpayErrorBody);
  return parsed as T;
}

// --- Entity shapes (only the fields we actually read) ----------------------

export type RazorpayOrder = {
  id: string;
  entity: "order";
  amount: number; // paise
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string | null;
  status: "created" | "attempted" | "paid";
  attempts: number;
  notes: Record<string, string>;
  created_at: number;
};

export type RazorpayPayment = {
  id: string;
  entity: "payment";
  amount: number; // paise
  currency: string;
  status: "created" | "authorized" | "captured" | "refunded" | "failed";
  order_id: string | null;
  method?: string;
  amount_refunded: number;
  captured: boolean;
  email?: string | null;
  contact?: string | null;
  error_code?: string | null;
  error_description?: string | null;
  notes?: Record<string, string>;
  created_at: number;
};

export type RazorpayRefund = {
  id: string;
  entity: "refund";
  amount: number; // paise
  payment_id: string;
  status: "pending" | "processed" | "failed";
  speed_processed?: string;
  notes?: Record<string, string>;
  created_at: number;
};

// --- Endpoints -------------------------------------------------------------

export function createOrder(params: {
  amount: number; // paise
  currency?: string;
  receipt: string; // max 40 chars
  notes?: Record<string, string>;
}): Promise<RazorpayOrder> {
  return request<RazorpayOrder>("/orders", {
    method: "POST",
    body: {
      amount: params.amount,
      currency: params.currency ?? "INR",
      receipt: params.receipt,
      notes: params.notes ?? {},
      // Capture immediately. This overrides the Dashboard setting per order, so
      // a payment can never sit `authorized` long enough to be auto-refunded.
      capture: "automatic",
    },
  });
}

export function fetchOrder(orderId: string): Promise<RazorpayOrder> {
  return request<RazorpayOrder>(`/orders/${orderId}`);
}

export function fetchPayment(paymentId: string): Promise<RazorpayPayment> {
  return request<RazorpayPayment>(`/payments/${paymentId}`);
}

/** Every payment attempt made against one order — used to reconcile a missed webhook. */
export async function fetchOrderPayments(orderId: string): Promise<RazorpayPayment[]> {
  const res = await request<{ count: number; items: RazorpayPayment[] }>(
    `/orders/${orderId}/payments`
  );
  return res.items ?? [];
}

export function createRefund(
  paymentId: string,
  params: { amount?: number; notes?: Record<string, string> } // amount in paise; omit for full
): Promise<RazorpayRefund> {
  return request<RazorpayRefund>(`/payments/${paymentId}/refund`, {
    method: "POST",
    body: {
      ...(params.amount ? { amount: params.amount } : {}),
      speed: "normal",
      notes: params.notes ?? {},
    },
  });
}

export function fetchRefund(refundId: string): Promise<RazorpayRefund> {
  return request<RazorpayRefund>(`/refunds/${refundId}`);
}
