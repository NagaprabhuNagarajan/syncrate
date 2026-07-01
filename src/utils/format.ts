/**
 * Shared display formatters used across features.
 */

const currency0 = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const currency2 = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

/** Formats a rupee amount. Whole rupees by default; pass `precise` for paise. */
export function formatCurrency(value: number, precise = false): string {
  return (precise ? currency2 : currency0).format(value);
}

/** Formats a Date as a short, locale-aware day (e.g. "5 Jul 2026"). */
export function formatDate(value: Date): string {
  return new Date(value).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Two-letter monogram for an avatar. Uses the initials of the first two
 * words, falling back to the first two characters of a single word.
 */
export function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return "?";
  }
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}
