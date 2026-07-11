"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { AssistantService } from "@/features/ai/assistant/services/assistant.service";
import {
  chatHistorySchema,
  proposedDocumentSchema,
} from "@/features/ai/assistant/schemas/assistant.schemas";
import type { ProposedDocument } from "@/features/ai/assistant/schemas/assistant.schemas";
import { createInvoiceAction } from "@/features/sales/actions/invoice.actions";
import type { AiProposedAction } from "@/features/ai/services/ai-gateway.service";
import type { AiError, AiErrorCode, AiResult } from "@/features/ai/types/ai.types";
import type {
  AssistantMessage,
  AssistantTurn,
  ApprovedAction,
} from "@/features/ai/assistant/types/assistant.types";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function forbidden(message: string): AiResult<never> {
  return { success: false, error: { code: "forbidden", message } };
}

function invalid(message: string): AiResult<never> {
  return { success: false, error: { code: "validation", message } };
}

/**
 * Maps a sales-domain error (whose code union differs from the AI error union)
 * onto an {@link AiError}, preserving the user-facing message.
 */
function toAiError(error: { code: string; message: string }): AiError {
  const KNOWN: ReadonlyArray<AiErrorCode> = ["forbidden", "validation"];
  const code = KNOWN.includes(error.code as AiErrorCode)
    ? (error.code as AiErrorCode)
    : "unknown";
  return { code, message: error.message };
}

/**
 * Resolves the caller, verifies org membership, and checks a permission.
 * Mirrors `authorize()` in customer.actions.ts. Returns the userId on success.
 */
async function authorize(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  organizationId: string,
  permission: string
): Promise<
  { ok: true; userId: string } | { ok: false; result: AiResult<never> }
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

/** Builds the FormData a sales-document create action expects from a proposal. */
function buildDocumentFormData(doc: ProposedDocument): FormData {
  const formData = new FormData();
  formData.set("customerId", doc.customerId);
  if (doc.notes) {
    formData.set("notes", doc.notes);
  }
  const items = doc.items.map((item) => ({
    productId: item.productId,
    description: item.description ?? "",
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    ...(item.gstRate !== undefined ? { gstRate: item.gstRate } : {}),
  }));
  formData.set("items", JSON.stringify(items));
  return formData;
}

// ─────────────────────────────────────────────────────────────
// Chat — read-only, proposes but never mutates
// ─────────────────────────────────────────────────────────────

export async function sendAssistantMessageAction(
  organizationId: string,
  messages: ReadonlyArray<AssistantMessage>
): Promise<AiResult<AssistantTurn>> {
  const parsed = chatHistorySchema.safeParse(messages);
  if (!parsed.success) {
    return invalid(parsed.error.errors[0]?.message ?? "Invalid message history");
  }

  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, "ai.generate");
  if (!auth.ok) {
    return auth.result;
  }

  const service = new AssistantService(supabase);
  return service.chat({
    organizationId,
    userId: auth.userId,
    messages: parsed.data,
  });
}

// ─────────────────────────────────────────────────────────────
// Approve — turns a proposed action into a real document
// ─────────────────────────────────────────────────────────────

/**
 * Executes a previously proposed action AFTER explicit user approval. The
 * proposal is re-validated server-side and delegated to the real sales create
 * action, which enforces its own permission (`invoice.create`) and writes the
 * audit log. The AI never reaches here on its own — only a deliberate user
 * click does.
 */
export async function approveProposedActionAction(
  organizationId: string,
  action: AiProposedAction
): Promise<AiResult<ApprovedAction>> {
  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, "ai.generate");
  if (!auth.ok) {
    return auth.result;
  }

  if (action.tool !== "propose_invoice") {
    return invalid(`Unsupported proposed action "${action.tool}"`);
  }

  const parsed = proposedDocumentSchema.safeParse(action.input);
  if (!parsed.success) {
    return invalid(
      parsed.error.errors[0]?.message ?? "The proposed document is incomplete"
    );
  }

  const formData = buildDocumentFormData(parsed.data);

  const result = await createInvoiceAction(organizationId, formData);
  if (!result.success) {
    return { success: false, error: toAiError(result.error) };
  }
  return { success: true, data: { kind: "invoice", id: result.data.id } };
}
