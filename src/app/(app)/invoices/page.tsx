import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { InvoiceService } from "@/features/sales/services/invoice.service";
import { ErrorState } from "@/components/shared/error-state";
import { InvoicesView } from "@/features/sales/components/invoices-view";
import type {
  InvoiceStatus,
  PaymentStatus,
} from "@/features/sales/types/invoice.types";

export const metadata: Metadata = {
  title: "Invoices",
  description: "Create, send and track your customer invoices",
};

const INV_STATUSES: readonly InvoiceStatus[] = ["draft", "posted", "cancelled"];
const PAYMENT_STATUSES: readonly PaymentStatus[] = [
  "unpaid",
  "partial",
  "paid",
  "overdue",
];

function parseStatus(value?: string): InvoiceStatus | undefined {
  if (value && INV_STATUSES.includes(value as InvoiceStatus)) {
    return value as InvoiceStatus;
  }
  return undefined;
}

function parsePaymentStatus(value?: string): PaymentStatus | undefined {
  if (value && PAYMENT_STATUSES.includes(value as PaymentStatus)) {
    return value as PaymentStatus;
  }
  return undefined;
}

function parsePage(value?: string): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export default async function SalesInvoicesPage({
  searchParams,
}: {
  readonly searchParams: Promise<{
    org?: string;
    search?: string;
    status?: string;
    paymentStatus?: string;
    page?: string;
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

  if (!context || !context.permissions.includes("invoice.view")) {
    return (
      <div className="p-6 lg:p-8">
        <ErrorState
          title="Access denied"
          message="You do not have permission to view invoices for this organization."
        />
      </div>
    );
  }

  const canManage = context.permissions.includes("invoice.create");
  const canReceivePayment = context.permissions.includes("payment.receive");

  const search = params.search?.trim() || undefined;
  const status = parseStatus(params.status);
  const paymentStatus = parsePaymentStatus(params.paymentStatus);
  const page = parsePage(params.page);

  const service = new InvoiceService(supabase);
  const [result, stats] = await Promise.all([
    service.listInvoices(activeOrg.id, { search, status, paymentStatus, page }),
    service.getInvoiceStats(activeOrg.id),
  ]);

  return (
    <InvoicesView
      organizationId={activeOrg.id}
      result={result}
      stats={stats}
      filters={{ search, status, paymentStatus }}
      canManage={canManage}
      canReceivePayment={canReceivePayment}
    />
  );
}
