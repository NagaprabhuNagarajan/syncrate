// AI structured-output schema for Smart Search (spec §10).
//
// The LLM's ONLY job is to parse a natural-language query into this structured
// "intent". The search service then executes the intent against the real,
// tenant-scoped repositories — the model never touches the database.
//
// IMPORTANT: AI output schemas MUST use Zod v4 — the gateway's
// `zodOutputFormat` helper only accepts v4 schemas.
import { z } from "zod/v4";

/**
 * The business entities Smart Search can target. Each maps to exactly one real
 * repository list method in {@link SmartSearchService} (spec §10).
 */
export const SEARCH_ENTITIES = [
  "invoice",
  "customer",
  "product",
  "inventory",
  "supplier",
  "customer_payment",
  "supplier_payment",
] as const;

export const searchEntitySchema = z.enum(SEARCH_ENTITIES);

/** Payment standing for invoices — applied in-service after fetch. */
export const searchPaymentStatusSchema = z.enum([
  "unpaid",
  "partial",
  "paid",
  "overdue",
]);

export const searchSortSchema = z.object({
  field: z
    .string()
    .nullable()
    .describe(
      "Sort field hint, e.g. 'total_amount', 'name', 'created_at'. Null if unspecified."
    ),
  direction: z
    .enum(["asc", "desc"])
    .nullable()
    .describe("Sort direction, or null if unspecified"),
});

export const searchTimeRangeSchema = z.object({
  from: z
    .string()
    .nullable()
    .describe("Inclusive start date as ISO 'YYYY-MM-DD', or null"),
  to: z
    .string()
    .nullable()
    .describe("Inclusive end date as ISO 'YYYY-MM-DD', or null"),
});

/**
 * Structured filters the model may extract. Every field is nullable — only set
 * what the query clearly implies. The service ignores filters a given entity's
 * repository cannot honour, or applies them post-fetch.
 */
export const searchFiltersSchema = z.object({
  keyword: z
    .string()
    .nullable()
    .describe(
      "Free-text term to match (name/code/number). Null if the query is purely structured."
    ),
  status: z
    .string()
    .nullable()
    .describe(
      "Lifecycle status hint for the entity, e.g. 'active', 'draft', 'posted'. Null if N/A."
    ),
  paymentStatus: searchPaymentStatusSchema
    .nullable()
    .describe("Invoice payment standing, e.g. 'unpaid' or 'overdue'. Null if N/A."),
  lowStock: z
    .boolean()
    .nullable()
    .describe(
      "True when the query asks for items at/below their reorder level (inventory). Null otherwise."
    ),
  overdue: z
    .boolean()
    .nullable()
    .describe(
      "True when the query asks for overdue items (e.g. overdue invoices/payments). Null otherwise."
    ),
});

/**
 * The parsed search intent. The gateway auto-reads the top-level `confidence`
 * for the audit trail (spec §20).
 */
export const searchIntentSchema = z.object({
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("Model confidence that this intent matches the user's query, 0..1"),
  entity: searchEntitySchema.describe(
    "Which business entity the user is asking about"
  ),
  explanation: z
    .string()
    .describe(
      "One short sentence restating the query as understood, e.g. 'Unpaid invoices'. Shown to the user as 'Interpreted as'."
    ),
  filters: searchFiltersSchema.describe("Structured filters extracted from the query"),
  timeRange: searchTimeRangeSchema
    .nullable()
    .describe("Date window the query refers to, or null if none"),
  sort: searchSortSchema.nullable().describe("Requested ordering, or null"),
  limit: z
    .number()
    .int()
    .positive()
    .max(50)
    .nullable()
    .describe("Maximum number of results requested, or null for the default"),
});

export type SearchEntity = z.infer<typeof searchEntitySchema>;
export type SearchPaymentStatus = z.infer<typeof searchPaymentStatusSchema>;
export type SearchFilters = z.infer<typeof searchFiltersSchema>;
export type SearchSort = z.infer<typeof searchSortSchema>;
export type SearchTimeRange = z.infer<typeof searchTimeRangeSchema>;
export type SearchIntent = z.infer<typeof searchIntentSchema>;
