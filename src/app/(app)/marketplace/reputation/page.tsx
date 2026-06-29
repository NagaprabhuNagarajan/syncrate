import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { DiscoveryRepository } from "@/features/cbn/repositories/discovery.repository";
import { ReputationService } from "@/features/reputation/services/reputation.service";
import { ReputationView } from "@/features/reputation/components/ReputationView";
import { ErrorState } from "@/components/shared/error-state";

export const metadata: Metadata = {
  title: "Reputation",
  description: "Business reputation and reviews on the Connected Business Network",
};

export default async function ReputationPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ org?: string; subject?: string }>;
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

  if (!context || !context.permissions.includes("marketplace.view")) {
    return (
      <div className="p-6 lg:p-8">
        <ErrorState
          title="Access denied"
          message="You don't have permission to view marketplace reputation. Contact an administrator if you believe this is a mistake."
        />
      </div>
    );
  }

  // Subject defaults to the org's OWN received reputation.
  const subjectOrganizationId = params.subject ?? activeOrg.id;
  const isOwnOrg = subjectOrganizationId === activeOrg.id;
  const canReview = context.permissions.includes("marketplace.review");

  const reputationService = new ReputationService(supabase);

  const [summary, reviews, existingReview, subjectProfile] = await Promise.all([
    reputationService.getReputation(subjectOrganizationId),
    reputationService.listReviews(subjectOrganizationId),
    isOwnOrg
      ? Promise.resolve(null)
      : reputationService.getOwnReview(activeOrg.id, subjectOrganizationId),
    isOwnOrg
      ? Promise.resolve(null)
      : new DiscoveryRepository(supabase).getPublicProfile(
          subjectOrganizationId
        ),
  ]);

  const subjectName = isOwnOrg
    ? activeOrg.name
    : (subjectProfile?.displayName ?? subjectProfile?.name ?? "this business");

  return (
    <ReputationView
      organizationId={activeOrg.id}
      subjectOrganizationId={subjectOrganizationId}
      subjectName={subjectName}
      summary={summary}
      reviews={reviews}
      isOwnOrg={isOwnOrg}
      canReview={canReview}
      existingReview={existingReview}
    />
  );
}
