import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { PurchaseRequestService } from "@/features/purchase/services/purchase-request.service";
import { fetchPurchaseRequestOptions } from "@/features/purchase/server/purchase-request-options";
import { ErrorState } from "@/components/shared/error-state";
import { PurchaseRequestDetail } from "@/features/purchase/components/purchase-request-detail";
import type { AppSupabaseClient } from "@/lib/supabase/types";

interface PurchaseRequestDetailPageProps {
  readonly params: Promise<{ id: string }>;
  readonly searchParams: Promise<{ org?: string }>;
}

export async function generateMetadata({
  params,
}: PurchaseRequestDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    return { title: "Purchase request" };
  }
  const result = await new PurchaseRequestService(supabase).getPurchaseRequest(
    id
  );
  return {
    title: result.success ? result.data.requestNumber : "Purchase request",
  };
}

async function lookupName(
  supabase: AppSupabaseClient,
  table: "branches",
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

export default async function PurchaseRequestDetailPage({
  params,
  searchParams,
}: PurchaseRequestDetailPageProps) {
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
          message="You do not have permission to view purchase requests for this organization."
        />
      </div>
    );
  }

  const service = new PurchaseRequestService(supabase);
  const result = await service.getPurchaseRequest(id);

  if (!result.success || result.data.organizationId !== activeOrg.id) {
    return (
      <div className="p-6 lg:p-8">
        <ErrorState
          title="Purchase request not found"
          message="This purchase request does not exist or belongs to another organization."
        />
      </div>
    );
  }

  const request = result.data;

  const [branchName, productNames, options] = await Promise.all([
    lookupName(supabase, "branches", request.branchId),
    lookupProductNames(
      supabase,
      request.items.map((item) => item.productId)
    ),
    fetchPurchaseRequestOptions(supabase, activeOrg.id),
  ]);

  return (
    <PurchaseRequestDetail
      purchaseRequest={request}
      branchName={branchName}
      productNames={productNames}
      suppliers={options.suppliers}
      organizationId={activeOrg.id}
      canManage={context.permissions.includes("purchase.create")}
      canApprove={context.permissions.includes("purchase.approve")}
      canCancel={context.permissions.includes("purchase.cancel")}
    />
  );
}
