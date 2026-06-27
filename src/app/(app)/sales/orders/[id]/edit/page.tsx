import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { SalesOrderService } from "@/features/sales/services/sales-order.service";
import { ErrorState } from "@/components/shared/error-state";
import { SalesOrderForm } from "@/features/sales/components/sales-order-form";
import { fetchSalesOrderFormOptions } from "@/features/sales/server/sales-form-options";

export const metadata: Metadata = {
  title: "Edit sales order",
  description: "Update the draft sales order",
};

interface EditSalesOrderPageProps {
  readonly params: Promise<{ id: string }>;
  readonly searchParams: Promise<{ org?: string }>;
}

export default async function EditSalesOrderPage({
  params,
  searchParams,
}: EditSalesOrderPageProps) {
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
          message="You do not have permission to edit sales orders for this organization."
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

  if (result.data.status !== "draft") {
    return (
      <div className="p-6 lg:p-8">
        <ErrorState
          title="Cannot edit this sales order"
          message="Only draft sales orders can be edited. This order has already been submitted."
        />
      </div>
    );
  }

  const options = await fetchSalesOrderFormOptions(supabase, activeOrg.id);

  return (
    <div className="p-6 lg:p-8">
      <div className="mx-auto w-full max-w-5xl">
        <SalesOrderForm
          organizationId={activeOrg.id}
          orgState={context.organization.state ?? ""}
          customers={options.customers}
          warehouses={options.warehouses}
          products={options.products}
          salesOrder={result.data}
        />
      </div>
    </div>
  );
}
