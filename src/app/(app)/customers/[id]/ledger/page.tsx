import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { CustomerService } from "@/features/customer/services/customer.service";
import { CustomerLedgerView } from "@/features/customer/components/customer-ledger-view";
import { ErrorState } from "@/components/shared/error-state";

interface Props {
  readonly params: Promise<{ id: string }>;
  readonly searchParams: Promise<{ org?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    return { title: "Customer Ledger" };
  }
  const result = await new CustomerService(supabase).getCustomer(id);
  return {
    title: result.success ? `Ledger — ${result.data.name}` : "Customer Ledger",
  };
}

export default async function CustomerLedgerPage({ params, searchParams }: Props) {
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

  if (!context || !context.permissions.includes("customer.view")) {
    return (
      <div className="p-6 lg:p-8">
        <ErrorState
          title="Access denied"
          message="You do not have permission to view customer ledgers."
        />
      </div>
    );
  }

  const customerService = new CustomerService(supabase);
  const result = await customerService.getCustomer(id);

  if (!result.success || result.data.organizationId !== activeOrg.id) {
    return (
      <div className="p-6 lg:p-8">
        <ErrorState
          title="Customer not found"
          message="This customer does not exist or belongs to another organization."
        />
      </div>
    );
  }

  const ledger = await customerService.getCustomerLedger(result.data);

  return <CustomerLedgerView customer={result.data} ledger={ledger} />;
}
