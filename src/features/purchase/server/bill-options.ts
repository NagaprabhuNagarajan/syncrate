import type { AppSupabaseClient } from "@/lib/supabase/types";
import type {
  ProductOption,
  SupplierOption,
} from "@/features/purchase/components/bill-form";

export interface BillFormOptions {
  readonly suppliers: SupplierOption[];
  readonly products: ProductOption[];
}

/**
 * Fetches the option lists the bill form needs (supplier and
 * product selects). Issues direct, narrow selects so the purchase pages do not
 * depend on in-flight sibling feature modules. Products carry their purchase
 * price and GST rate so line rows can pre-fill on selection.
 */
export async function fetchBillOptions(
  supabase: AppSupabaseClient,
  organizationId: string
): Promise<BillFormOptions> {
  const selectSuppliers = async (): Promise<SupplierOption[]> => {
    const { data } = await supabase
      .from("suppliers")
      .select("id,name")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("name", { ascending: true });
    return (data ?? []).map((row) => ({ id: row.id, name: row.name }));
  };

  const selectProducts = async (): Promise<ProductOption[]> => {
    const { data } = await supabase
      .from("products")
      .select("id,name,purchase_price,gst_rate")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("name", { ascending: true });
    return (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      purchasePrice: Number(row.purchase_price),
      gstRate: Number(row.gst_rate),
    }));
  };

  const [suppliers, products] = await Promise.all([
    selectSuppliers(),
    selectProducts(),
  ]);

  return { suppliers, products };
}
