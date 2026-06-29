import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Database } from "@/types/database.types";
import type {
  CbnSharedDocument,
  ShareDocumentInput,
  SharedDocumentListParams,
} from "@/features/cbn/types/cbn.types";

type DbRow = Database["public"]["Tables"]["cbn_shared_documents"]["Row"];
type DbInsert = Database["public"]["Tables"]["cbn_shared_documents"]["Insert"];

// ─────────────────────────────────────────────────────────────
// Mapper
// ─────────────────────────────────────────────────────────────

function mapRow(row: DbRow): CbnSharedDocument {
  return {
    id: row.id,
    organizationId: row.organization_id,
    counterpartyOrganizationId: row.counterparty_organization_id,
    connectionId: row.connection_id,
    documentType: row.document_type,
    documentReferenceType: row.document_reference_type,
    documentReferenceId: row.document_reference_id,
    documentNumber: row.document_number,
    documentDate: row.document_date,
    amount: row.amount !== null ? Number(row.amount) : null,
    currency: row.currency,
    fileUrl: row.file_url,
    fileName: row.file_name,
    status: row.status,
    notes: row.notes,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    createdBy: row.created_by,
  };
}

// ─────────────────────────────────────────────────────────────
// Repository
// ─────────────────────────────────────────────────────────────

export class SharedDocumentRepository {
  constructor(private readonly supabase: AppSupabaseClient) {}

  async findByConnection(
    connectionId: string,
    params?: SharedDocumentListParams
  ): Promise<CbnSharedDocument[]> {
    let query = this.supabase
      .from("cbn_shared_documents")
      .select("*")
      .eq("connection_id", connectionId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (params?.status) {
      query = query.eq("status", params.status);
    }
    if (params?.limit) {
      const limit = params.limit;
      const offset = params.offset ?? 0;
      query = query.range(offset, offset + limit - 1);
    }

    const { data, error } = await query;
    if (error || !data) {return [];}
    return data.map(mapRow);
  }

  async findBySenderOrg(
    orgId: string,
    params?: SharedDocumentListParams
  ): Promise<CbnSharedDocument[]> {
    let query = this.supabase
      .from("cbn_shared_documents")
      .select("*")
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (params?.status) {
      query = query.eq("status", params.status);
    }
    if (params?.limit) {
      const limit = params.limit;
      const offset = params.offset ?? 0;
      query = query.range(offset, offset + limit - 1);
    }

    const { data, error } = await query;
    if (error || !data) {return [];}
    return data.map(mapRow);
  }

  async findByReceiverOrg(
    orgId: string,
    params?: SharedDocumentListParams
  ): Promise<CbnSharedDocument[]> {
    let query = this.supabase
      .from("cbn_shared_documents")
      .select("*")
      .eq("counterparty_organization_id", orgId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (params?.status) {
      query = query.eq("status", params.status);
    }
    if (params?.limit) {
      const limit = params.limit;
      const offset = params.offset ?? 0;
      query = query.range(offset, offset + limit - 1);
    }

    const { data, error } = await query;
    if (error || !data) {return [];}
    return data.map(mapRow);
  }

  async create(input: ShareDocumentInput): Promise<CbnSharedDocument | null> {
    const insert: DbInsert = {
      organization_id: input.organizationId,
      counterparty_organization_id: input.counterpartyOrganizationId,
      connection_id: input.connectionId,
      document_type: input.documentType,
      document_reference_type: input.documentReferenceType ?? null,
      document_reference_id: input.documentReferenceId ?? null,
      document_number: input.documentNumber ?? null,
      document_date: input.documentDate ?? null,
      amount: input.amount ?? null,
      currency: input.currency ?? "INR",
      file_url: input.fileUrl ?? null,
      file_name: input.fileName ?? null,
      notes: input.notes ?? null,
      status: "active",
    };

    const { data, error } = await this.supabase
      .from("cbn_shared_documents")
      .insert(insert)
      .select()
      .single();

    if (error || !data) {return null;}
    return mapRow(data);
  }

  async revoke(documentId: string): Promise<boolean> {
    const { error } = await this.supabase
      .from("cbn_shared_documents")
      .update({ status: "revoked" })
      .eq("id", documentId)
      .is("deleted_at", null);

    return !error;
  }
}
