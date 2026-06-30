import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { SalesOrderService } from "@/features/sales/services/sales-order.service";
import { ErrorState } from "@/components/shared/error-state";
import { SalesOrderDetail } from "@/features/sales/components/sales-order-detail";
import type { AppSupabaseClient } from "@/lib/supabase/types";

interface SalesOrderDetailPageProps {
  readonly params: Promise<{ id: string }>;
  readonly searchParams: Promise<{ org?: string }>;
}

export async function generateMetadata({
  params,
}: SalesOrderDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {return { title: "Sales order" };}
  const result = await new SalesOrderService(supabase).getSalesOrder(id);
  return { title: result.success ? result.data.soNumber : "Sales order" };
}

async function lookupName(
  supabase: AppSupabaseClient,
  table: "customers" | "branches",
  id: string | null
): Promise<string | null> {
  if (!id) {return null;}
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
  if (ids.length === 0) {return {};}
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

export default async function SalesOrderDetailPage({
  params,
  searchParams,
}: SalesOrderDetailPageProps) {
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

  const service = new SalesOrderService(supabase);
  const result = await service.getSalesOrder(id);

  if (!result.success || result.data.organizationId !== activeOrg.id) {
    return (
      <div className="p-6 lg:p-8">
        <ErrorState
          title="Sales order not found"
          message="This sales order does not exist or belongs to another organization."
        />
      </div>
    );
  }

  const so = result.data;

  const [customerName, branchName, productNames] = await Promise.all([
    lookupName(supabase, "customers", so.customerId),
    lookupName(supabase, "branches", so.branchId),
    lookupProductNames(
      supabase,
      so.items.map((item) => item.productId)
    ),
  ]);

  return (
    <SalesOrderDetail
      salesOrder={so}
      customerName={customerName}
      branchName={branchName}
      productNames={productNames}
      organizationId={activeOrg.id}
      canManage={context.permissions.includes("sales.create")}
      canApprove={context.permissions.includes("sales.approve")}
      canCancel={context.permissions.includes("sales.cancel")}
    />
  );
}
