import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { WarehouseService } from "@/features/warehouse/services/warehouse.service";
import { InventoryService } from "@/features/inventory/services/inventory.service";
import { ErrorState } from "@/components/shared/error-state";
import { InventoryView } from "@/features/inventory/components/inventory-view";
import type { ProductOption } from "@/features/inventory/types/inventory.types";

export const metadata: Metadata = {
  title: "Inventory",
  description: "Track stock levels and movements across your warehouses",
};

function parsePage(value?: string): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export default async function InventoryPage({
  searchParams,
}: {
  readonly searchParams: Promise<{
    org?: string;
    search?: string;
    warehouse?: string;
    low?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    redirect("/login");
  }

  const orgService = new OrganizationService(supabase);
  const organizations = await orgService.listUserOrganizations(data.user.id);

  if (organizations.length === 0) {
    redirect("/create-organization");
  }

  const orgId = params.org ?? organizations[0]?.id;
  const activeOrg =
    organizations.find((o) => o.id === orgId) ?? organizations[0];

  if (!activeOrg) {
    redirect("/create-organization");
  }

  const context = await orgService.getOrganizationContext(
    activeOrg.id,
    data.user.id
  );

  if (!context || !context.permissions.includes("inventory.view")) {
    return (
      <div className="p-6 lg:p-8">
        <ErrorState
          title="Access denied"
          message="You do not have permission to view inventory for this organization."
        />
      </div>
    );
  }

  const canAdjust = context.permissions.includes("inventory.adjust");
  const canTransfer = context.permissions.includes("inventory.transfer");

  const search = params.search?.trim() || undefined;
  const warehouseId = params.warehouse || undefined;
  const lowStockOnly = params.low === "1";
  const page = parsePage(params.page);

  const inventoryService = new InventoryService(supabase);
  const warehouseService = new WarehouseService(supabase);

  const [result, transactions, warehouses, stockValue, productRows] =
    await Promise.all([
      inventoryService.listLevels(activeOrg.id, {
        search,
        warehouseId,
        lowStockOnly,
        page,
      }),
      inventoryService.listTransactions(activeOrg.id, { warehouseId, limit: 50 }),
      warehouseService.listWarehouseOptions(activeOrg.id),
      inventoryService.getStockValue(activeOrg.id),
      supabase
        .from("products")
        .select("id,name,code")
        .eq("organization_id", activeOrg.id)
        .is("deleted_at", null)
        .order("name", { ascending: true })
        .limit(500),
    ]);

  const products: ProductOption[] = (productRows.data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    code: row.code,
  }));

  return (
    <InventoryView
      organizationId={activeOrg.id}
      result={result}
      transactions={transactions}
      products={products}
      warehouses={warehouses}
      filters={{ search, warehouseId, lowStockOnly }}
      stockValue={stockValue}
      canAdjust={canAdjust}
      canTransfer={canTransfer}
    />
  );
}
