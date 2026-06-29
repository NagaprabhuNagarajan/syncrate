import type { AppSupabaseClient } from "@/lib/supabase/types";
import { AiInteractionRepository } from "@/features/ai/repositories/ai-interaction.repository";
import type {
  AiInteraction,
  AiInteractionListParams,
  RecordInteractionInput,
} from "@/features/ai/types/ai.types";

/**
 * Records and reads the immutable AI audit trail (spec §20).
 *
 * `record()` is best-effort: a failure to write an audit row must never break
 * the user-facing AI action, so it swallows errors and returns null — the same
 * contract as {@link AuditService}. Mutating business actions taken as a result
 * of AI still produce their own normal audit_logs entries.
 */
export class AiInteractionService {
  private readonly repo: AiInteractionRepository;

  constructor(supabase: AppSupabaseClient) {
    this.repo = new AiInteractionRepository(supabase);
  }

  async record(
    input: RecordInteractionInput
  ): Promise<AiInteraction | null> {
    try {
      return await this.repo.insert(input);
    } catch {
      return null;
    }
  }

  async list(
    organizationId: string,
    params?: AiInteractionListParams
  ): Promise<AiInteraction[]> {
    return this.repo.listByOrg(organizationId, params);
  }
}
