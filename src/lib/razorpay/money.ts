// Razorpay works exclusively in the smallest currency subunit (paise for INR).
// Our own `Booking.amount` and `MentorProfile.rate` are whole rupees, so every
// crossing of that boundary goes through here rather than an inline `* 100`.

/** Razorpay rejects orders below ₹1 and above ₹5,00,000. */
export const MIN_ORDER_PAISE = 100;
export const MAX_ORDER_PAISE = 50_000_000;

export function toPaise(rupees: number): number {
  if (!Number.isInteger(rupees)) {
    throw new Error(`Expected a whole-rupee amount, got ${rupees}`);
  }
  return rupees * 100;
}

export function toRupees(paise: number): number {
  return paise / 100;
}

/** "₹1,499" for whole rupees, "₹1,499.50" when there are stray paise. */
export function formatInr(paise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: paise % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(toRupees(paise));
}

/** Throws a user-facing message if Razorpay would reject this order amount. */
export function assertPayableAmount(paise: number): void {
  if (paise < MIN_ORDER_PAISE) {
    throw new Error("This session costs less than the ₹1 minimum for online payment.");
  }
  if (paise > MAX_ORDER_PAISE) {
    throw new Error("This session costs more than the ₹5,00,000 limit for a single payment.");
  }
}
