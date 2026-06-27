import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { CustomerPaymentService } from "@/features/payment/services/customer-payment.service";
import { SupplierPaymentService } from "@/features/payment/services/supplier-payment.service";
import { ErrorState } from "@/components/shared/error-state";
import { PaymentsView } from "@/features/payment/components/payments-view";

export const metadata: Metadata = {
  title: "Payments",
  description: "Manage customer receipts and supplier disbursements",
};

function parsePage(value?: string): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export default async function PaymentsPage({
  searchParams,
}: {
  readonly searchParams: Promise<{
    org?: string;
    cSearch?: string;
    sSearch?: string;
    cPage?: string;
    sPage?: string;
  }>;
}) {
  const params = await searchParams;
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

  const orgId = params.org ?? organizations[0]?.id;
  const activeOrg =
    organizations.find((o) => o.id === orgId) ?? organizations[0];

  if (!activeOrg) {
    redirect("/create-organization");
  }

  const context = await orgService.getOrganizationContext(
    activeOrg.id,
    data.user.id
  );

  if (!context) {
    return (
      <div className="p-6 lg:p-8">
        <ErrorState
          title="Access denied"
          message="You do not have access to this organization."
        />
      </div>
    );
  }

  const cPage = parsePage(params.cPage);
  const sPage = parsePage(params.sPage);
  const cSearch = params.cSearch?.trim() || undefined;
  const sSearch = params.sSearch?.trim() || undefined;

  const customerPaymentService = new CustomerPaymentService(supabase);
  const supplierPaymentService = new SupplierPaymentService(supabase);

  const [customerPayments, supplierPayments] = await Promise.all([
    customerPaymentService.listCustomerPayments(activeOrg.id, {
      page: cPage,
      search: cSearch,
    }),
    supplierPaymentService.listSupplierPayments(activeOrg.id, {
      page: sPage,
      search: sSearch,
    }),
  ]);

  return (
    <div className="p-6 lg:p-8">
      <PaymentsView
        organizationId={activeOrg.id}
        customerPayments={customerPayments}
        supplierPayments={supplierPayments}
      />
    </div>
  );
}
