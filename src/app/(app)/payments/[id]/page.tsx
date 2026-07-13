import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { CustomerPaymentService } from "@/features/payment/services/customer-payment.service";
import { PaymentDetail } from "@/features/payment/components/payment-detail";
import type { AppSupabaseClient } from "@/lib/supabase/types";

async function lookupInvoiceNumbers(
  supabase: AppSupabaseClient,
  ids: readonly string[]
): Promise<Record<string, string>> {
  if (ids.length === 0) {
    return {};
  }
  const { data } = await supabase
    .from("invoices")
    .select("id,invoice_number")
    .in("id", [...new Set(ids)]);
  const map: Record<string, string> = {};
  for (const row of data ?? []) {
    map[row.id] = row.invoice_number;
  }
  return map;
}

export const metadata: Metadata = {
  title: "Payment Details",
};

export default async function PaymentDetailPage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ id: string }>;
  readonly searchParams: Promise<{ org?: string }>;
}) {
  const { id } = await params;
  const search = await searchParams;

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

  const service = new CustomerPaymentService(supabase);
  const result = await service.getCustomerPayment(id);

  if (!result.success) {
    notFound();
  }

  const invoiceNumbers = await lookupInvoiceNumbers(
    supabase,
    result.data.allocations.map((allocation) => allocation.invoiceId)
  );

  return (
    <PaymentDetail payment={result.data} invoiceNumbers={invoiceNumbers} />
  );
}
