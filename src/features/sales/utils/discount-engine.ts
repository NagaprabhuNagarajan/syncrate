/**
 * Discount Engine — pure utility, no side effects.
 *
 * Approval thresholds:
 *   > 40% discount → owner approval required
 *   > 20% discount → manager approval required
 *   ≤ 20% discount → no approval required
 */

/** Rounds to 2 decimal places, avoiding binary float drift. */
function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export type DiscountType = "percentage" | "fixed";
export type DiscountApprovalLevel = "none" | "manager" | "owner";

export interface DiscountInput {
  type: DiscountType;
  /** Percent (0–100) when type = "percentage"; absolute amount when type = "fixed". */
  value: number;
  /** Pre-discount line amount (qty × unitPrice). */
  lineAmount: number;
}

export interface DiscountResult {
  discountAmount: number;
  discountPercent: number;
  approvalRequired: DiscountApprovalLevel;
}

function resolveApproval(discountPercent: number): DiscountApprovalLevel {
  if (discountPercent > 40) {
    return "owner";
  }
  if (discountPercent > 20) {
    return "manager";
  }
  return "none";
}

export function computeDiscount(input: DiscountInput): DiscountResult {
  const { type, value, lineAmount } = input;

  let discountAmount: number;
  let discountPercent: number;

  if (type === "percentage") {
    // Clamp to [0, 100]
    const clampedPercent = Math.min(100, Math.max(0, value));
    discountAmount = round2(lineAmount * (clampedPercent / 100));
    discountPercent = round2(clampedPercent);
  } else {
    // Fixed amount — cannot exceed the line amount
    const clampedAmount = Math.min(lineAmount, Math.max(0, value));
    discountAmount = round2(clampedAmount);
    discountPercent =
      lineAmount > 0 ? round2((discountAmount / lineAmount) * 100) : 0;
  }

  return {
    discountAmount,
    discountPercent,
    approvalRequired: resolveApproval(discountPercent),
  };
}
