import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { SalesOrderService } from "@/features/sales/services/sales-order.service";
import { ErrorState } from "@/components/shared/error-state";
import { SalesOrdersView } from "@/features/sales/components/sales-orders-view";
import type { SalesOrderStatus } from "@/features/sales/types/sales-order.types";

export const metadata: Metadata = {
  title: "Sales orders",
  description: "Manage confirmed customer orders",
};

const SO_STATUSES: readonly SalesOrderStatus[] = [
  "draft",
  "submitted",
  "approved",
  "processing",
  "partially_delivered",
  "completed",
  "cancelled",
];

function parseStatus(value?: string): SalesOrderStatus | undefined {
  if (value && SO_STATUSES.includes(value as SalesOrderStatus)) {
    return value as SalesOrderStatus;
  }
  return undefined;
}

function parsePage(value?: string): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export default async function SalesOrdersPage({
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

  if (!context || !context.permissions.includes("sales.view")) {
    return (
      <div className="p-6 lg:p-8">
        <ErrorState
          title="Access denied"
          message="You do not have permission to view sales orders for this organization."
        />
      </div>
    );
  }

  const canManage = context.permissions.includes("sales.create");
  const search = params.search?.trim() || undefined;
  const status = parseStatus(params.status);
  const page = parsePage(params.page);

  const service = new SalesOrderService(supabase);
  const result = await service.listSalesOrders(activeOrg.id, {
    search,
    status,
    page,
  });

  return (
    <SalesOrdersView
      organizationId={activeOrg.id}
      result={result}
      filters={{ search, status }}
      canManage={canManage}
    />
  );
}
