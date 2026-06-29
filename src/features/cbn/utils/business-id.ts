/**
 * Utilities for Syncrate business IDs.
 * Format: SYN-{2 uppercase letters}-{6 digits} e.g. SYN-MH-123456
 */

export function formatBusinessId(id: string | null): string {
  return id ?? "—";
}

export function isValidBusinessId(id: string): boolean {
  return /^SYN-[A-Z]{2}-\d{6}$/.test(id);
}
