import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { CustomerService } from "@/features/customer/services/customer.service";
import { ErrorState } from "@/components/shared/error-state";
import { CustomersView } from "@/features/customer/components/customers-view";
import type { CustomerStatus } from "@/features/customer/types/customer.types";

export const metadata: Metadata = {
  title: "Customers",
  description: "Manage your customers and their commercial details",
};

const CUSTOMER_STATUSES: readonly CustomerStatus[] = [
  "active",
  "inactive",
  "blacklisted",
  "archived",
];

function parseStatus(value?: string): CustomerStatus | undefined {
  if (value && CUSTOMER_STATUSES.includes(value as CustomerStatus)) {
    return value as CustomerStatus;
  }
  return undefined;
}

function parsePage(value?: string): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export default async function CustomersPage({
  searchParams,
}: {
  readonly searchParams: Promise<{
    org?: string;
    search?: string;
    status?: string;
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

  if (!context || !context.permissions.includes("customer.view")) {
    return (
      <div className="p-6 lg:p-8">
        <ErrorState
          title="Access denied"
          message="You do not have permission to view customers for this organization."
        />
      </div>
    );
  }

  const canManage =
    context.permissions.includes("customer.create") ||
    context.permissions.includes("customer.update");

  const search = params.search?.trim() || undefined;
  const status = parseStatus(params.status);
  const page = parsePage(params.page);

  const customerService = new CustomerService(supabase);
  const [result, stats] = await Promise.all([
    customerService.listCustomers(activeOrg.id, { search, status, page }),
    customerService.getCustomerStats(activeOrg.id),
  ]);

  return (
    <CustomersView
      organizationId={activeOrg.id}
      result={result}
      stats={stats}
      filters={{ search, status }}
      canManage={canManage}
    />
  );
}
