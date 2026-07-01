import { describe, it, expect } from "vitest";
import { formatCurrency, formatDate, getInitials } from "./format";

describe("formatCurrency", () => {
  it("formats whole rupees by default", () => {
    const result = formatCurrency(1000);
    expect(result).toContain("1,000");
    expect(result).not.toContain(".");
  });

  it("formats paise when precise", () => {
    expect(formatCurrency(1000.5, true)).toContain("1,000.50");
  });

  it("rounds to whole rupees in the default mode", () => {
    expect(formatCurrency(1000.5)).toContain("1,001");
  });
});

describe("formatDate", () => {
  it("renders a short, day-month-year label", () => {
    const result = formatDate(new Date(2026, 6, 5));
    expect(result).toContain("2026");
    expect(result).toContain("Jul");
    expect(result).toContain("5");
  });
});

describe("getInitials", () => {
  it("uses the first and last word initials", () => {
    expect(getInitials("Kumar Traders")).toBe("KT");
    expect(getInitials("a b c")).toBe("AC");
  });

  it("uses the first two characters of a single word", () => {
    expect(getInitials("Kumar")).toBe("KU");
    expect(getInitials("x")).toBe("X");
  });

  it("returns a placeholder for an empty name", () => {
    expect(getInitials("   ")).toBe("?");
  });
});
