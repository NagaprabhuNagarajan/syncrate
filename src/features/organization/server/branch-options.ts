import type { AppSupabaseClient } from "@/lib/supabase/types";

/** Lightweight branch option for form selects (stock location pickers). */
export interface BranchOption {
  readonly id: string;
  readonly name: string;
}

/**
 * Fetches the organization's branches as {id, name} options. Branches are the
 * single location concept (formerly "branches") used for inventory/stock.
 */
export async function fetchBranchOptions(
  supabase: AppSupabaseClient,
  organizationId: string
): Promise<BranchOption[]> {
  const { data } = await supabase
    .from("branches")
    .select("id,name")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("name", { ascending: true });
  return (data ?? []).map((row) => ({ id: row.id, name: row.name }));
}
