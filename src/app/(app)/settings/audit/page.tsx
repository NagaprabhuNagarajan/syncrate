import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { AuditCenterService } from "@/features/audit-center/services/audit-center.service";
import { ErrorState } from "@/components/shared/error-state";
import { AuditCenterView } from "@/features/audit-center/components/audit-center-view";

export const metadata: Metadata = {
  title: "Audit Center",
  description: "Browse, filter and export your organization's audit trails",
};

const DEFAULT_PAGE_SIZE = 25;

export default async function AuditCenterPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ org?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    redirect("/login");
  }

  const service = new OrganizationService(supabase);
  const organizations = await service.listUserOrganizations(data.user.id);

  if (organizations.length === 0) {
    redirect("/create-organization");
  }

  const orgId = params.org ?? organizations[0]?.id;
  const activeOrg =
    organizations.find((o) => o.id === orgId) ?? organizations[0];

  if (!activeOrg) {
    redirect("/create-organization");
  }

  const context = await service.getOrganizationContext(
    activeOrg.id,
    data.user.id
  );

  if (!context || !context.permissions.includes("audit.view")) {
    return (
      <div className="p-6 lg:p-8">
        <ErrorState
          title="Access denied"
          message="You don't have permission to view this organization's audit trails. Contact an administrator if you believe this is a mistake."
        />
      </div>
    );
  }

  const auditCenter = new AuditCenterService(supabase);
  const initialData = await auditCenter.list(activeOrg.id, {
    source: "all",
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });

  return (
    <AuditCenterView organizationId={activeOrg.id} initialData={initialData} />
  );
}
