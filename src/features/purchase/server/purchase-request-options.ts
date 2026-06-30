import type { AppSupabaseClient } from "@/lib/supabase/types";
import type {
  PrProductOption,
  PrSupplierOption,
  PrBranchOption,
} from "@/features/purchase/components/purchase-request-form";

export interface PurchaseRequestFormOptions {
  readonly branches: PrBranchOption[];
  readonly products: PrProductOption[];
  readonly suppliers: PrSupplierOption[];
}

/**
 * Fetches the option lists the purchase request pages need: branch and
 * product selects for the form, plus suppliers for the "Convert to PO" supplier
 * picker on the detail page. Issues direct, narrow selects so the purchase
 * pages do not depend on in-flight sibling feature modules.
 */
export async function fetchPurchaseRequestOptions(
  supabase: AppSupabaseClient,
  organizationId: string
): Promise<PurchaseRequestFormOptions> {
  const selectNamed = async (
    table: "suppliers" | "branches"
  ): Promise<{ id: string; name: string }[]> => {
    const { data } = await supabase
      .from(table)
      .select("id,name")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("name", { ascending: true });
    return (data ?? []).map((row) => ({ id: row.id, name: row.name }));
  };

  const selectProducts = async (): Promise<PrProductOption[]> => {
    const { data } = await supabase
      .from("products")
      .select("id,name,purchase_price")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("name", { ascending: true });
    return (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      purchasePrice: Number(row.purchase_price),
    }));
  };

  const [branches, products, suppliers] = await Promise.all([
    selectNamed("branches"),
    selectProducts(),
    selectNamed("suppliers"),
  ]);

  return { branches, products, suppliers };
}
