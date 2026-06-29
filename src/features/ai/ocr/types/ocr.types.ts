import type { AiImageMediaType, AiUsage } from "@/features/ai/types/ai.types";
import type { OcrExtraction } from "@/features/ai/ocr/schemas/ocrExtractionSchema";

/**
 * Domain types for the AI OCR capability (spec §7).
 *
 * The OCR flow is upload → extract → human verification. Nothing is persisted
 * automatically; the action/service only return the extracted, schema-validated
 * data for review.
 */

// ─────────────────────────────────────────────────────────────
// Result envelope (mirrors the action-result / AiResult pattern)
// ─────────────────────────────────────────────────────────────

export interface OcrError {
  readonly code: string;
  readonly message: string;
}

export type OcrResult<T> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: OcrError };

// ─────────────────────────────────────────────────────────────
// File input — normalized for the gateway (image vs. PDF)
// ─────────────────────────────────────────────────────────────

export interface OcrImageFile {
  readonly kind: "image";
  readonly mediaType: AiImageMediaType;
  /** base64-encoded image data, no `data:` prefix. */
  readonly base64: string;
}

export interface OcrPdfFile {
  readonly kind: "pdf";
  /** base64-encoded PDF data, no `data:` prefix. */
  readonly base64: string;
}

export type OcrFileInput = OcrImageFile | OcrPdfFile;

// ─────────────────────────────────────────────────────────────
// Extraction response surfaced to the verification UI
// ─────────────────────────────────────────────────────────────

export interface OcrExtractionResponse {
  readonly extraction: OcrExtraction;
  readonly model: string;
  readonly usage: AiUsage;
}
