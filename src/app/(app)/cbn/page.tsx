import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Network, Search } from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { ConnectionService } from "@/features/cbn/services/connection.service";
import { DiscoveryRepository } from "@/features/cbn/repositories/discovery.repository";
import { ConnectionList } from "@/features/cbn/components/ConnectionList";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/shared/error-state";

export const metadata: Metadata = {
  title: "Network",
  description: "Your Connected Business Network — suppliers and customers.",
};

interface OrgName {
  readonly name: string;
  readonly businessId?: string | null;
}

export default async function CbnNetworkPage({
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

  if (!context || !context.permissions.includes("cbn.view")) {
    return (
      <div className="p-6 lg:p-8">
        <ErrorState
          title="Access denied"
          message="You don't have permission to view the Connected Business Network."
        />
      </div>
    );
  }

  const withOrg = (path: string): string =>
    params.org ? `${path}?org=${params.org}` : path;

  const connections = await new ConnectionService(supabase).listConnections(
    activeOrg.id
  );

  // Resolve the counterparty (the "other" org) name for each connection via the
  // public-profile RPC — the organizations table itself is member-only.
  const counterpartyIds = [
    ...new Set(
      connections.map((connection) =>
        connection.requesterOrganizationId === activeOrg.id
          ? connection.recipientOrganizationId
          : connection.requesterOrganizationId
      )
    ),
  ];
  const discovery = new DiscoveryRepository(supabase);
  const profiles = await Promise.all(
    counterpartyIds.map((id) => discovery.getPublicProfile(id))
  );
  const orgNames: Record<string, OrgName> = {};
  counterpartyIds.forEach((id, index) => {
    const profile = profiles[index];
    orgNames[id] = {
      name: profile?.displayName ?? profile?.name ?? "Unknown business",
      businessId: profile?.businessId ?? null,
    };
  });

  return (
    <div className="p-4 lg:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-brand shadow-glow-primary">
            <Network className="h-5 w-5 text-white" aria-hidden="true" />
          </div>
          <div>
            <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              Network
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                {connections.length}
              </span>
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Your connected suppliers and customers on the Business Network
            </p>
          </div>
        </div>

        {context.permissions.includes("cbn.connect") && (
          <Button asChild type="button" variant="gradient">
            <Link href={withOrg("/cbn/discover")}>
              <Search className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Discover businesses
            </Link>
          </Button>
        )}
      </div>

      <div className="mt-5">
        <ConnectionList
          connections={connections}
          myOrgId={activeOrg.id}
          orgNames={orgNames}
        />
      </div>
    </div>
  );
}
