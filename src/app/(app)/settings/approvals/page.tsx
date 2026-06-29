import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { ApprovalService } from "@/features/approvals/services/approval.service";
import { ErrorState } from "@/components/shared/error-state";
import { ApprovalsView } from "@/features/approvals/components/approvals-view";
import type { RoleOption } from "@/features/approvals/components/rule-form";

export const metadata: Metadata = {
  title: "Approvals",
  description: "Configure approval rules and decide pending requests",
};

export default async function ApprovalsPage({
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

  if (!context || !context.permissions.includes("approval.view")) {
    return (
      <div className="p-6 lg:p-8">
        <ErrorState
          title="Access denied"
          message="You don't have permission to view approvals for this organization. Contact an administrator if you believe this is a mistake."
        />
      </div>
    );
  }

  const approvalService = new ApprovalService(supabase);
  const [rules, pendingRequests, roles] = await Promise.all([
    approvalService.listRules(activeOrg.id),
    approvalService.listPendingRequests(activeOrg.id),
    orgService.listRoles(activeOrg.id),
  ]);

  const roleOptions: RoleOption[] = roles.map((role) => ({
    id: role.id,
    name: role.name,
  }));

  return (
    <ApprovalsView
      organizationId={activeOrg.id}
      rules={rules}
      pendingRequests={pendingRequests}
      roles={roleOptions}
      canManage={context.permissions.includes("approval.manage")}
      canDecide={context.permissions.includes("approval.decide")}
    />
  );
}
