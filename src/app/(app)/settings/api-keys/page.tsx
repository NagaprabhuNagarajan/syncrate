import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { ApiKeyService } from "@/features/api-keys/services/api-key.service";
import { ErrorState } from "@/components/shared/error-state";
import { ApiKeysView } from "@/features/api-keys/components/api-keys-view";

export const metadata: Metadata = {
  title: "API keys",
  description: "Generate and manage API keys for programmatic access",
};

export default async function ApiKeysPage({
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

  if (!context || !context.permissions.includes("api_key.view")) {
    return (
      <div className="p-6 lg:p-8">
        <ErrorState
          title="Access denied"
          message="You don't have permission to view this organization's API keys. Contact an administrator if you believe this is a mistake."
        />
      </div>
    );
  }

  const apiKeyService = new ApiKeyService(supabase);
  const apiKeys = await apiKeyService.listApiKeys(activeOrg.id);
  const canManage = context.permissions.includes("api_key.manage");

  return (
    <ApiKeysView
      organizationId={activeOrg.id}
      apiKeys={apiKeys}
      canManage={canManage}
    />
  );
}
