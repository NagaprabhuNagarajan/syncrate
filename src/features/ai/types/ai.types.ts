/**
 * Shared types for the Syncrate AI Platform.
 *
 * The AI Platform is a provider-independent intelligence layer consumed by
 * every business domain (spec §1). These types are the contract between the
 * AI Gateway and the capability services (OCR, assistant, forecasting, etc.).
 */

// ─────────────────────────────────────────────────────────────
// Result envelope (mirrors the domain action-result pattern)
// ─────────────────────────────────────────────────────────────

export type AiErrorCode =
  | "not_configured" // No ANTHROPIC_API_KEY set
  | "forbidden" // RBAC / tenant check failed
  | "validation" // Bad input
  | "refused" // Model declined (safety)
  | "rate_limited" // Provider 429
  | "provider_error" // Provider 5xx / network
  | "parse_error" // Structured output failed to parse
  | "unknown";

export interface AiError {
  readonly code: AiErrorCode;
  readonly message: string;
}

export type AiResult<T> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: AiError };

// ─────────────────────────────────────────────────────────────
// Capabilities & governance
// ─────────────────────────────────────────────────────────────

export type AiCapability =
  | "assistant"
  | "ocr"
  | "forecast"
  | "recommendation"
  | "insight"
  | "search"
  | "report";

export type AiApprovalStatus =
  | "not_required"
  | "pending"
  | "approved"
  | "rejected";

export type AiInteractionStatus = "success" | "failed" | "refused";

// ─────────────────────────────────────────────────────────────
// Tenant context — every AI request carries who/where (spec §14)
// ─────────────────────────────────────────────────────────────

export interface AiContext {
  readonly organizationId: string;
  readonly userId: string | null;
  /** Optional structured business context surfaced to the model. */
  readonly branchId?: string | null;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

// ─────────────────────────────────────────────────────────────
// Token usage / interaction record
// ─────────────────────────────────────────────────────────────

export interface AiUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly executionMs: number;
}

export interface RecordInteractionInput {
  readonly organizationId: string;
  readonly actorUserId: string | null;
  readonly capability: AiCapability;
  readonly model: string;
  readonly promptSummary?: string | null;
  readonly responseSummary?: string | null;
  readonly confidence?: number | null;
  readonly usage: AiUsage;
  readonly approvalStatus?: AiApprovalStatus;
  readonly status?: AiInteractionStatus;
  readonly errorMessage?: string | null;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface AiInteraction {
  readonly id: string;
  readonly organizationId: string;
  readonly actorUserId: string | null;
  readonly capability: AiCapability;
  readonly model: string;
  readonly promptSummary: string | null;
  readonly responseSummary: string | null;
  readonly confidence: number | null;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly executionMs: number;
  readonly approvalStatus: AiApprovalStatus;
  readonly status: AiInteractionStatus;
  readonly errorMessage: string | null;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: string;
}

export interface AiInteractionListParams {
  readonly capability?: AiCapability;
  readonly limit?: number;
  readonly offset?: number;
}

// ─────────────────────────────────────────────────────────────
// Gateway call options
// ─────────────────────────────────────────────────────────────

/** A supported image media type for vision/OCR. */
export type AiImageMediaType =
  | "image/jpeg"
  | "image/png"
  | "image/gif"
  | "image/webp";

export interface AiDocumentInput {
  /** PDF only — base64-encoded, no data: prefix, no newlines. */
  readonly pdfBase64: string;
}

export interface AiImageInput {
  readonly mediaType: AiImageMediaType;
  /** base64-encoded image data, no data: prefix. */
  readonly base64: string;
}
