import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@/tests/utils";
import { MarketplaceBrowseView } from "./marketplace-browse-view";
import type {
  MarketplaceBrowseListing,
  MarketplaceBrowseResult,
} from "@/features/marketplace/types/marketplace.types";

const { mockPush, searchParamsRef } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  searchParamsRef: { current: "" },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(searchParamsRef.current),
}));

beforeEach(() => {
  vi.clearAllMocks();
  searchParamsRef.current = "";
});

function makeBrowse(
  overrides: Partial<MarketplaceBrowseListing> = {}
): MarketplaceBrowseListing {
  return {
    id: "b-1",
    organizationId: "seller-1",
    sellerName: "Acme Traders",
    listingType: "product",
    productId: null,
    title: "Industrial Bolts",
    description: "Bulk industrial bolts",
    category: "Hardware",
    price: 250,
    currency: "INR",
    unit: "box",
    minOrderQty: 10,
    createdAt: new Date("2026-02-01"),
    reputation: {
      reviewCount: 8,
      averageRating: 4.6,
      recommendedCount: 7,
      recommendPercent: 88,
    },
    ...overrides,
  };
}

function makeResult(
  overrides: Partial<MarketplaceBrowseResult> = {}
): MarketplaceBrowseResult {
  return {
    items: [makeBrowse()],
    page: 1,
    pageSize: 24,
    hasMore: false,
    ...overrides,
  };
}

describe("MarketplaceBrowseView", () => {
  it("renders listing cards with title, seller, price and rating", () => {
    render(<MarketplaceBrowseView result={makeResult()} filters={{}} />);

    expect(
      screen.getByRole("heading", { name: /marketplace/i })
    ).toBeInTheDocument();
    expect(screen.getByText("Industrial Bolts")).toBeInTheDocument();
    expect(screen.getByText("Acme Traders")).toBeInTheDocument();
    expect(screen.getByText("4.6")).toBeInTheDocument();
  });

  it("shows quote-on-request for listings without a price", () => {
    render(
      <MarketplaceBrowseView
        result={makeResult({ items: [makeBrowse({ price: null })] })}
        filters={{}}
      />
    );
    expect(screen.getByText(/quote on request/i)).toBeInTheDocument();
  });

  it("renders an empty state when there are no listings", () => {
    render(
      <MarketplaceBrowseView
        result={makeResult({ items: [] })}
        filters={{}}
      />
    );
    expect(screen.getByText(/no listings found/i)).toBeInTheDocument();
  });

  it("updates the URL when a search is submitted", async () => {
    const user = userEvent.setup();
    render(<MarketplaceBrowseView result={makeResult()} filters={{}} />);
    await user.type(screen.getByLabelText(/search marketplace/i), "bolts{Enter}");
    expect(mockPush).toHaveBeenCalledWith("/marketplace?q=bolts");
  });

  it("updates the URL when the type filter changes", async () => {
    const user = userEvent.setup();
    render(<MarketplaceBrowseView result={makeResult()} filters={{}} />);
    await user.selectOptions(
      screen.getByLabelText(/filter by type/i),
      "supplier"
    );
    expect(mockPush).toHaveBeenCalledWith("/marketplace?type=supplier");
  });

  it("disables the next button when there are no more pages", () => {
    render(
      <MarketplaceBrowseView
        result={makeResult({ hasMore: false })}
        filters={{}}
      />
    );
    expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();
  });

  it("paginates forward when more pages exist", async () => {
    const user = userEvent.setup();
    render(
      <MarketplaceBrowseView
        result={makeResult({ hasMore: true, page: 1 })}
        filters={{}}
      />
    );
    await user.click(screen.getByRole("button", { name: /next/i }));
    expect(mockPush).toHaveBeenCalledWith("/marketplace?page=2");
  });
});
