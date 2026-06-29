import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { WebhookService } from "@/features/webhooks/services/webhook.service";
import { ErrorState } from "@/components/shared/error-state";
import { WebhooksView } from "@/features/webhooks/components/webhooks-view";
import type { WebhookDelivery } from "@/features/webhooks/types/webhook.types";

export const metadata: Metadata = {
  title: "Webhooks",
  description: "Register endpoints to receive signed event notifications",
};

export default async function WebhooksPage({
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

  if (!context || !context.permissions.includes("webhook.view")) {
    return (
      <div className="p-6 lg:p-8">
        <ErrorState
          title="Access denied"
          message="You don't have permission to view this organization's webhooks. Contact an administrator if you believe this is a mistake."
        />
      </div>
    );
  }

  const webhookService = new WebhookService(supabase);
  const endpoints = await webhookService.listEndpoints(activeOrg.id);

  const deliveryLists = await Promise.all(
    endpoints.map((endpoint) =>
      webhookService.listDeliveries(endpoint.id, activeOrg.id, 10)
    )
  );
  const deliveriesByEndpoint: Record<string, readonly WebhookDelivery[]> = {};
  endpoints.forEach((endpoint, index) => {
    deliveriesByEndpoint[endpoint.id] = deliveryLists[index] ?? [];
  });

  const canManage = context.permissions.includes("webhook.manage");

  return (
    <WebhooksView
      organizationId={activeOrg.id}
      endpoints={endpoints}
      deliveriesByEndpoint={deliveriesByEndpoint}
      canManage={canManage}
    />
  );
}
