import type { AppSupabaseClient } from "@/lib/supabase/types";
import { AuditService } from "@/features/audit/services/audit.service";
import { SharedDocumentRepository } from "@/features/cbn/repositories/shared-document.repository";
import type {
  CbnActionResult,
  CbnErrorCode,
  CbnSharedDocument,
  ShareDocumentInput,
  SharedDocumentListParams,
} from "@/features/cbn/types/cbn.types";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function ok<T>(data: T): CbnActionResult<T> {
  return { success: true, data };
}

function fail(code: CbnErrorCode, message: string): CbnActionResult<never> {
  return { success: false, error: { code, message } };
}

// ─────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────

export class SharedDocumentService {
  private readonly repo: SharedDocumentRepository;
  private readonly audit: AuditService;

  constructor(supabase: AppSupabaseClient) {
    this.repo = new SharedDocumentRepository(supabase);
    this.audit = new AuditService(supabase);
  }

  async shareDocument(
    input: ShareDocumentInput
  ): Promise<CbnActionResult<CbnSharedDocument>> {
    const doc = await this.repo.create(input);
    if (!doc) {return fail("unknown", "Failed to share document. Please try again.");}

    await this.audit.log({
      organizationId: input.organizationId,
      actorUserId: null,
      action: "cbn.document.share",
      entityType: "cbn_shared_document",
      entityId: doc.id,
      summary: `Shared ${input.documentType} with org ${input.counterpartyOrganizationId}`,
    });

    return ok(doc);
  }

  async revokeDocument(
    documentId: string,
    organizationId: string
  ): Promise<CbnActionResult<void>> {
    const success = await this.repo.revoke(documentId);
    if (!success) {
      return fail("unknown", "Failed to revoke document. Please try again.");
    }

    await this.audit.log({
      organizationId,
      actorUserId: null,
      action: "cbn.document.revoke",
      entityType: "cbn_shared_document",
      entityId: documentId,
      summary: `Revoked shared document ${documentId}`,
    });

    return ok(undefined);
  }

  async listForConnection(
    connectionId: string,
    params?: SharedDocumentListParams
  ): Promise<CbnSharedDocument[]> {
    return this.repo.findByConnection(connectionId, params);
  }
}
