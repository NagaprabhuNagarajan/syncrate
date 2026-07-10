import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { PurchaseOrderService } from "@/features/purchase/services/purchase-order.service";
import { BillService } from "@/features/purchase/services/bill.service";
import { PurchaseReturnService } from "@/features/purchase/services/purchase-return.service";
import { GoodsReceiptService } from "@/features/purchase/services/goods-receipt.service";
import { ErrorState } from "@/components/shared/error-state";
import { PurchaseOrderDetail } from "@/features/purchase/components/purchase-order-detail";
import type { AppSupabaseClient } from "@/lib/supabase/types";

interface PurchaseOrderDetailPageProps {
  readonly params: Promise<{ id: string }>;
  readonly searchParams: Promise<{ org?: string }>;
}

export async function generateMetadata({
  params,
}: PurchaseOrderDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    return { title: "Purchase order" };
  }
  const result = await new PurchaseOrderService(supabase).getPurchaseOrder(id);
  return { title: result.success ? result.data.poNumber : "Purchase order" };
}

async function lookupName(
  supabase: AppSupabaseClient,
  table: "suppliers" | "branches",
  id: string | null
): Promise<string | null> {
  if (!id) {
    return null;
  }
  const { data } = await supabase
    .from(table)
    .select("name")
    .eq("id", id)
    .single();
  return data?.name ?? null;
}

async function lookupUserName(
  supabase: AppSupabaseClient,
  id: string | null
): Promise<string | null> {
  if (!id) {
    return null;
  }
  const { data } = await supabase
    .from("users")
    .select("full_name,email")
    .eq("id", id)
    .single();
  return data?.full_name ?? data?.email ?? null;
}

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

export default async function PurchaseOrderDetailPage({
  params,
  searchParams,
}: PurchaseOrderDetailPageProps) {
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

  const [
    supplierName,
    branchName,
    productNames,
    linkedBills,
    linkedReturns,
    linkedReceipts,
    approvedByName,
  ] = await Promise.all([
    lookupName(supabase, "suppliers", order.supplierId),
    lookupName(supabase, "branches", order.branchId),
    lookupProductNames(
      supabase,
      order.items.map((item) => item.productId)
    ),
    new BillService(supabase).listBillsForPurchaseOrder(order.id),
    new PurchaseReturnService(supabase).listReturnsForPurchaseOrder(order.id),
    new GoodsReceiptService(supabase).listReceiptsForPurchaseOrder(order.id),
    lookupUserName(supabase, order.approvedBy),
  ]);

  return (
    <PurchaseOrderDetail
      purchaseOrder={order}
      supplierName={supplierName}
      branchName={branchName}
      productNames={productNames}
      linkedBills={linkedBills}
      linkedReturns={linkedReturns}
      linkedReceipts={linkedReceipts}
      approvedByName={approvedByName}
      organizationId={activeOrg.id}
      canManage={context.permissions.includes("purchase.create")}
      canApprove={context.permissions.includes("purchase.approve")}
      canCancel={context.permissions.includes("purchase.cancel")}
      canReceive={context.permissions.includes("purchase.receive")}
    />
  );
}
