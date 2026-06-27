import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { PurchaseOrderService } from "@/features/purchase/services/purchase-order.service";
import { fetchPurchaseOrderOptions } from "@/features/purchase/server/purchase-order-options";
import { ErrorState } from "@/components/shared/error-state";
import { GoodsReceiptForm } from "@/features/purchase/components/goods-receipt-form";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { PurchaseOrderStatus } from "@/features/purchase/types/purchase-order.types";

const RECEIVABLE_STATUSES: ReadonlySet<PurchaseOrderStatus> = new Set([
  "approved",
  "ordered",
  "partially_received",
]);

interface ReceivePageProps {
  readonly params: Promise<{ id: string }>;
  readonly searchParams: Promise<{ org?: string }>;
}

export const metadata: Metadata = {
  title: "Receive goods",
  description: "Record a delivery against a purchase order",
};

async function lookupProductNames(
  supabase: AppSupabaseClient,
  ids: readonly string[]
): Promise<Record<string, string>> {
  if (ids.length === 0) {
    return {};
  }
  const { data } = await supabase
    .from("products")
    .select("id,name")
    .in("id", [...new Set(ids)]);
  const map: Record<string, string> = {};
  for (const row of data ?? []) {
    map[row.id] = row.name;
  }
  return map;
}

export default async function ReceiveGoodsPage({
  params,
  searchParams,
}: ReceivePageProps) {
  const { id } = await params;
  const query = await searchParams;
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

  const orgId = query.org ?? organizations[0]?.id;
  const activeOrg =
    organizations.find((o) => o.id === orgId) ?? organizations[0];

  if (!activeOrg) {
    redirect("/create-organization");
  }

  const context = await orgService.getOrganizationContext(
    activeOrg.id,
    data.user.id
  );

  if (!context || !context.permissions.includes("purchase.receive")) {
    return (
      <div className="p-6 lg:p-8">
        <ErrorState
          title="Access denied"
          message="You do not have permission to receive goods for this organization."
        />
      </div>
    );
  }

  const service = new PurchaseOrderService(supabase);
  const result = await service.getPurchaseOrder(id);

  if (!result.success || result.data.organizationId !== activeOrg.id) {
    return (
      <div className="p-6 lg:p-8">
        <ErrorState
          title="Purchase order not found"
          message="This purchase order does not exist or belongs to another organization."
        />
      </div>
    );
  }

  const order = result.data;

  if (!RECEIVABLE_STATUSES.has(order.status)) {
    return (
      <div className="p-6 lg:p-8">
        <ErrorState
          title="Cannot receive goods"
          message="Goods can only be received against an approved, ordered or partially received purchase order."
        />
      </div>
    );
  }

  const [productNames, options] = await Promise.all([
    lookupProductNames(
      supabase,
      order.items.map((item) => item.productId)
    ),
    fetchPurchaseOrderOptions(supabase, activeOrg.id),
  ]);

  return (
    <div className="p-6 lg:p-8">
      <div className="mx-auto w-full max-w-5xl">
        <GoodsReceiptForm
          organizationId={activeOrg.id}
          purchaseOrder={order}
          productNames={productNames}
          warehouses={options.warehouses}
        />
      </div>
    </div>
  );
}
