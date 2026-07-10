import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { PurchaseReturnService } from "@/features/purchase/services/purchase-return.service";
import { ErrorState } from "@/components/shared/error-state";
import { PurchaseReturnDetail } from "@/features/purchase/components/purchase-return-detail";
import type { AppSupabaseClient } from "@/lib/supabase/types";

interface PurchaseReturnDetailPageProps {
  readonly params: Promise<{ id: string }>;
  readonly searchParams: Promise<{ org?: string }>;
}

export async function generateMetadata({
  params,
}: PurchaseReturnDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    return { title: "Purchase return" };
  }
  const result = await new PurchaseReturnService(supabase).getPurchaseReturn(id);
  return { title: result.success ? result.data.returnNumber : "Purchase return" };
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

async function lookupPurchaseOrderNumber(
  supabase: AppSupabaseClient,
  id: string | null
): Promise<string | null> {
  if (!id) {
    return null;
  }
  const { data } = await supabase
    .from("purchase_orders")
    .select("po_number")
    .eq("id", id)
    .single();
  return data?.po_number ?? null;
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

export default async function PurchaseReturnDetailPage({
  params,
  searchParams,
}: PurchaseReturnDetailPageProps) {
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
          message="You do not have permission to view purchase returns for this organization."
        />
      </div>
    );
  }

  const service = new PurchaseReturnService(supabase);
  const result = await service.getPurchaseReturn(id);

  if (!result.success || result.data.organizationId !== activeOrg.id) {
    return (
      <div className="p-6 lg:p-8">
        <ErrorState
          title="Purchase return not found"
          message="This purchase return does not exist or belongs to another organization."
        />
      </div>
    );
  }

  const purchaseReturn = result.data;

  const [supplierName, branchName, productNames, purchaseOrderNumber] =
    await Promise.all([
      lookupName(supabase, "suppliers", purchaseReturn.supplierId),
      lookupName(supabase, "branches", purchaseReturn.branchId),
      lookupProductNames(
        supabase,
        purchaseReturn.items.map((item) => item.productId)
      ),
      lookupPurchaseOrderNumber(supabase, purchaseReturn.purchaseOrderId),
    ]);

  return (
    <PurchaseReturnDetail
      purchaseReturn={purchaseReturn}
      supplierName={supplierName}
      branchName={branchName}
      productNames={productNames}
      purchaseOrderNumber={purchaseOrderNumber}
      organizationId={activeOrg.id}
      canComplete={context.permissions.includes("purchase.receive")}
      canCancel={context.permissions.includes("purchase.cancel")}
      canManage={context.permissions.includes("purchase.create")}
    />
  );
}
