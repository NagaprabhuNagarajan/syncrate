/**
 * Pricing Engine — pure utility, no side effects.
 *
 * Priority order (highest to lowest):
 *   customer_specific → promotional → dealer → wholesale → retail
 */

export type PricingTier =
  | "retail"
  | "wholesale"
  | "dealer"
  | "distributor"
  | "customer_specific"
  | "promotional";

export interface ProductPriceContext {
  retailPrice: number;
  wholesalePrice: number;
  dealerPrice: number;
  minSellingPrice: number;
  /** Optional — skip if not applicable. */
  customerSpecificPrice?: number;
  /** Optional — skip if not applicable. */
  promotionalPrice?: number;
}

export interface PricingResult {
  price: number;
  tier: PricingTier;
  /** True when the resolved price is below the minimum selling price. */
  belowMinimum: boolean;
}

/**
 * Resolves the best applicable price for a product given the context.
 *
 * A tier is considered "available" when its price value is defined and > 0.
 * Priority: customer_specific > promotional > dealer > wholesale > retail
 */
export function resolvePrice(context: ProductPriceContext): PricingResult {
  let price: number;
  let tier: PricingTier;

  if (
    context.customerSpecificPrice !== undefined &&
    context.customerSpecificPrice > 0
  ) {
    price = context.customerSpecificPrice;
    tier = "customer_specific";
  } else if (
    context.promotionalPrice !== undefined &&
    context.promotionalPrice > 0
  ) {
    price = context.promotionalPrice;
    tier = "promotional";
  } else if (context.dealerPrice > 0) {
    price = context.dealerPrice;
    tier = "dealer";
  } else if (context.wholesalePrice > 0) {
    price = context.wholesalePrice;
    tier = "wholesale";
  } else {
    price = context.retailPrice;
    tier = "retail";
  }

  return {
    price,
    tier,
    belowMinimum: price < context.minSellingPrice,
  };
}

/**
 * Checks whether a given price is valid (non-negative) and whether it falls
 * below the minimum selling price threshold.
 */
export function validatePrice(
  price: number,
  minSellingPrice: number
): { valid: boolean; belowMinimum: boolean } {
  return {
    valid: price >= 0,
    belowMinimum: price < minSellingPrice,
  };
}
