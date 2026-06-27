import type { AppSupabaseClient } from "@/lib/supabase/types";
import { AuditRepository } from "@/features/audit/repositories/audit.repository";
import type {
  AuditLog,
  AuditListParams,
  LogAuditInput,
} from "@/features/audit/types/audit.types";

/**
 * Records and reads the immutable audit trail.
 *
 * `log()` is best-effort: a failure to write an audit entry must never break
 * the user-facing action that triggered it, so it returns a boolean instead
 * of throwing. Call sites should still prefer logging after the primary
 * mutation has succeeded.
 */
export class AuditService {
  private readonly repo: AuditRepository;

  constructor(supabase: AppSupabaseClient) {
    this.repo = new AuditRepository(supabase);
  }

  async log(input: LogAuditInput): Promise<boolean> {
    try {
      return await this.repo.insert(input);
    } catch {
      return false;
    }
  }

  async list(
    organizationId: string,
    params?: AuditListParams
  ): Promise<AuditLog[]> {
    return this.repo.listByOrg(organizationId, params);
  }
}
