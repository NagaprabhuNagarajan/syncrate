import "server-only";

import type { AppSupabaseClient } from "@/lib/supabase/types";
import { ApprovalService } from "@/features/approvals/services/approval.service";

interface RaiseApprovalsInput {
  readonly organizationId: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly requestedBy: string;
  readonly fields: Record<string, unknown>;
}

/**
 * Best-effort: evaluate the org's active approval rules for a freshly created
 * entity and raise a pending approval request for each rule that matches.
 *
 * Intentionally swallows all errors — approvals are advisory and must never
 * fail (or block) the business action that created the document. Call this
 * AFTER the entity has been successfully persisted.
 */
export async function raiseApprovalsForEntity(
  supabase: AppSupabaseClient,
  input: RaiseApprovalsInput
): Promise<void> {
  try {
    await new ApprovalService(supabase).evaluateAndRaise(input);
  } catch {
    // Advisory only — never surface to the caller.
  }
}
