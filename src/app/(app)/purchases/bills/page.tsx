import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { BillService } from "@/features/purchase/services/bill.service";
import { ErrorState } from "@/components/shared/error-state";
import { BillsView } from "@/features/purchase/components/bills-view";
import type { BillStatus } from "@/features/purchase/types/bill.types";

export const metadata: Metadata = {
  title: "Bills",
  description: "Record and post supplier bills against your business",
};

const BILL_STATUSES: readonly BillStatus[] = [
  "draft",
  "posted",
  "cancelled",
];

function parseStatus(value?: string): BillStatus | undefined {
  if (value && BILL_STATUSES.includes(value as BillStatus)) {
    return value as BillStatus;
  }
  return undefined;
}

function parsePage(value?: string): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export default async function BillsPage({
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

  const canManage = context.permissions.includes("purchase.create");

  const search = params.search?.trim() || undefined;
  const status = parseStatus(params.status);
  const page = parsePage(params.page);

  const service = new BillService(supabase);
  const [result, stats] = await Promise.all([
    service.listBills(activeOrg.id, { search, status, page }),
    service.getBillStats(activeOrg.id),
  ]);

  return (
    <BillsView
      organizationId={activeOrg.id}
      result={result}
      stats={stats}
      filters={{ search, status }}
      canManage={canManage}
    />
  );
}
