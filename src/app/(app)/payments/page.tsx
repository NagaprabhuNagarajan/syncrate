import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { CustomerPaymentService } from "@/features/payment/services/customer-payment.service";
import { SupplierPaymentService } from "@/features/payment/services/supplier-payment.service";
import { CustomerService } from "@/features/customer/services/customer.service";
import { SupplierService } from "@/features/supplier/services/supplier.service";
import { ErrorState } from "@/components/shared/error-state";
import { PaymentsView } from "@/features/payment/components/payments-view";
import type { PaymentStatus } from "@/features/payment/types/payment.types";

export const metadata: Metadata = {
  title: "Payments",
  description: "Manage customer receipts and supplier disbursements",
};

const PAYMENT_STATUSES: readonly PaymentStatus[] = ["completed", "voided"];

function parsePage(value?: string): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function parseStatus(value?: string): PaymentStatus | undefined {
  if (value && PAYMENT_STATUSES.includes(value as PaymentStatus)) {
    return value as PaymentStatus;
  }
  return undefined;
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
    cStatus?: string;
    sStatus?: string;
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
  const cStatus = parseStatus(params.cStatus);
  const sStatus = parseStatus(params.sStatus);

  const customerPaymentService = new CustomerPaymentService(supabase);
  const supplierPaymentService = new SupplierPaymentService(supabase);
  const customerService = new CustomerService(supabase);
  const supplierService = new SupplierService(supabase);

  const [
    customerPayments,
    supplierPayments,
    customerStats,
    supplierStats,
    customerList,
    supplierList,
  ] = await Promise.all([
    customerPaymentService.listCustomerPayments(activeOrg.id, {
      page: cPage,
      search: cSearch,
      status: cStatus,
    }),
    supplierPaymentService.listSupplierPayments(activeOrg.id, {
      page: sPage,
      search: sSearch,
      status: sStatus,
    }),
    customerPaymentService.getStats(activeOrg.id),
    supplierPaymentService.getStats(activeOrg.id),
    customerService.listCustomers(activeOrg.id, { pageSize: 100, status: "active" }),
    supplierService.listSuppliers(activeOrg.id, { pageSize: 100, status: "active" }),
  ]);

  const customers = customerList.items.map((c) => ({ id: c.id, name: c.name }));
  const suppliers = supplierList.items.map((s) => ({ id: s.id, name: s.name }));

  return (
    <div className="p-6 lg:p-8">
      <PaymentsView
        organizationId={activeOrg.id}
        customerPayments={customerPayments}
        supplierPayments={supplierPayments}
        customerStats={customerStats}
        supplierStats={supplierStats}
        customers={customers}
        suppliers={suppliers}
        customerFilters={{ search: cSearch, status: cStatus }}
        supplierFilters={{ search: sSearch, status: sStatus }}
      />
    </div>
  );
}
