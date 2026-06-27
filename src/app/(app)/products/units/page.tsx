import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { UnitService } from "@/features/unit/services/unit.service";
import { ErrorState } from "@/components/shared/error-state";
import { UnitsView } from "@/features/unit/components/units-view";
import type { UnitStatus } from "@/features/unit/types/unit.types";

export const metadata: Metadata = {
  title: "Units",
  description: "Manage the units of measure for your product catalog",
};

const UNIT_STATUSES: readonly UnitStatus[] = ["active", "archived"];

function parseStatus(value?: string): UnitStatus | undefined {
  if (value && UNIT_STATUSES.includes(value as UnitStatus)) {
    return value as UnitStatus;
  }
  return undefined;
}

function parsePage(value?: string): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export default async function UnitsPage({
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

  if (!context || !context.permissions.includes("product.view")) {
    return (
      <div className="p-6 lg:p-8">
        <ErrorState
          title="Access denied"
          message="You do not have permission to view units for this organization."
        />
      </div>
    );
  }

  const canManage =
    context.permissions.includes("product.create") ||
    context.permissions.includes("product.update");

  const search = params.search?.trim() || undefined;
  const status = parseStatus(params.status);
  const page = parsePage(params.page);

  const unitService = new UnitService(supabase);
  const result = await unitService.listUnits(activeOrg.id, {
    search,
    status,
    page,
  });

  return (
    <UnitsView
      organizationId={activeOrg.id}
      result={result}
      filters={{ search, status }}
      canManage={canManage}
    />
  );
}
