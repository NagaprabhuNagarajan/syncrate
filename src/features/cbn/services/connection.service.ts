import type { AppSupabaseClient } from "@/lib/supabase/types";
import { AuditService } from "@/features/audit/services/audit.service";
import { ConnectionRepository } from "@/features/cbn/repositories/connection.repository";
import type {
  BusinessConnection,
  CbnActionResult,
  CbnErrorCode,
  ConnectionPermission,
} from "@/features/cbn/types/cbn.types";
import type { RequestConnectionInput } from "@/features/cbn/schemas/connectionSchema";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function ok<T>(data: T): CbnActionResult<T> {
  return { success: true, data };
}

function fail(code: CbnErrorCode, message: string): CbnActionResult<never> {
  return { success: false, error: { code, message } };
}

function mapRpcError(message: string): CbnErrorCode {
  const lower = message.toLowerCase();
  if (lower.includes("not_found")) {return "not_found";}
  if (lower.includes("permission_denied")) {return "permission_denied";}
  if (lower.includes("invalid_status")) {return "invalid_status";}
  if (lower.includes("duplicate")) {return "duplicate";}
  if (lower.includes("prerequisite")) {return "prerequisite";}
  if (lower.includes("validation")) {return "validation";}
  return "unknown";
}

// ─────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────

export class ConnectionService {
  private readonly repo: ConnectionRepository;
  private readonly audit: AuditService;

  constructor(private readonly supabase: AppSupabaseClient) {
    this.repo = new ConnectionRepository(supabase);
    this.audit = new AuditService(supabase);
  }

  async requestConnection(
    input: RequestConnectionInput
  ): Promise<CbnActionResult<string>> {
    const { data, error } = await this.supabase.rpc(
      "request_business_connection",
      {
        p_requester_org_id: input.requesterOrgId,
        p_recipient_org_id: input.recipientOrgId,
        p_message: input.message ?? null,
      }
    );

    if (error) {
      return fail(mapRpcError(error.message), error.message);
    }

    const connectionId = data as string;

    await this.audit.log({
      organizationId: input.requesterOrgId,
      actorUserId: null,
      action: "cbn.connection.request",
      entityType: "business_connection",
      entityId: connectionId,
      summary: `Requested connection with org ${input.recipientOrgId}`,
    });

    return ok(connectionId);
  }

  async acceptConnection(
    connectionId: string
  ): Promise<CbnActionResult<void>> {
    const connection = await this.repo.findById(connectionId);
    if (!connection) {return fail("not_found", "Connection not found");}

    const { error } = await this.supabase.rpc("accept_connection_request", {
      p_connection_id: connectionId,
    });

    if (error) {
      return fail(mapRpcError(error.message), error.message);
    }

    await this.audit.log({
      organizationId: connection.recipientOrganizationId,
      actorUserId: null,
      action: "cbn.connection.accept",
      entityType: "business_connection",
      entityId: connectionId,
      summary: `Accepted connection from org ${connection.requesterOrganizationId}`,
    });

    return ok(undefined);
  }

  async rejectConnection(
    connectionId: string,
    reason?: string
  ): Promise<CbnActionResult<void>> {
    const connection = await this.repo.findById(connectionId);
    if (!connection) {return fail("not_found", "Connection not found");}

    const { error } = await this.supabase.rpc("reject_connection_request", {
      p_connection_id: connectionId,
      p_reason: reason ?? null,
    });

    if (error) {
      return fail(mapRpcError(error.message), error.message);
    }

    await this.audit.log({
      organizationId: connection.recipientOrganizationId,
      actorUserId: null,
      action: "cbn.connection.reject",
      entityType: "business_connection",
      entityId: connectionId,
      summary: `Rejected connection from org ${connection.requesterOrganizationId}`,
    });

    return ok(undefined);
  }

  async disconnect(
    connectionId: string,
    reason?: string
  ): Promise<CbnActionResult<void>> {
    const connection = await this.repo.findById(connectionId);
    if (!connection) {return fail("not_found", "Connection not found");}

    const { error } = await this.supabase.rpc("disconnect_business", {
      p_connection_id: connectionId,
      p_reason: reason ?? null,
    });

    if (error) {
      return fail(mapRpcError(error.message), error.message);
    }

    await this.audit.log({
      organizationId: connection.organizationId,
      actorUserId: null,
      action: "cbn.connection.disconnect",
      entityType: "business_connection",
      entityId: connectionId,
      summary: `Disconnected from connection ${connectionId}`,
    });

    return ok(undefined);
  }

  async updatePermissions(
    connectionId: string,
    myGrants: ConnectionPermission[]
  ): Promise<CbnActionResult<void>> {
    const connection = await this.repo.findById(connectionId);
    if (!connection) {return fail("not_found", "Connection not found");}

    const { error } = await this.supabase.rpc("update_connection_permissions", {
      p_connection_id: connectionId,
      p_my_grants: myGrants as string[],
    });

    if (error) {
      return fail(mapRpcError(error.message), error.message);
    }

    await this.audit.log({
      organizationId: connection.organizationId,
      actorUserId: null,
      action: "cbn.connection.update_permissions",
      entityType: "business_connection",
      entityId: connectionId,
      summary: `Updated permissions for connection ${connectionId}`,
      metadata: { grants: myGrants },
    });

    return ok(undefined);
  }

  async listConnections(orgId: string): Promise<BusinessConnection[]> {
    return this.repo.findByOrg(orgId);
  }

  async getConnection(id: string): Promise<CbnActionResult<BusinessConnection>> {
    const connection = await this.repo.findById(id);
    if (!connection) {return fail("not_found", "Connection not found");}
    return ok(connection);
  }
}
