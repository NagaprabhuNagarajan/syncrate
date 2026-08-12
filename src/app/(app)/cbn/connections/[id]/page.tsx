import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { ConnectionService } from "@/features/cbn/services/connection.service";
import { DiscoveryRepository } from "@/features/cbn/repositories/discovery.repository";
import { SharedDocumentRepository } from "@/features/cbn/repositories/shared-document.repository";
import { CbnEventsRepository } from "@/features/cbn/repositories/cbn-events.repository";
import { LinkablePartyRepository } from "@/features/cbn/repositories/linkable-party.repository";
import { ConnectionDetail } from "@/features/cbn/components/ConnectionDetail";
import { ErrorState } from "@/components/shared/error-state";

export const metadata: Metadata = {
  title: "Connection",
  description: "A Connected Business Network relationship.",
};

export default async function CbnConnectionDetailPage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ id: string }>;
  readonly searchParams: Promise<{ org?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
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

  const orgId = query.org ?? organizations[0]?.id;
  const activeOrg =
    organizations.find((o) => o.id === orgId) ?? organizations[0];

  if (!activeOrg) {
    redirect("/create-organization");
  }

  const context = await orgService.getOrganizationContext(
    activeOrg.id,
    data.user.id
  );

  const backHref = query.org ? `/cbn?org=${query.org}` : "/cbn";

  if (!context || !context.permissions.includes("cbn.view")) {
    return (
      <div className="p-6 lg:p-8">
        <ErrorState
          title="Access denied"
          message="You don't have permission to view this connection."
        />
      </div>
    );
  }

  const connectionResult = await new ConnectionService(supabase).getConnection(
    id
  );

  // Not found, or the connection doesn't involve the active org.
  const isParticipant =
    connectionResult.success &&
    (connectionResult.data.requesterOrganizationId === activeOrg.id ||
      connectionResult.data.recipientOrganizationId === activeOrg.id);

  if (!connectionResult.success || !isParticipant) {
    return (
      <div className="p-6 lg:p-8">
        <Link
          href={backHref}
          className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 transition-colors hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Network
        </Link>
        <ErrorState
          title="Connection not found"
          message="This connection does not exist or your organization isn't part of it."
        />
      </div>
    );
  }

  const connection = connectionResult.data;
  const otherOrgId =
    connection.requesterOrganizationId === activeOrg.id
      ? connection.recipientOrganizationId
      : connection.requesterOrganizationId;

  // Both books are loaded: accepting needs the inverse of the requester's
  // declared role, and reconnecting lets the role be re-chosen.
  const parties = new LinkablePartyRepository(supabase);
  const [otherProfile, sharedDocuments, events, customers, suppliers] =
    await Promise.all([
      new DiscoveryRepository(supabase).getPublicProfile(otherOrgId),
      new SharedDocumentRepository(supabase).findByConnection(id),
      new CbnEventsRepository(supabase).listByConnection(id),
      parties.listUnlinked(activeOrg.id, "customer"),
      parties.listUnlinked(activeOrg.id, "supplier"),
    ]);

  return (
    <div className="p-4 lg:p-6">
      <Link
        href={backHref}
        className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 transition-colors hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Network
      </Link>

      <ConnectionDetail
        connection={connection}
        myOrgId={activeOrg.id}
        otherOrg={{
          name:
            otherProfile?.displayName ??
            otherProfile?.name ??
            "Unknown business",
          businessId: otherProfile?.businessId ?? null,
          verificationLevel: otherProfile?.verificationLevel,
          trustScore: otherProfile?.trustScore,
        }}
        customers={customers}
        suppliers={suppliers}
        sharedDocuments={sharedDocuments}
        events={events}
      />
    </div>
  );
}
