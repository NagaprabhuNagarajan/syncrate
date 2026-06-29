import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@/tests/utils";
import { MyListingsView } from "./my-listings-view";
import type {
  MarketplaceListing,
  MarketplaceListingListResult,
} from "@/features/marketplace/types/marketplace.types";

const { mockPush, mockRefresh, searchParamsRef, publishMock, archiveMock } =
  vi.hoisted(() => ({
    mockPush: vi.fn(),
    mockRefresh: vi.fn(),
    searchParamsRef: { current: "" },
    publishMock: vi.fn(),
    archiveMock: vi.fn(),
  }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), refresh: mockRefresh }),
  useSearchParams: () => new URLSearchParams(searchParamsRef.current),
}));

vi.mock("@/features/marketplace/actions/marketplace.actions", () => ({
  setListingPublishedAction: publishMock,
  setListingStatusAction: vi.fn(),
  archiveListingAction: archiveMock,
  createListingAction: vi.fn(),
  updateListingAction: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  searchParamsRef.current = "";
});

function makeListing(
  overrides: Partial<MarketplaceListing> = {}
): MarketplaceListing {
  return {
    id: "list-1",
    organizationId: "org-1",
    listingType: "product",
    productId: null,
    title: "Premium Widgets",
    description: "Best widgets",
    category: "Hardware",
    price: 1500,
    currency: "INR",
    unit: "box",
    minOrderQty: 5,
    isPublished: false,
    status: "active",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    createdBy: null,
    version: 1,
    ...overrides,
  };
}

function makeResult(
  overrides: Partial<MarketplaceListingListResult> = {}
): MarketplaceListingListResult {
  return {
    items: [makeListing()],
    total: 1,
    page: 1,
    pageSize: 20,
    ...overrides,
  };
}

describe("MyListingsView", () => {
  it("renders the heading, the listing row and the add-listing button when canManage", () => {
    render(
      <MyListingsView
        organizationId="org-1"
        result={makeResult()}
        filters={{}}
        canManage
      />
    );

    expect(
      screen.getByRole("heading", { name: /my listings/i })
    ).toBeInTheDocument();
    expect(screen.getByText("Premium Widgets")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /add listing/i })
    ).toBeInTheDocument();
  });

  it("hides management controls when the user cannot manage", () => {
    render(
      <MyListingsView
        organizationId="org-1"
        result={makeResult()}
        filters={{}}
        canManage={false}
      />
    );
    expect(
      screen.queryByRole("button", { name: /add listing/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /edit premium widgets/i })
    ).not.toBeInTheDocument();
  });

  it("renders an empty state when there are no listings", () => {
    render(
      <MyListingsView
        organizationId="org-1"
        result={makeResult({ items: [], total: 0 })}
        filters={{}}
        canManage
      />
    );
    expect(screen.getByText(/no listings yet/i)).toBeInTheDocument();
  });

  it("opens the create form when add listing is clicked", async () => {
    const user = userEvent.setup();
    render(
      <MyListingsView
        organizationId="org-1"
        result={makeResult()}
        filters={{}}
        canManage
      />
    );
    await user.click(screen.getByRole("button", { name: /add listing/i }));
    expect(
      screen.getByRole("form", { name: /create listing/i })
    ).toBeInTheDocument();
  });

  it("shows quote-on-request for listings without a price", () => {
    render(
      <MyListingsView
        organizationId="org-1"
        result={makeResult({ items: [makeListing({ price: null })] })}
        filters={{}}
        canManage
      />
    );
    expect(screen.getByText(/on request/i)).toBeInTheDocument();
  });

  it("invokes the publish action and refreshes", async () => {
    publishMock.mockResolvedValue({ success: true, data: makeListing() });
    const user = userEvent.setup();
    render(
      <MyListingsView
        organizationId="org-1"
        result={makeResult()}
        filters={{}}
        canManage
      />
    );
    await user.click(
      screen.getByRole("button", { name: /publish premium widgets/i })
    );
    expect(publishMock).toHaveBeenCalledWith("org-1", "list-1", true);
  });

  it("updates the URL when the status filter changes", async () => {
    const user = userEvent.setup();
    render(
      <MyListingsView
        organizationId="org-1"
        result={makeResult()}
        filters={{}}
        canManage
      />
    );
    await user.selectOptions(
      screen.getByLabelText(/filter by status/i),
      "paused"
    );
    expect(mockPush).toHaveBeenCalledWith(
      "/marketplace/my-listings?status=paused"
    );
  });
});
