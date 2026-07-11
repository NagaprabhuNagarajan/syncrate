import type { AppSupabaseClient } from "@/lib/supabase/types";
import type {
  CustomerOption,
  ProductOption,
  BranchOption,
} from "@/features/sales/components/sales-order-form";

export interface SalesOrderFormOptions {
  readonly customers: CustomerOption[];
  readonly products: ProductOption[];
  readonly branches: BranchOption[];
}

async function fetchCustomers(
  supabase: AppSupabaseClient,
  organizationId: string
): Promise<CustomerOption[]> {
  const { data } = await supabase
    .from("customers")
    .select("id,name,billing_state,shipping_state")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("name", { ascending: true });
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    billingState: row.billing_state ?? null,
    shippingState: row.shipping_state ?? null,
  }));
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

async function fetchBranches(
  supabase: AppSupabaseClient,
  organizationId: string
): Promise<BranchOption[]> {
  const { data } = await supabase
    .from("branches")
    .select("id,name,state")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("name", { ascending: true });
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    state: row.state ?? null,
  }));
}

/**
 * Fetches the option lists the sales order form needs (customer, product,
 * and branch selects).
 */
export async function fetchSalesOrderFormOptions(
  supabase: AppSupabaseClient,
  organizationId: string
): Promise<SalesOrderFormOptions> {
  const [customers, products, branches] = await Promise.all([
    fetchCustomers(supabase, organizationId),
    fetchProducts(supabase, organizationId),
    fetchBranches(supabase, organizationId),
  ]);
  return { customers, products, branches };
}
