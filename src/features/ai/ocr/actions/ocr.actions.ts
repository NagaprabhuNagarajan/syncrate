"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { OcrService } from "@/features/ai/ocr/services/ocr.service";
import {
  OCR_IMAGE_MIME_TYPES,
  OCR_MAX_FILE_BYTES,
  OCR_PDF_MIME_TYPE,
} from "@/features/ai/ocr/constants/ocr.constants";
import type {
  OcrExtractionResponse,
  OcrFileInput,
  OcrResult,
} from "@/features/ai/ocr/types/ocr.types";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function forbidden(message: string): OcrResult<never> {
  return { success: false, error: { code: "forbidden", message } };
}

function invalid(message: string): OcrResult<never> {
  return { success: false, error: { code: "validation", message } };
}

/**
 * Resolves the caller, verifies org membership, and checks a permission.
 * Returns the authenticated userId on success.
 */
async function authorize(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  organizationId: string,
  permission: string
): Promise<
  { ok: true; userId: string } | { ok: false; result: OcrResult<never> }
> {
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) {
    return { ok: false, result: forbidden("Not authenticated") };
  }

  const orgService = new OrganizationService(supabase);
  const context = await orgService.getOrganizationContext(
    organizationId,
    authData.user.id
  );
  if (!context) {
    return {
      ok: false,
      result: forbidden("You do not have access to this organization"),
    };
  }
  if (!context.permissions.includes(permission)) {
    return {
      ok: false,
      result: forbidden("You do not have permission to perform this action"),
    };
  }

  return { ok: true, userId: authData.user.id };
}

/** Normalizes an uploaded file to a gateway-ready image or PDF input. */
function toFileInput(file: File, base64: string): OcrFileInput | null {
  if (file.type === OCR_PDF_MIME_TYPE) {
    return { kind: "pdf", base64 };
  }
  const mediaType = OCR_IMAGE_MIME_TYPES[file.type];
  if (mediaType) {
    return { kind: "image", mediaType, base64 };
  }
  return null;
}

// ─────────────────────────────────────────────────────────────
// Extract
// ─────────────────────────────────────────────────────────────

/**
 * Extracts structured data from an uploaded document for human verification.
 * Validates type and size before contacting the AI provider. Never persists a
 * record — the verified data is saved by the user from the review UI.
 */
export async function extractDocumentAction(
  organizationId: string,
  formData: FormData
): Promise<OcrResult<OcrExtractionResponse>> {
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return invalid("Please select a document to extract.");
  }
  if (file.size > OCR_MAX_FILE_BYTES) {
    return invalid("File is too large. Maximum size is 10MB.");
  }

  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, "ai.generate");
  if (!auth.ok) {
    return auth.result;
  }

  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  const input = toFileInput(file, base64);
  if (!input) {
    return invalid(
      "Unsupported file type. Upload a JPEG, PNG, GIF, WebP or PDF."
    );
  }

  const service = new OcrService(supabase);
  return service.extract({
    context: { organizationId, userId: auth.userId },
    file: input,
  });
}
