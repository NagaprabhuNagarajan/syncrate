import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { SalesOrderService } from "@/features/sales/services/sales-order.service";
import { ErrorState } from "@/components/shared/error-state";
import { SalesOrderDeliveryForm } from "@/features/sales/components/sales-order-delivery-form";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { SalesOrderStatus } from "@/features/sales/types/sales-order.types";

const DELIVERABLE_STATUSES: ReadonlySet<SalesOrderStatus> = new Set([
  "approved",
  "processing",
  "partially_delivered",
]);

interface DeliverPageProps {
  readonly params: Promise<{ id: string }>;
  readonly searchParams: Promise<{ org?: string }>;
}

export const metadata: Metadata = {
  title: "Record delivery",
  description: "Record delivered quantities against a sales order",
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

export default async function RecordDeliveryPage({
  params,
  searchParams,
}: DeliverPageProps) {
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

  if (!context || !context.permissions.includes("sales.create")) {
    return (
      <div className="p-6 lg:p-8">
        <ErrorState
          title="Access denied"
          message="You do not have permission to record deliveries for this organization."
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

  if (!DELIVERABLE_STATUSES.has(so.status)) {
    return (
      <div className="p-6 lg:p-8">
        <ErrorState
          title="Cannot record delivery"
          message="Deliveries can only be recorded against an approved, processing or partially delivered sales order."
        />
      </div>
    );
  }

  const productNames = await lookupProductNames(
    supabase,
    so.items.map((item) => item.productId)
  );

  return (
    <div className="p-6 lg:p-8">
      <div className="mx-auto w-full max-w-5xl">
        <SalesOrderDeliveryForm
          organizationId={activeOrg.id}
          salesOrder={so}
          productNames={productNames}
        />
      </div>
    </div>
  );
}
