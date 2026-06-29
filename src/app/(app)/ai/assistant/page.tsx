import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { ErrorState } from "@/components/shared/error-state";
import { AssistantView } from "@/features/ai/assistant/components/assistant-view";

export const metadata: Metadata = {
  title: "AI Assistant",
  description:
    "Ask about your business or prepare invoices and quotations with AI — you approve every action.",
};

export default async function AiAssistantPage({
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

  if (!context || !context.permissions.includes("ai.view")) {
    return (
      <div className="p-6 lg:p-8">
        <ErrorState
          title="Access denied"
          message="You do not have permission to use the AI assistant for this organization."
        />
      </div>
    );
  }

  return <AssistantView organizationId={activeOrg.id} />;
}
