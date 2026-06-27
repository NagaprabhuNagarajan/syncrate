import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { WarehouseService } from "@/features/warehouse/services/warehouse.service";
import { ErrorState } from "@/components/shared/error-state";
import { WarehousesView } from "@/features/warehouse/components/warehouses-view";
import type { WarehouseStatus } from "@/features/warehouse/types/warehouse.types";

export const metadata: Metadata = {
  title: "Warehouses",
  description: "Manage the stock locations for your organization",
};

const WAREHOUSE_STATUSES: readonly WarehouseStatus[] = [
  "active",
  "inactive",
  "archived",
];

function parseStatus(value?: string): WarehouseStatus | undefined {
  if (value && WAREHOUSE_STATUSES.includes(value as WarehouseStatus)) {
    return value as WarehouseStatus;
  }
  return undefined;
}

function parsePage(value?: string): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export default async function WarehousesPage({
  searchParams,
}: {
  readonly searchParams: Promise<{
    org?: string;
    search?: string;
    status?: string;
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
          message="You do not have permission to view warehouses for this organization."
        />
      </div>
    );
  }

  const canManage = context.permissions.includes("inventory.adjust");

  const search = params.search?.trim() || undefined;
  const status = parseStatus(params.status);
  const page = parsePage(params.page);

  const warehouseService = new WarehouseService(supabase);
  const result = await warehouseService.listWarehouses(activeOrg.id, {
    search,
    status,
    page,
  });

  return (
    <WarehousesView
      organizationId={activeOrg.id}
      result={result}
      filters={{ search, status }}
      canManage={canManage}
    />
  );
}
