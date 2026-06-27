import { describe, it, expect } from "vitest";
import { resolvePrice, validatePrice } from "./pricing-engine";
import type { ProductPriceContext } from "./pricing-engine";

function baseContext(overrides: Partial<ProductPriceContext> = {}): ProductPriceContext {
  return {
    retailPrice: 1000,
    wholesalePrice: 900,
    dealerPrice: 800,
    minSellingPrice: 700,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────
// resolvePrice — priority order
// ─────────────────────────────────────────────────────────────

describe("resolvePrice — priority order", () => {
  it("picks customer_specific price when available (highest priority)", () => {
    const result = resolvePrice(
      baseContext({
        customerSpecificPrice: 750,
        promotionalPrice: 760,
      })
    );
    expect(result.tier).toBe("customer_specific");
    expect(result.price).toBe(750);
  });

  it("picks promotional price when no customer_specific price", () => {
    const result = resolvePrice(
      baseContext({ promotionalPrice: 760 })
    );
    expect(result.tier).toBe("promotional");
    expect(result.price).toBe(760);
  });

  it("picks dealer price when no promotional or customer_specific price", () => {
    const result = resolvePrice(baseContext());
    expect(result.tier).toBe("dealer");
    expect(result.price).toBe(800);
  });

  it("falls through to wholesale when dealer price is 0", () => {
    const result = resolvePrice(baseContext({ dealerPrice: 0 }));
    expect(result.tier).toBe("wholesale");
    expect(result.price).toBe(900);
  });

  it("falls through to retail when wholesale and dealer prices are 0", () => {
    const result = resolvePrice(
      baseContext({ dealerPrice: 0, wholesalePrice: 0 })
    );
    expect(result.tier).toBe("retail");
    expect(result.price).toBe(1000);
  });

  it("skips customer_specific when its value is 0", () => {
    const result = resolvePrice(
      baseContext({ customerSpecificPrice: 0, promotionalPrice: 850 })
    );
    expect(result.tier).toBe("promotional");
  });

  it("skips promotional when its value is 0", () => {
    const result = resolvePrice(
      baseContext({ customerSpecificPrice: 0, promotionalPrice: 0 })
    );
    expect(result.tier).toBe("dealer");
  });
});

// ─────────────────────────────────────────────────────────────
// resolvePrice — belowMinimum flag
// ─────────────────────────────────────────────────────────────

describe("resolvePrice — belowMinimum flag", () => {
  it("belowMinimum is false when price equals minSellingPrice", () => {
    const result = resolvePrice(
      baseContext({ customerSpecificPrice: 700, minSellingPrice: 700 })
    );
    expect(result.belowMinimum).toBe(false);
  });

  it("belowMinimum is true when price is below minSellingPrice", () => {
    const result = resolvePrice(
      baseContext({ customerSpecificPrice: 650, minSellingPrice: 700 })
    );
    expect(result.belowMinimum).toBe(true);
  });

  it("belowMinimum is false when retail price is above minimum", () => {
    const result = resolvePrice(
      baseContext({
        retailPrice: 1000,
        dealerPrice: 0,
        wholesalePrice: 0,
        minSellingPrice: 900,
      })
    );
    expect(result.belowMinimum).toBe(false);
  });

  it("belowMinimum is true when dealer price is below minimum", () => {
    const result = resolvePrice(
      baseContext({ dealerPrice: 600, minSellingPrice: 700 })
    );
    expect(result.belowMinimum).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
// validatePrice
// ─────────────────────────────────────────────────────────────

describe("validatePrice", () => {
  it("valid=true and belowMinimum=false for price above minimum", () => {
    const result = validatePrice(1000, 700);
    expect(result.valid).toBe(true);
    expect(result.belowMinimum).toBe(false);
  });

  it("valid=true and belowMinimum=true for price below minimum", () => {
    const result = validatePrice(500, 700);
    expect(result.valid).toBe(true);
    expect(result.belowMinimum).toBe(true);
  });

  it("valid=true for price of 0", () => {
    const result = validatePrice(0, 0);
    expect(result.valid).toBe(true);
    expect(result.belowMinimum).toBe(false);
  });

  it("valid=false for negative price", () => {
    const result = validatePrice(-10, 0);
    expect(result.valid).toBe(false);
  });

  it("belowMinimum=false when price equals minimum", () => {
    const result = validatePrice(700, 700);
    expect(result.belowMinimum).toBe(false);
  });
});
