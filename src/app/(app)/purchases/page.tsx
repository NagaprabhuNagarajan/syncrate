import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { PurchaseOrderService } from "@/features/purchase/services/purchase-order.service";
import { ErrorState } from "@/components/shared/error-state";
import { PurchaseOrdersView } from "@/features/purchase/components/purchase-orders-view";
import type { PurchaseOrderStatus } from "@/features/purchase/types/purchase-order.types";

export const metadata: Metadata = {
  title: "Purchase orders",
  description: "Manage procurement from draft to completion",
};

const PO_STATUSES: readonly PurchaseOrderStatus[] = [
  "draft",
  "submitted",
  "approved",
  "ordered",
  "partially_received",
  "completed",
  "cancelled",
];

function parseStatus(value?: string): PurchaseOrderStatus | undefined {
  if (value && PO_STATUSES.includes(value as PurchaseOrderStatus)) {
    return value as PurchaseOrderStatus;
  }
  return undefined;
}

function parsePage(value?: string): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export default async function PurchasesPage({
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

  if (!context || !context.permissions.includes("purchase.view")) {
    return (
      <div className="p-6 lg:p-8">
        <ErrorState
          title="Access denied"
          message="You do not have permission to view purchase orders for this organization."
        />
      </div>
    );
  }

  const canManage = context.permissions.includes("purchase.create");

  const search = params.search?.trim() || undefined;
  const status = parseStatus(params.status);
  const page = parsePage(params.page);

  const service = new PurchaseOrderService(supabase);
  const [result, stats] = await Promise.all([
    service.listPurchaseOrders(activeOrg.id, { search, status, page }),
    service.getPurchaseOrderStats(activeOrg.id),
  ]);

  return (
    <PurchaseOrdersView
      organizationId={activeOrg.id}
      result={result}
      stats={stats}
      filters={{ search, status }}
      canManage={canManage}
    />
  );
}
