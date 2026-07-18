import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { BillService } from "@/features/purchase/services/bill.service";
import { SupplierPaymentService } from "@/features/payment/services/supplier-payment.service";
import { ErrorState } from "@/components/shared/error-state";
import { BillDetail } from "@/features/purchase/components/bill-detail";
import { getEntityApprovals } from "@/features/approvals/server/entity-approvals";
import type { AppSupabaseClient } from "@/lib/supabase/types";

interface BillDetailPageProps {
  readonly params: Promise<{ id: string }>;
  readonly searchParams: Promise<{ org?: string }>;
}

export async function generateMetadata({
  params,
}: BillDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    return { title: "Bill" };
  }
  const result = await new BillService(supabase).getBill(
    id
  );
  return {
    title: result.success ? result.data.invoiceNumber : "Bill",
  };
}

async function lookupSupplierName(
  supabase: AppSupabaseClient,
  id: string | null
): Promise<string | null> {
  if (!id) {
    return null;
  }
  const { data } = await supabase
    .from("suppliers")
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

export default async function BillDetailPage({
  params,
  searchParams,
}: BillDetailPageProps) {
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
          message="You do not have permission to view bills for this organization."
        />
      </div>
    );
  }

  const service = new BillService(supabase);
  const result = await service.getBill(id);

  if (!result.success || result.data.organizationId !== activeOrg.id) {
    return (
      <div className="p-6 lg:p-8">
        <ErrorState
          title="Bill not found"
          message="This bill does not exist or belongs to another organization."
        />
      </div>
    );
  }

  const invoice = result.data;

  const paymentService = new SupplierPaymentService(supabase);
  const [
    supplierName,
    productNames,
    purchaseOrderNumber,
    availableCredit,
    payments,
    approvals,
  ] = await Promise.all([
    lookupSupplierName(supabase, invoice.supplierId),
    lookupProductNames(
      supabase,
      invoice.items.map((item) => item.productId)
    ),
    lookupPurchaseOrderNumber(supabase, invoice.purchaseOrderId),
    paymentService.getAvailableCredit(activeOrg.id, invoice.supplierId),
    paymentService.listPaymentsForBill(activeOrg.id, invoice.id),
    getEntityApprovals(supabase, activeOrg.id, "purchase_invoice", invoice.id, {
      roleId: context.member.roleId,
      canDecide: context.permissions.includes("approval.decide"),
      canManage: context.permissions.includes("approval.manage"),
    }),
  ]);

  return (
    <BillDetail
      bill={invoice}
      supplierName={supplierName}
      productNames={productNames}
      purchaseOrderNumber={purchaseOrderNumber}
      availableCredit={availableCredit}
      payments={payments}
      approvals={approvals}
      organizationId={activeOrg.id}
      canManage={context.permissions.includes("purchase.create")}
      canCancel={context.permissions.includes("purchase.cancel")}
      canMakePayment={context.permissions.includes("payment.make")}
    />
  );
}
