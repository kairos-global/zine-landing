/**
 * Shared shipping cost logic used by:
 *   - distributors/orders route (estimate shown at order placement)
 *   - webhooks/stripe route (final charge after creator pays)
 *   - distributor portal UI (cart estimate)
 *
 * NOTE: These are estimated tiers. PirateShip integration will replace
 * calculateShippingCost() with live rates once that is wired up.
 */

/** Flat service fee added to every distributor order (covers Stripe processing). */
export const DISTRIBUTOR_SERVICE_FEE = 0.5;

/**
 * Tiered shipping rate based on total approved copies.
 * Only counts print_for_me copies — self-distribute items are shipped by the creator.
 */
export function calculateShippingCost(totalQuantity: number): number {
  if (totalQuantity <= 10) return 5.0;
  if (totalQuantity <= 25) return 8.0;
  if (totalQuantity <= 50) return 12.0;
  if (totalQuantity <= 100) return 18.0;
  if (totalQuantity <= 200) return 25.0;
  if (totalQuantity <= 500) return 40.0;
  return 60.0;
}

/** shipping + service fee combined */
export function calculateTotalCharge(totalQuantity: number): number {
  return calculateShippingCost(totalQuantity) + DISTRIBUTOR_SERVICE_FEE;
}
