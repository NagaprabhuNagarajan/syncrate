import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Database } from "@/types/database.types";
import type { User } from "@/features/identity/types/auth.types";

type DbUser = Database["public"]["Tables"]["users"]["Row"];

// ─────────────────────────────────────────────────────────────
// Mappers
// ─────────────────────────────────────────────────────────────

function mapDbUserToDomain(row: DbUser): User {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    avatarUrl: row.avatar_url,
    phone: row.phone,
    status: (row.status as User["status"]) ?? "active",
    lastLoginAt: row.last_login_at ? new Date(row.last_login_at) : null,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

// ─────────────────────────────────────────────────────────────
// Repository
// ─────────────────────────────────────────────────────────────

export class AuthRepository {
  constructor(private readonly supabase: AppSupabaseClient) {}

  async findById(id: string): Promise<User | null> {
    const { data, error } = await this.supabase
      .from("users")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (error || !data) {
      return null;
    }
    return mapDbUserToDomain(data);
  }

  async findByEmail(email: string): Promise<User | null> {
    const { data, error } = await this.supabase
      .from("users")
      .select("*")
      .eq("email", email.toLowerCase().trim())
      .is("deleted_at", null)
      .single();

    if (error || !data) {
      return null;
    }
    return mapDbUserToDomain(data);
  }

  async update(
    id: string,
    patch: Partial<
      Pick<DbUser, "full_name" | "avatar_url" | "phone" | "status">
    >
  ): Promise<User | null> {
    const { data, error } = await this.supabase
      .from("users")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id)
      .is("deleted_at", null)
      .select("*")
      .single();

    if (error || !data) {
      return null;
    }
    return mapDbUserToDomain(data);
  }
}
