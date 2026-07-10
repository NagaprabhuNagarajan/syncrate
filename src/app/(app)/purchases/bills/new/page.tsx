import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { ErrorState } from "@/components/shared/error-state";
import { BillForm } from "@/features/purchase/components/bill-form";
import type { BillPrefill } from "@/features/purchase/components/bill-form";
import { fetchBillOptions } from "@/features/purchase/server/bill-options";
import { PurchaseOrderService } from "@/features/purchase/services/purchase-order.service";

export const metadata: Metadata = {
  title: "New bill",
  description: "Record a supplier bill against your business",
};

export default async function NewBillPage({
  searchParams,
}: {
  readonly searchParams: Promise<{
    org?: string;
    fromOcr?: string;
    fromPurchaseOrder?: string;
  }>;
}) {
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

  if (!context || !context.permissions.includes("purchase.create")) {
    return (
      <div className="p-6 lg:p-8">
        <ErrorState
          title="Access denied"
          message="You do not have permission to create bills for this organization."
        />
      </div>
    );
  }

  const options = await fetchBillOptions(supabase, activeOrg.id);

  // Prefill from a purchase order when arriving via "Create bill" on a PO.
  let prefill: BillPrefill | undefined;
  if (query.fromPurchaseOrder) {
    const poResult = await new PurchaseOrderService(supabase).getPurchaseOrder(
      query.fromPurchaseOrder
    );
    if (
      poResult.success &&
      poResult.data.organizationId === activeOrg.id
    ) {
      const po = poResult.data;
      prefill = {
        supplierId: po.supplierId,
        purchaseOrderId: po.id,
        items: po.items.map((item) => ({
          productId: item.productId,
          description: item.description ?? "",
          quantity: String(item.quantity),
          unitPrice: String(item.unitPrice),
          taxRate: String(item.taxRate),
        })),
      };
    }
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="mx-auto w-full max-w-5xl">
        <BillForm
          organizationId={activeOrg.id}
          suppliers={options.suppliers}
          products={options.products}
          fromOcr={query.fromOcr === "1"}
          prefill={prefill}
        />
      </div>
    </div>
  );
}
