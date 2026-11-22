import { sessionPricing } from "@/config/site";

/**
 * The platform's cut of a session priced at `price` rupees.
 *
 * - Below ₹200 there is no cut: the mentor keeps every rupee.
 * - From ₹200 the cut is whatever sits above ₹199, capped at ₹100.
 *
 * So a mentor at ₹200–299 takes home ₹199 and one at ₹350 takes home ₹250.
 * The taper is deliberate: with a flat ₹100 cut starting at ₹200, a mentor at
 * ₹250 would earn less than one at ₹199, and nobody would ever pick a price in
 * between. With this rule raising your price never lowers what you take home.
 */
export function platformCut(price: number): number {
  const { freeBelow, maxCut } = sessionPricing;
  if (price < freeBelow) return 0;
  return Math.min(maxCut, price - (freeBelow - 1));
}

/** What the mentor is paid for one session at `price`. */
export function mentorShare(price: number): number {
  return price - platformCut(price);
}

export function isValidPrice(price: number): boolean {
  return (
    Number.isInteger(price) && price >= sessionPricing.minPrice && price <= sessionPricing.maxPrice
  );
}
