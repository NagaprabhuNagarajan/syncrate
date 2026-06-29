import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { ErrorState } from "@/components/shared/error-state";
import { WorkflowsView } from "@/features/workflows/components/workflows-view";
import { WorkflowService } from "@/features/workflows/services/workflow.service";

export const metadata: Metadata = {
  title: "Workflows",
  description: "Automate multi-step actions triggered by business events",
};

export default async function WorkflowsPage({
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

  if (!context || !context.permissions.includes("workflow.view")) {
    return (
      <div className="p-6 lg:p-8">
        <ErrorState
          title="Access denied"
          message="You don't have permission to view this organization's workflows. Contact an administrator if you believe this is a mistake."
        />
      </div>
    );
  }

  const workflowService = new WorkflowService(supabase);
  const [workflows, runs] = await Promise.all([
    workflowService.listWorkflows(activeOrg.id),
    workflowService.listRuns(activeOrg.id),
  ]);

  return (
    <WorkflowsView
      organizationId={activeOrg.id}
      workflows={workflows}
      runs={runs}
      canManage={context.permissions.includes("workflow.manage")}
    />
  );
}
