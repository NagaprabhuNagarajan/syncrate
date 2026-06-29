import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { MarketplaceService } from "@/features/marketplace/services/marketplace.service";
import { ErrorState } from "@/components/shared/error-state";
import { MarketplaceBrowseView } from "@/features/marketplace/components/marketplace-browse-view";
import type {
  ListingType,
  MarketplaceBrowseParams,
} from "@/features/marketplace/types/marketplace.types";

export const metadata: Metadata = {
  title: "Marketplace",
  description: "Discover products and suppliers across the network",
};

function parseType(value?: string): ListingType | undefined {
  return value === "product" || value === "supplier" ? value : undefined;
}

export default async function MarketplacePage({
  searchParams,
}: {
  readonly searchParams: Promise<{
    org?: string;
    q?: string;
    type?: string;
    category?: string;
    page?: string;
  }>;
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
          message="You don't have permission to browse the marketplace. Contact an administrator if you believe this is a mistake."
        />
      </div>
    );
  }

  const pageNumber = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const browseParams: MarketplaceBrowseParams = {
    query: params.q,
    listingType: parseType(params.type),
    category: params.category,
    page: pageNumber,
  };

  const service = new MarketplaceService(supabase);
  const result = await service.browseListings(browseParams, {
    withReputation: true,
  });

  return (
    <MarketplaceBrowseView
      result={result}
      filters={{
        query: params.q,
        listingType: parseType(params.type),
        category: params.category,
      }}
    />
  );
}
