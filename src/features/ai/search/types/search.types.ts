/**
 * Domain types for AI Smart Search (spec §10).
 *
 * A search resolves a natural-language query into a structured intent, executes
 * it against the real repositories, and returns results grouped by entity. The
 * display shapes here are intentionally generic so any entity renders uniformly.
 */

import type {
  SearchEntity,
  SearchIntent,
} from "@/features/ai/search/schemas/searchIntentSchema";

/** A single result row, normalised for uniform rendering across entities. */
export interface SearchResultItem {
  readonly id: string;
  /** Primary label, e.g. invoice number, customer/product name. */
  readonly title: string;
  /** Secondary detail, e.g. customer name, SKU, warehouse. */
  readonly subtitle: string | null;
  /** A short status/qualifier shown as a badge, e.g. "unpaid", "active". */
  readonly meta: string | null;
  /** A monetary figure when meaningful, else null. */
  readonly amount: number | null;
}

/** Results for one entity type. */
export interface SearchResultGroup {
  readonly entity: SearchEntity;
  /** Human label, e.g. "Invoices". */
  readonly label: string;
  /** Number of results in this group. */
  readonly total: number;
  readonly items: readonly SearchResultItem[];
}

/** The full result of a Smart Search run. */
export interface SmartSearchResult {
  /** The original natural-language query. */
  readonly query: string;
  /** The parsed intent — surfaced to the user as "Interpreted as …". */
  readonly intent: SearchIntent;
  readonly groups: readonly SearchResultGroup[];
}

export type { SearchEntity, SearchIntent };
