import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { SupplierService } from "@/features/supplier/services/supplier.service";
import { ErrorState } from "@/components/shared/error-state";
import { SuppliersView } from "@/features/supplier/components/suppliers-view";
import type { SupplierStatus } from "@/features/supplier/types/supplier.types";

export const metadata: Metadata = {
  title: "Suppliers",
  description: "Manage your suppliers and procurement contacts",
};

const SUPPLIER_STATUSES: readonly SupplierStatus[] = [
  "active",
  "inactive",
  "archived",
];

function parseStatus(value?: string): SupplierStatus | undefined {
  if (value && SUPPLIER_STATUSES.includes(value as SupplierStatus)) {
    return value as SupplierStatus;
  }
  return undefined;
}

function parsePage(value?: string): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export default async function SuppliersPage({
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

  if (!context || !context.permissions.includes("supplier.view")) {
    return (
      <div className="p-6 lg:p-8">
        <ErrorState
          title="Access denied"
          message="You do not have permission to view suppliers for this organization."
        />
      </div>
    );
  }

  const canManage =
    context.permissions.includes("supplier.create") ||
    context.permissions.includes("supplier.update");

  const search = params.search?.trim() || undefined;
  const status = parseStatus(params.status);
  const page = parsePage(params.page);

  const supplierService = new SupplierService(supabase);
  const [result, stats] = await Promise.all([
    supplierService.listSuppliers(activeOrg.id, { search, status, page }),
    supplierService.getSupplierStats(activeOrg.id),
  ]);

  return (
    <SuppliersView
      organizationId={activeOrg.id}
      result={result}
      stats={stats}
      filters={{ search, status }}
      canManage={canManage}
    />
  );
}
