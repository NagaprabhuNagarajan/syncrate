import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { MarketplaceService } from "@/features/marketplace/services/marketplace.service";
import { ErrorState } from "@/components/shared/error-state";
import { MyListingsView } from "@/features/marketplace/components/my-listings-view";
import type {
  ListingStatus,
  ListingType,
} from "@/features/marketplace/types/marketplace.types";

export const metadata: Metadata = {
  title: "My listings",
  description: "Manage your marketplace listings",
};

function parseStatus(value?: string): ListingStatus | undefined {
  return value === "active" || value === "paused" || value === "archived"
    ? value
    : undefined;
}

function parseType(value?: string): ListingType | undefined {
  return value === "product" || value === "supplier" ? value : undefined;
}

export default async function MyListingsPage({
  searchParams,
}: {
  readonly searchParams: Promise<{
    org?: string;
    search?: string;
    status?: string;
    type?: string;
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
          message="You don't have permission to manage marketplace listings. Contact an administrator if you believe this is a mistake."
        />
      </div>
    );
  }

  const canManage = context.permissions.includes("marketplace.manage");
  const pageNumber = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const status = parseStatus(params.status);
  const listingType = parseType(params.type);

  const service = new MarketplaceService(supabase);
  const result = await service.listOwnListings(activeOrg.id, {
    search: params.search,
    status,
    listingType,
    page: pageNumber,
  });

  return (
    <MyListingsView
      organizationId={activeOrg.id}
      result={result}
      filters={{ search: params.search, status, listingType }}
      canManage={canManage}
    />
  );
}
