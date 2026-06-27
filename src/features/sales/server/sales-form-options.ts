import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { CustomerOption } from "@/features/sales/components/quotation-form";
import type {
  ProductOption,
  WarehouseOption,
} from "@/features/sales/components/sales-order-form";

export interface QuotationFormOptions {
  readonly customers: CustomerOption[];
  readonly products: ProductOption[];
}

export interface SalesOrderFormOptions {
  readonly customers: CustomerOption[];
  readonly products: ProductOption[];
  readonly warehouses: WarehouseOption[];
}

async function fetchCustomers(
  supabase: AppSupabaseClient,
  organizationId: string
): Promise<CustomerOption[]> {
  const { data } = await supabase
    .from("customers")
    .select("id,name")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("name", { ascending: true });
  return (data ?? []).map((row) => ({ id: row.id, name: row.name }));
}

async function fetchProducts(
  supabase: AppSupabaseClient,
  organizationId: string
): Promise<ProductOption[]> {
  const { data } = await supabase
    .from("products")
    .select("id,name,selling_price,gst_rate")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("name", { ascending: true });
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    sellingPrice: Number((row as Record<string, unknown>)["selling_price"] ?? 0),
    gstRate: Number(row.gst_rate),
  }));
}

async function fetchWarehouses(
  supabase: AppSupabaseClient,
  organizationId: string
): Promise<WarehouseOption[]> {
  const { data } = await supabase
    .from("warehouses")
    .select("id,name")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("name", { ascending: true });
  return (data ?? []).map((row) => ({ id: row.id, name: row.name }));
}

/**
 * Fetches the option lists the quotation form needs (customer and product
 * selects). Products carry their selling price and GST rate so line rows
 * can pre-fill on selection.
 */
export async function fetchQuotationFormOptions(
  supabase: AppSupabaseClient,
  organizationId: string
): Promise<QuotationFormOptions> {
  const [customers, products] = await Promise.all([
    fetchCustomers(supabase, organizationId),
    fetchProducts(supabase, organizationId),
  ]);
  return { customers, products };
}

/**
 * Fetches the option lists the sales order form needs (customer, product,
 * and warehouse selects).
 */
export async function fetchSalesOrderFormOptions(
  supabase: AppSupabaseClient,
  organizationId: string
): Promise<SalesOrderFormOptions> {
  const [customers, products, warehouses] = await Promise.all([
    fetchCustomers(supabase, organizationId),
    fetchProducts(supabase, organizationId),
    fetchWarehouses(supabase, organizationId),
  ]);
  return { customers, products, warehouses };
}
