import type { AppSupabaseClient } from "@/lib/supabase/types";
import type {
  AiInteraction,
  AiInteractionListParams,
  RecordInteractionInput,
} from "@/features/ai/types/ai.types";
import type { Database } from "@/types/database.types";

type AiInteractionRow =
  Database["public"]["Tables"]["ai_interactions"]["Row"];

function toDomain(row: AiInteractionRow): AiInteraction {
  return {
    id: row.id,
    organizationId: row.organization_id,
    actorUserId: row.actor_user_id,
    capability: row.capability,
    model: row.model,
    promptSummary: row.prompt_summary,
    responseSummary: row.response_summary,
    confidence: row.confidence,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    executionMs: row.execution_ms,
    approvalStatus: row.approval_status,
    status: row.status,
    errorMessage: row.error_message,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: row.created_at,
  };
}

/** Data access for the immutable `ai_interactions` audit trail. */
export class AiInteractionRepository {
  constructor(private readonly supabase: AppSupabaseClient) {}

  async insert(input: RecordInteractionInput): Promise<AiInteraction | null> {
    const { data, error } = await this.supabase
      .from("ai_interactions")
      .insert({
        organization_id: input.organizationId,
        actor_user_id: input.actorUserId,
        capability: input.capability,
        model: input.model,
        prompt_summary: input.promptSummary ?? null,
        response_summary: input.responseSummary ?? null,
        confidence: input.confidence ?? null,
        input_tokens: input.usage.inputTokens,
        output_tokens: input.usage.outputTokens,
        execution_ms: input.usage.executionMs,
        approval_status: input.approvalStatus ?? "not_required",
        status: input.status ?? "success",
        error_message: input.errorMessage ?? null,
        metadata: (input.metadata ?? {}) as Database["public"]["Tables"]["ai_interactions"]["Insert"]["metadata"],
      })
      .select("*")
      .single();

    if (error || !data) {
      return null;
    }
    return toDomain(data);
  }

  async listByOrg(
    organizationId: string,
    params?: AiInteractionListParams
  ): Promise<AiInteraction[]> {
    const limit = Math.min(params?.limit ?? 50, 200);
    const offset = params?.offset ?? 0;

    let query = this.supabase
      .from("ai_interactions")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (params?.capability) {
      query = query.eq("capability", params.capability);
    }

    const { data, error } = await query;
    if (error || !data) {
      return [];
    }
    return data.map(toDomain);
  }
}
