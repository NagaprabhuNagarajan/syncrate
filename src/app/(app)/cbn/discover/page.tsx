import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, Search } from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { BusinessDiscovery } from "@/features/cbn/components/BusinessDiscovery";
import { LinkablePartyRepository } from "@/features/cbn/repositories/linkable-party.repository";
import { ErrorState } from "@/components/shared/error-state";

export const metadata: Metadata = {
  title: "Discover businesses",
  description: "Find and connect with businesses on the Connected Business Network.",
};

export default async function CbnDiscoverPage({
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

  if (!context || !context.permissions.includes("cbn.connect")) {
    return (
      <div className="p-6 lg:p-8">
        <ErrorState
          title="Access denied"
          message="You don't have permission to discover and connect with businesses."
        />
      </div>
    );
  }

  const backHref = params.org ? `/cbn?org=${params.org}` : "/cbn";

  // Every connection must be bound to a local party, so the pickers need both
  // books up front — the user chooses the relationship inside the dialog.
  const parties = new LinkablePartyRepository(supabase);
  const [customers, suppliers] = await Promise.all([
    parties.listUnlinked(activeOrg.id, "customer"),
    parties.listUnlinked(activeOrg.id, "supplier"),
  ]);

  return (
    <div className="p-4 lg:p-6">
      {/* Back to network */}
      <Link
        href={backHref}
        className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 transition-colors hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Network
      </Link>

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-brand shadow-glow-primary">
          <Search className="h-5 w-5 text-white" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Discover businesses
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Find suppliers and customers, and send a connection request
          </p>
        </div>
      </div>

      <div className="mt-5">
        <BusinessDiscovery
          organizationId={activeOrg.id}
          customers={customers}
          suppliers={suppliers}
        />
      </div>
    </div>
  );
}
