/**
 * AI Business Assistant types (spec §6).
 *
 * The assistant answers business questions and can search the org's
 * customers / suppliers / products / inventory via read-only tools. It NEVER
 * mutates data — instead it *proposes* an invoice or quotation that the user
 * must explicitly approve. These types are the contract between the assistant
 * service, the server actions, and the chat UI.
 */

import type { AiProposedAction } from "@/features/ai/services/ai-gateway.service";
import type { AiResult } from "@/features/ai/types/ai.types";

export type AssistantRole = "user" | "assistant";

/** A single chat turn — displayed in the UI and replayed to the model. */
export interface AssistantMessage {
  readonly role: AssistantRole;
  readonly content: string;
}

/** The propose-tools whose invocation halts the loop for human approval. */
export type AssistantProposeTool = "propose_invoice" | "propose_quotation";

/** Compact result of one assistant turn surfaced to the UI. */
export interface AssistantTurn {
  /** The assistant's natural-language reply for this turn. */
  readonly text: string;
  /** Read-only tools the assistant invoked this turn (for transparency). */
  readonly toolCalls: ReadonlyArray<{ readonly name: string; readonly input: unknown }>;
  /** Set when the assistant proposed a mutating action awaiting approval. */
  readonly proposedAction: AiProposedAction | null;
}

/** Kind of document created once a proposed action is approved. */
export type ApprovedActionKind = "invoice" | "quotation";

export interface ApprovedAction {
  readonly kind: ApprovedActionKind;
  readonly id: string;
}

/** Assistant results mirror the shared AI result envelope. */
export type AssistantResult<T> = AiResult<T>;
