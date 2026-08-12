import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { InvoiceService } from "@/features/sales/services/invoice.service";
import { CustomerPaymentService } from "@/features/payment/services/customer-payment.service";
import { ErrorState } from "@/components/shared/error-state";
import { InvoiceDetail } from "@/features/sales/components/invoice-detail";
import { getEntityApprovals } from "@/features/approvals/server/entity-approvals";
import { ConnectionService } from "@/features/cbn/services/connection.service";
import { CustomerRepository } from "@/features/customer/repositories/customer.repository";
import { DiscoveryRepository } from "@/features/cbn/repositories/discovery.repository";
import type { NetworkTarget } from "@/features/cbn/components/SendViaNetworkDialog";
import type { AppSupabaseClient } from "@/lib/supabase/types";

interface InvoiceDetailPageProps {
  readonly params: Promise<{ id: string }>;
  readonly searchParams: Promise<{ org?: string }>;
}

export async function generateMetadata({
  params,
}: InvoiceDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    return { title: "Invoice" };
  }
  const result = await new InvoiceService(supabase).getInvoice(id);
  return {
    title: result.success ? result.data.invoiceNumber : "Invoice",
  };
}

async function lookupCustomerName(
  supabase: AppSupabaseClient,
  id: string | null
): Promise<string | null> {
  if (!id) {return null;}
  const { data } = await supabase
    .from("customers")
    .select("name")
    .eq("id", id)
    .single();
  return data?.name ?? null;
}

async function lookupSalesOrderNumber(
  supabase: AppSupabaseClient,
  id: string | null
): Promise<string | null> {
  if (!id) {return null;}
  const { data } = await supabase
    .from("sales_orders")
    .select("so_number")
    .eq("id", id)
    .single();
  return data?.so_number ?? null;
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

export default async function InvoiceDetailPage({
  params,
  searchParams,
}: InvoiceDetailPageProps) {
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

  const service = new InvoiceService(supabase);
  const result = await service.getInvoice(id);

  if (!result.success || result.data.organizationId !== activeOrg.id) {
    return (
      <div className="p-6 lg:p-8">
        <ErrorState
          title="Invoice not found"
          message="This invoice does not exist or belongs to another organization."
        />
      </div>
    );
  }

  const invoice = result.data;

  const paymentService = new CustomerPaymentService(supabase);
  const [
    customerName,
    productNames,
    salesOrderNumber,
    payments,
    availableCredit,
    approvals,
  ] = await Promise.all([
    lookupCustomerName(supabase, invoice.customerId),
    lookupProductNames(
      supabase,
      invoice.items.map((item) => item.productId)
    ),
    lookupSalesOrderNumber(supabase, invoice.salesOrderId),
    paymentService.listPaymentsForInvoice(activeOrg.id, invoice.id),
    paymentService.getAvailableCredit(activeOrg.id, invoice.customerId),
    getEntityApprovals(supabase, activeOrg.id, "sales_invoice", invoice.id, {
      roleId: context.member.roleId,
      canDecide: context.permissions.includes("approval.decide"),
      canManage: context.permissions.includes("approval.manage"),
    }),
  ]);

  // Where this invoice goes on the network is not a choice — it is whichever
  // business the invoice's CUSTOMER is linked to. Resolve that one connection;
  // an unlinked customer simply has no network target.
  let networkTarget: NetworkTarget | null = null;
  if (context.permissions.includes("cbn.sync")) {
    const customer = await new CustomerRepository(supabase).findById(
      invoice.customerId
    );
    const connectionId = customer?.cbnConnectionId ?? null;

    if (connectionId) {
      const connection = await new ConnectionService(supabase).getConnection(
        connectionId
      );

      // Only an accepted connection carrying our `receive_invoices` grant can
      // receive. The RPC enforces the same rule, so checking here avoids
      // offering a send that is guaranteed to fail.
      if (connection.success && connection.data.status === "accepted") {
        const myGrants =
          connection.data.requesterOrganizationId === activeOrg.id
            ? connection.data.requesterGrants
            : connection.data.recipientGrants;

        if (myGrants.includes("receive_invoices")) {
          const otherOrgId =
            connection.data.requesterOrganizationId === activeOrg.id
              ? connection.data.recipientOrganizationId
              : connection.data.requesterOrganizationId;
          const profile = await new DiscoveryRepository(
            supabase
          ).getPublicProfile(otherOrgId);

          networkTarget = {
            connectionId,
            name:
              profile?.displayName ??
              profile?.name ??
              customer?.name ??
              "Connected business",
            businessId: profile?.businessId ?? null,
          };
        }
      }
    }
  }

  return (
    <InvoiceDetail
      invoice={invoice}
      customerName={customerName}
      productNames={productNames}
      salesOrderNumber={salesOrderNumber}
      payments={payments}
      availableCredit={availableCredit}
      approvals={approvals}
      networkTarget={networkTarget}
      organizationId={activeOrg.id}
      canManage={context.permissions.includes("invoice.create")}
      canCancel={context.permissions.includes("invoice.cancel")}
      canReceivePayment={context.permissions.includes("payment.receive")}
    />
  );
}
