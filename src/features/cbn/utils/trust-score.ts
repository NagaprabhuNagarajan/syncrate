/**
 * Trust score pure utility functions.
 *
 * Formula from PRD/6.md:
 *   Payment Reliability  40%
 *   Delivery Reliability 30%
 *   Dispute History      15%
 *   Customer Rating      15%
 *
 * All inputs are 0–100. Output is clamped to [0, 100] and rounded to 2 d.p.
 */

export interface TrustScoreComponents {
  readonly paymentRating: number; // 0–100
  readonly deliveryRating: number; // 0–100
  readonly disputeScore: number; // 0–100  (100 = no disputes)
  readonly customerRating: number; // 0–100
}

export function calculateTrustScore(components: TrustScoreComponents): number {
  const score =
    components.paymentRating * 0.4 +
    components.deliveryRating * 0.3 +
    components.disputeScore * 0.15 +
    components.customerRating * 0.15;
  return Math.round(Math.max(0, Math.min(100, score)) * 100) / 100;
}

export function getTrustScoreLabel(score: number): string {
  if (score >= 90) {return "Excellent";}
  if (score >= 75) {return "Good";}
  if (score >= 60) {return "Fair";}
  if (score >= 40) {return "Poor";}
  return "Very Poor";
}

export function getTrustScoreColor(score: number): string {
  if (score >= 90) {return "text-green-600";}
  if (score >= 75) {return "text-blue-600";}
  if (score >= 60) {return "text-yellow-600";}
  if (score >= 40) {return "text-orange-600";}
  return "text-red-600";
}
