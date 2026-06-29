/**
 * Validation schemas for the AI Business Assistant.
 *
 * Two concerns:
 *  1. Tool *inputs* the model sends to read-only executors — validated before
 *     touching any repository (never trust model output, spec §17).
 *  2. The *proposed action* the user approves — re-validated server-side before
 *     it is turned into a real invoice/quotation (the AI never mutates data).
 */

import { z } from "zod";

// ── Read-tool inputs ─────────────────────────────────────────

/** Shared input for the search_* / check_inventory read tools. */
export const searchToolInputSchema = z.object({
  query: z.string().trim().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(10).optional(),
});

export type SearchToolInput = z.infer<typeof searchToolInputSchema>;

// ── Proposed-action inputs (require human approval) ──────────

/** One line item on a proposed invoice/quotation. */
export const proposedLineItemSchema = z.object({
  /** Resolved product UUID — the model must search first to obtain this. */
  productId: z.string().min(1, "productId is required"),
  /** Human-readable product name for the review card. */
  productName: z.string().trim().optional(),
  description: z.string().trim().max(500).optional(),
  quantity: z.coerce.number().positive("Quantity must be greater than 0"),
  unitPrice: z.coerce.number().min(0, "Unit price cannot be negative"),
  gstRate: z.coerce.number().optional(),
});

export type ProposedLineItem = z.infer<typeof proposedLineItemSchema>;

/** Shape of a propose_invoice / propose_quotation tool input. */
export const proposedDocumentSchema = z.object({
  /** Resolved customer UUID — the model must search first to obtain this. */
  customerId: z.string().min(1, "customerId is required"),
  customerName: z.string().trim().optional(),
  notes: z.string().trim().max(2000).optional(),
  items: z.array(proposedLineItemSchema).min(1, "Add at least one line item"),
});

export type ProposedDocument = z.infer<typeof proposedDocumentSchema>;

// ── Chat history ─────────────────────────────────────────────

export const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1, "Message cannot be empty").max(8000),
});

export const chatHistorySchema = z
  .array(chatMessageSchema)
  .min(1, "At least one message is required")
  .max(50, "Conversation is too long");
