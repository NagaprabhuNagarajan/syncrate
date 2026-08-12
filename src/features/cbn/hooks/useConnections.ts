"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { ConnectionPartyRole } from "@/features/cbn/types/cbn.types";
import type {
  BusinessConnection,
  ConnectionStatus,
} from "@/features/cbn/types/cbn.types";

type DbRow = {
  id: string;
  organization_id: string;
  requester_organization_id: string;
  recipient_organization_id: string;
  status: ConnectionStatus;
  connection_message: string | null;
  requester_grants: string[];
  recipient_grants: string[];
  requested_at: string;
  accepted_at: string | null;
  rejected_at: string | null;
  disconnected_at: string | null;
  rejection_reason: string | null;
  requester_counterparty_role: ConnectionPartyRole | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  deleted_by: string | null;
  version: number;
};

function mapRow(row: DbRow): BusinessConnection {
  return {
    id: row.id,
    organizationId: row.organization_id,
    requesterOrganizationId: row.requester_organization_id,
    recipientOrganizationId: row.recipient_organization_id,
    status: row.status,
    connectionMessage: row.connection_message,
    requesterGrants: row.requester_grants,
    recipientGrants: row.recipient_grants,
    requestedAt: new Date(row.requested_at),
    acceptedAt: row.accepted_at ? new Date(row.accepted_at) : null,
    rejectedAt: row.rejected_at ? new Date(row.rejected_at) : null,
    disconnectedAt: row.disconnected_at ? new Date(row.disconnected_at) : null,
    rejectionReason: row.rejection_reason,
    requesterCounterpartyRole: row.requester_counterparty_role,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    createdBy: row.created_by,
  };
}

async function fetchConnections(
  orgId: string,
  status?: ConnectionStatus
): Promise<BusinessConnection[]> {
  const supabase = createClient();
  let query = supabase
    .from("business_connections")
    .select("*")
    .or(
      `requester_organization_id.eq.${orgId},recipient_organization_id.eq.${orgId}`
    )
    .is("deleted_at", null)
    .order("requested_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error || !data) {return [];}
  return (data as DbRow[]).map(mapRow);
}

interface UseConnectionsOptions {
  readonly organizationId: string;
  readonly status?: ConnectionStatus;
}

/**
 * TanStack Query hook to fetch business connections for an org.
 */
export function useConnections({ organizationId, status }: UseConnectionsOptions) {
  return useQuery({
    queryKey: ["cbn", "connections", organizationId, status],
    queryFn: () => fetchConnections(organizationId, status),
    enabled: Boolean(organizationId),
    staleTime: 60_000,
  });
}
