import type { AppSupabaseClient } from "@/lib/supabase/types";
import type {
  ProductOption,
  SupplierOption,
  WarehouseOption,
} from "@/features/purchase/components/purchase-order-form";

export interface PurchaseOrderFormOptions {
  readonly suppliers: SupplierOption[];
  readonly warehouses: WarehouseOption[];
  readonly products: ProductOption[];
}

/**
 * Fetches the option lists the purchase order form needs (supplier, warehouse
 * and product selects). Issues direct, narrow selects so the purchase pages do
 * not depend on in-flight sibling feature modules. Products carry their
 * purchase price and GST rate so line rows can pre-fill on selection.
 */
export async function fetchPurchaseOrderOptions(
  supabase: AppSupabaseClient,
  organizationId: string
): Promise<PurchaseOrderFormOptions> {
  const selectNamed = async (
    table: "suppliers" | "warehouses"
  ): Promise<{ id: string; name: string }[]> => {
    const { data } = await supabase
      .from(table)
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

  const [suppliers, warehouses, products] = await Promise.all([
    selectNamed("suppliers"),
    selectNamed("warehouses"),
    selectProducts(),
  ]);

  return { suppliers, warehouses, products };
}
