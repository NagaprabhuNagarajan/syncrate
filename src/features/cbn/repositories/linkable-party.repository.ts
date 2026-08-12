import type { AppSupabaseClient } from "@/lib/supabase/types";
import type {
  ConnectionPartyRole,
  LinkableParty,
} from "@/features/cbn/types/cbn.types";

/**
 * Reads the local customer / supplier records that may still be bound to a CBN
 * connection. "Available" means active, not soft-deleted, and not already
 * linked — a record can represent only one connected business.
 */
export class LinkablePartyRepository {
  constructor(private readonly supabase: AppSupabaseClient) {}

  async listUnlinked(
    orgId: string,
    role: ConnectionPartyRole
  ): Promise<readonly LinkableParty[]> {
    const table = role === "customer" ? "customers" : "suppliers";

    const { data, error } = await this.supabase
      .from(table)
      .select("id, code, name")
      .eq("organization_id", orgId)
      .eq("status", "active")
      .is("cbn_connection_id", null)
      .is("deleted_at", null)
      .order("name", { ascending: true });

    if (error || !data) {
      return [];
    }

    return data.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
    }));
  }

  /** The record bound to a connection, if this org has linked one. */
  async findLinked(
    orgId: string,
    role: ConnectionPartyRole,
    connectionId: string
  ): Promise<LinkableParty | null> {
    const table = role === "customer" ? "customers" : "suppliers";

    const { data, error } = await this.supabase
      .from(table)
      .select("id, code, name")
      .eq("organization_id", orgId)
      .eq("cbn_connection_id", connectionId)
      .is("deleted_at", null)
      .limit(1)
      .single();

    if (error || !data) {
      return null;
    }
    return { id: data.id, code: data.code, name: data.name };
  }
}
