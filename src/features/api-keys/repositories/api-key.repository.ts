import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Database } from "@/types/database.types";
import type { ApiKey } from "@/features/api-keys/types/api-key.types";

type DbApiKey = Database["public"]["Tables"]["api_keys"]["Row"];
type DbApiKeyInsert = Database["public"]["Tables"]["api_keys"]["Insert"];

// ─────────────────────────────────────────────────────────────
// Mapper — deliberately omits `key_hash` so the secret material never
// leaves the repository boundary.
// ─────────────────────────────────────────────────────────────

function mapApiKey(row: DbApiKey): ApiKey {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    keyPrefix: row.key_prefix,
    scopes: row.scopes,
    lastUsedAt: row.last_used_at ? new Date(row.last_used_at) : null,
    expiresAt: row.expires_at ? new Date(row.expires_at) : null,
    revokedAt: row.revoked_at ? new Date(row.revoked_at) : null,
    revokedBy: row.revoked_by,
    createdAt: new Date(row.created_at),
    createdBy: row.created_by,
  };
}

export class ApiKeyRepository {
  constructor(private readonly supabase: AppSupabaseClient) {}

  async listByOrg(organizationId: string): Promise<ApiKey[]> {
    const { data, error } = await this.supabase
      .from("api_keys")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });

    if (error || !data) {
      return [];
    }
    return data.map(mapApiKey);
  }

  async findById(
    id: string,
    organizationId: string
  ): Promise<ApiKey | null> {
    const { data, error } = await this.supabase
      .from("api_keys")
      .select("*")
      .eq("id", id)
      .eq("organization_id", organizationId)
      .single();

    if (error || !data) {
      return null;
    }
    return mapApiKey(data);
  }

  /**
   * Looks up a key by its SHA-256 hash. Returns the mapped key (without the
   * hash); the caller is responsible for revoked/expiry checks.
   */
  async findByHash(keyHash: string): Promise<ApiKey | null> {
    const { data, error } = await this.supabase
      .from("api_keys")
      .select("*")
      .eq("key_hash", keyHash)
      .single();

    if (error || !data) {
      return null;
    }
    return mapApiKey(data);
  }

  async create(input: DbApiKeyInsert): Promise<ApiKey | null> {
    const { data, error } = await this.supabase
      .from("api_keys")
      .insert(input)
      .select("*")
      .single();

    if (error || !data) {
      return null;
    }
    return mapApiKey(data);
  }

  /** Soft tombstone — sets revoked_at/revoked_by; never deletes the row. */
  async revoke(
    id: string,
    organizationId: string,
    revokedBy: string
  ): Promise<ApiKey | null> {
    const now = new Date().toISOString();
    const { data, error } = await this.supabase
      .from("api_keys")
      .update({
        revoked_at: now,
        revoked_by: revokedBy,
        updated_by: revokedBy,
        updated_at: now,
      })
      .eq("id", id)
      .eq("organization_id", organizationId)
      .is("revoked_at", null)
      .select("*")
      .single();

    if (error || !data) {
      return null;
    }
    return mapApiKey(data);
  }

  /** Records the most recent successful verification. Best-effort. */
  async touchLastUsed(id: string): Promise<void> {
    const now = new Date().toISOString();
    await this.supabase
      .from("api_keys")
      .update({ last_used_at: now })
      .eq("id", id);
  }
}
