import type { AppSupabaseClient } from "@/lib/supabase/types";

/**
 * Reads the receiving organization's remembered "their product = my product"
 * decisions. Writes happen inside accept_cbn_invoice so the mapping is recorded
 * in the same transaction as the bill it justified.
 */
export class ProductLinkRepository {
  constructor(private readonly supabase: AppSupabaseClient) {}

  /**
   * Maps supplier product id → this org's product id for one connection.
   * Returns an empty map on error: a missing memory only costs the user a
   * prompt, whereas throwing would block the whole inbox.
   */
  async findForConnection(
    orgId: string,
    connectionId: string,
    supplierProductIds: readonly string[]
  ): Promise<ReadonlyMap<string, string>> {
    if (supplierProductIds.length === 0) {
      return new Map();
    }

    const { data, error } = await this.supabase
      .from("cbn_product_links")
      .select("counterparty_product_id, product_id")
      .eq("organization_id", orgId)
      .eq("connection_id", connectionId)
      .in("counterparty_product_id", [...new Set(supplierProductIds)])
      .is("deleted_at", null);

    if (error || !data) {
      return new Map();
    }

    return new Map(
      data.map((row) => [row.counterparty_product_id, row.product_id])
    );
  }
}
