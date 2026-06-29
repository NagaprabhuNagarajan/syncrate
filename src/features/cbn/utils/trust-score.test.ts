import { describe, expect, it } from "vitest";
import {
  calculateTrustScore,
  getTrustScoreColor,
  getTrustScoreLabel,
} from "./trust-score";
import { formatBusinessId, isValidBusinessId } from "./business-id";

// ─────────────────────────────────────────────────────────────
// calculateTrustScore
// ─────────────────────────────────────────────────────────────

describe("calculateTrustScore", () => {
  it("returns 100 when all components are 100", () => {
    expect(
      calculateTrustScore({
        paymentRating: 100,
        deliveryRating: 100,
        disputeScore: 100,
        customerRating: 100,
      })
    ).toBe(100);
  });

  it("returns 15 when only disputeScore is 100", () => {
    // 0*0.4 + 0*0.3 + 100*0.15 + 0*0.15 = 15
    expect(
      calculateTrustScore({
        paymentRating: 0,
        deliveryRating: 0,
        disputeScore: 100,
        customerRating: 0,
      })
    ).toBe(15);
  });

  it("returns 50 when all components are 50", () => {
    // 50*0.4 + 50*0.3 + 50*0.15 + 50*0.15 = 50
    expect(
      calculateTrustScore({
        paymentRating: 50,
        deliveryRating: 50,
        disputeScore: 50,
        customerRating: 50,
      })
    ).toBe(50);
  });

  it("returns 0 when all components are 0", () => {
    expect(
      calculateTrustScore({
        paymentRating: 0,
        deliveryRating: 0,
        disputeScore: 0,
        customerRating: 0,
      })
    ).toBe(0);
  });

  it("weights payment 40%, delivery 30%, dispute 15%, customer 15%", () => {
    // 80*0.4 + 60*0.3 + 40*0.15 + 20*0.15 = 32 + 18 + 6 + 3 = 59
    expect(
      calculateTrustScore({
        paymentRating: 80,
        deliveryRating: 60,
        disputeScore: 40,
        customerRating: 20,
      })
    ).toBe(59);
  });

  it("clamps values above 100 to 100", () => {
    expect(
      calculateTrustScore({
        paymentRating: 200,
        deliveryRating: 200,
        disputeScore: 200,
        customerRating: 200,
      })
    ).toBe(100);
  });

  it("clamps values below 0 to 0", () => {
    expect(
      calculateTrustScore({
        paymentRating: -50,
        deliveryRating: -50,
        disputeScore: -50,
        customerRating: -50,
      })
    ).toBe(0);
  });

  it("rounds to 2 decimal places", () => {
    // 33*0.4 + 33*0.3 + 33*0.15 + 33*0.15 = 13.2+9.9+4.95+4.95 = 33
    const score = calculateTrustScore({
      paymentRating: 33,
      deliveryRating: 33,
      disputeScore: 33,
      customerRating: 33,
    });
    expect(Number.isFinite(score)).toBe(true);
    expect(score).toBe(33);
  });
});

// ─────────────────────────────────────────────────────────────
// getTrustScoreLabel
// ─────────────────────────────────────────────────────────────

describe("getTrustScoreLabel", () => {
  it("returns 'Excellent' for score >= 90", () => {
    expect(getTrustScoreLabel(90)).toBe("Excellent");
    expect(getTrustScoreLabel(100)).toBe("Excellent");
    expect(getTrustScoreLabel(95.5)).toBe("Excellent");
  });

  it("returns 'Good' for score >= 75 and < 90", () => {
    expect(getTrustScoreLabel(75)).toBe("Good");
    expect(getTrustScoreLabel(89)).toBe("Good");
    expect(getTrustScoreLabel(80)).toBe("Good");
  });

  it("returns 'Fair' for score >= 60 and < 75", () => {
    expect(getTrustScoreLabel(60)).toBe("Fair");
    expect(getTrustScoreLabel(74)).toBe("Fair");
  });

  it("returns 'Poor' for score >= 40 and < 60", () => {
    expect(getTrustScoreLabel(40)).toBe("Poor");
    expect(getTrustScoreLabel(59)).toBe("Poor");
  });

  it("returns 'Very Poor' for score < 40", () => {
    expect(getTrustScoreLabel(39)).toBe("Very Poor");
    expect(getTrustScoreLabel(0)).toBe("Very Poor");
  });
});

// ─────────────────────────────────────────────────────────────
// getTrustScoreColor
// ─────────────────────────────────────────────────────────────

describe("getTrustScoreColor", () => {
  it("returns green for score >= 90", () => {
    expect(getTrustScoreColor(90)).toBe("text-green-600");
    expect(getTrustScoreColor(100)).toBe("text-green-600");
  });

  it("returns blue for score >= 75 and < 90", () => {
    expect(getTrustScoreColor(75)).toBe("text-blue-600");
    expect(getTrustScoreColor(89)).toBe("text-blue-600");
  });

  it("returns yellow for score >= 60 and < 75", () => {
    expect(getTrustScoreColor(60)).toBe("text-yellow-600");
    expect(getTrustScoreColor(74)).toBe("text-yellow-600");
  });

  it("returns orange for score >= 40 and < 60", () => {
    expect(getTrustScoreColor(40)).toBe("text-orange-600");
    expect(getTrustScoreColor(59)).toBe("text-orange-600");
  });

  it("returns red for score < 40", () => {
    expect(getTrustScoreColor(39)).toBe("text-red-600");
    expect(getTrustScoreColor(0)).toBe("text-red-600");
  });
});

// ─────────────────────────────────────────────────────────────
// isValidBusinessId
// ─────────────────────────────────────────────────────────────

describe("isValidBusinessId", () => {
  it("accepts valid business IDs", () => {
    expect(isValidBusinessId("SYN-MH-123456")).toBe(true);
    expect(isValidBusinessId("SYN-DL-000001")).toBe(true);
    expect(isValidBusinessId("SYN-KA-999999")).toBe(true);
  });

  it("rejects IDs with wrong prefix", () => {
    expect(isValidBusinessId("syn-MH-123456")).toBe(false);
    expect(isValidBusinessId("BSN-MH-123456")).toBe(false);
    expect(isValidBusinessId("SYN_MH_123456")).toBe(false);
  });

  it("rejects IDs with wrong state code length", () => {
    expect(isValidBusinessId("SYN-M-123456")).toBe(false);
    expect(isValidBusinessId("SYN-MAH-123456")).toBe(false);
  });

  it("rejects IDs with wrong digit count", () => {
    expect(isValidBusinessId("SYN-MH-12345")).toBe(false);
    expect(isValidBusinessId("SYN-MH-1234567")).toBe(false);
  });

  it("rejects IDs with lowercase state code", () => {
    expect(isValidBusinessId("SYN-mh-123456")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidBusinessId("")).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// formatBusinessId
// ─────────────────────────────────────────────────────────────

describe("formatBusinessId", () => {
  it("returns the ID when provided", () => {
    expect(formatBusinessId("SYN-MH-123456")).toBe("SYN-MH-123456");
  });

  it("returns em-dash for null", () => {
    expect(formatBusinessId(null)).toBe("—");
  });
});
