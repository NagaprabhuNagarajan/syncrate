import type { AiImageMediaType } from "@/features/ai/types/ai.types";

/**
 * Upload constraints for AI OCR. Validation runs server-side in the action
 * BEFORE any provider call (Security Rules: never trust client input).
 */

/** Maximum accepted upload size (~10MB) — provider + cost guardrail. */
export const OCR_MAX_FILE_BYTES = 10 * 1024 * 1024;

/** Browser MIME types that map to a supported vision image media type. */
export const OCR_IMAGE_MIME_TYPES: Readonly<Record<string, AiImageMediaType>> = {
  "image/jpeg": "image/jpeg",
  "image/jpg": "image/jpeg",
  "image/png": "image/png",
  "image/gif": "image/gif",
  "image/webp": "image/webp",
};

/** The single supported document MIME type (PDF). */
export const OCR_PDF_MIME_TYPE = "application/pdf";

/** Accept attribute for the file input. */
export const OCR_ACCEPT_ATTR =
  "image/jpeg,image/png,image/gif,image/webp,application/pdf";

/** All accepted MIME types, for client-side pre-checks and messaging. */
export const OCR_ACCEPTED_MIME_TYPES: readonly string[] = [
  ...Object.keys(OCR_IMAGE_MIME_TYPES),
  OCR_PDF_MIME_TYPE,
];
