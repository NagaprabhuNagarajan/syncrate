import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { CustomerPaymentService } from "@/features/payment/services/customer-payment.service";
import { SupplierPaymentService } from "@/features/payment/services/supplier-payment.service";
import { PaymentDetail } from "@/features/payment/components/payment-detail";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type {
  PaymentWithAllocations,
  SupplierPaymentWithAllocations,
} from "@/features/payment/types/payment.types";

async function lookupEntityNumbers(
  supabase: AppSupabaseClient,
  table: "invoices" | "purchase_invoices",
  ids: readonly string[]
): Promise<Record<string, string>> {
  if (ids.length === 0) {
    return {};
  }
  const { data } = await supabase
    .from(table)
    .select("id,invoice_number")
    .in("id", [...new Set(ids)]);
  const map: Record<string, string> = {};
  for (const row of data ?? []) {
    map[row.id] = row.invoice_number;
  }
  return map;
}

/** Re-shapes a supplier payment into the customer-shaped view-model that
 * PaymentDetail renders, relabelled for suppliers/bills. */
function toSupplierViewModel(
  payment: SupplierPaymentWithAllocations
): PaymentWithAllocations {
  return {
    ...payment,
    customerId: payment.supplierId,
    customerName: payment.supplierName,
    allocations: payment.allocations.map((allocation) => ({
      id: allocation.id,
      organizationId: allocation.organizationId,
      customerPaymentId: allocation.supplierPaymentId,
      invoiceId: allocation.purchaseInvoiceId,
      allocatedAmount: allocation.allocatedAmount,
      createdAt: allocation.createdAt,
      createdBy: allocation.createdBy,
    })),
  };
}

export const metadata: Metadata = {
  title: "Payment Details",
};

export default async function PaymentDetailPage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ id: string }>;
  readonly searchParams: Promise<{ org?: string; type?: string }>;
}) {
  const { id } = await params;
  const search = await searchParams;
  const isSupplier = search.type === "supplier";

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

  const orgId = search.org ?? organizations[0]?.id;
  const activeOrg =
    organizations.find((o) => o.id === orgId) ?? organizations[0];

  if (!activeOrg) {
    redirect("/create-organization");
  }

  if (isSupplier) {
    const result = await new SupplierPaymentService(
      supabase
    ).getSupplierPaymentWithAllocations(id);

    if (!result.success || result.data.organizationId !== activeOrg.id) {
      notFound();
    }

    const entityNumbers = await lookupEntityNumbers(
      supabase,
      "purchase_invoices",
      result.data.allocations.map((allocation) => allocation.purchaseInvoiceId)
    );

    return (
      <PaymentDetail
        payment={toSupplierViewModel(result.data)}
        invoiceNumbers={entityNumbers}
        partyLabel="Supplier"
        entityLabel="Bill"
        entityHrefBase="/bills"
      />
    );
  }

  const result = await new CustomerPaymentService(supabase).getCustomerPayment(
    id
  );

  if (!result.success || result.data.organizationId !== activeOrg.id) {
    notFound();
  }

  const invoiceNumbers = await lookupEntityNumbers(
    supabase,
    "invoices",
    result.data.allocations.map((allocation) => allocation.invoiceId)
  );

  return (
    <PaymentDetail payment={result.data} invoiceNumbers={invoiceNumbers} />
  );
}
