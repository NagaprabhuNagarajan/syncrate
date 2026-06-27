import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { ProductOption } from "@/features/product/components/product-form";

export interface ProductFormOptions {
  readonly categories: ProductOption[];
  readonly brands: ProductOption[];
  readonly units: ProductOption[];
  readonly suppliers: ProductOption[];
}

/**
 * Fetches the lightweight option lists the product form needs (category,
 * brand, unit and supplier selects). Kept intentionally decoupled from the
 * catalog feature modules — it issues direct, narrow selects so the product
 * pages do not depend on in-flight sibling modules.
 */
export async function fetchProductOptions(
  supabase: AppSupabaseClient,
  organizationId: string
): Promise<ProductFormOptions> {
  const select = async (
    table: "categories" | "brands" | "units" | "suppliers"
  ): Promise<ProductOption[]> => {
    const { data } = await supabase
      .from(table)
      .select("id,name")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("name", { ascending: true });
    return (data ?? []).map((row) => ({ id: row.id, name: row.name }));
  };

  const [categories, brands, units, suppliers] = await Promise.all([
    select("categories"),
    select("brands"),
    select("units"),
    select("suppliers"),
  ]);

  return { categories, brands, units, suppliers };
}
