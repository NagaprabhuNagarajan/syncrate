import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@/tests/utils";
import { BrandsView } from "./brands-view";
import type {
  Brand,
  BrandListResult,
} from "@/features/brand/types/brand.types";

// ─────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────

const { mockPush, mockRefresh, searchParamsRef, archiveActionMock } =
  vi.hoisted(() => ({
    mockPush: vi.fn(),
    mockRefresh: vi.fn(),
    searchParamsRef: { current: "" },
    archiveActionMock: vi.fn(),
  }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), refresh: mockRefresh }),
  useSearchParams: () => new URLSearchParams(searchParamsRef.current),
}));

vi.mock("@/features/brand/actions/brand.actions", () => ({
  archiveBrandAction: archiveActionMock,
  createBrandAction: vi.fn(),
  updateBrandAction: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  searchParamsRef.current = "";
});

// ─────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────

function makeBrand(overrides: Partial<Brand> = {}): Brand {
  return {
    id: "brand-1",
    organizationId: "org-1",
    name: "Samsung",
    description: "Consumer electronics",
    status: "active",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    createdBy: null,
    ...overrides,
  };
}

function makeResult(overrides: Partial<BrandListResult> = {}): BrandListResult {
  return {
    items: [makeBrand()],
    total: 1,
    page: 1,
    pageSize: 20,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

describe("BrandsView", () => {
  it("renders the heading, table row and add-brand button when canManage", () => {
    render(
      <BrandsView
        organizationId="org-1"
        result={makeResult()}
        filters={{}}
        canManage
      />
    );

    expect(
      screen.getByRole("heading", { name: /brands/i })
    ).toBeInTheDocument();
    expect(screen.getByText("Samsung")).toBeInTheDocument();
    expect(screen.getByText("Active", { selector: "div" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /add brand/i })
    ).toBeInTheDocument();
  });

  it("hides the add-brand button and actions when the user cannot manage", () => {
    render(
      <BrandsView
        organizationId="org-1"
        result={makeResult()}
        filters={{}}
        canManage={false}
      />
    );
    expect(
      screen.queryByRole("button", { name: /add brand/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^edit$/i })
    ).not.toBeInTheDocument();
  });

  it("renders an empty state when there are no brands", () => {
    render(
      <BrandsView
        organizationId="org-1"
        result={makeResult({ items: [], total: 0 })}
        filters={{}}
        canManage
      />
    );
    expect(screen.getByText(/no brands found/i)).toBeInTheDocument();
  });

  it("opens the inline create form when add brand is clicked", async () => {
    const user = userEvent.setup();
    render(
      <BrandsView
        organizationId="org-1"
        result={makeResult()}
        filters={{}}
        canManage
      />
    );
    await user.click(screen.getByRole("button", { name: /add brand/i }));
    expect(
      screen.getByRole("heading", { name: /add brand/i })
    ).toBeInTheDocument();
  });

  it("opens the inline edit form when edit is clicked", async () => {
    const user = userEvent.setup();
    render(
      <BrandsView
        organizationId="org-1"
        result={makeResult()}
        filters={{}}
        canManage
      />
    );
    await user.click(screen.getByRole("button", { name: /^edit$/i }));
    expect(
      screen.getByRole("heading", { name: /edit brand/i })
    ).toBeInTheDocument();
  });

  it("archives a brand and refreshes on success", async () => {
    const user = userEvent.setup();
    archiveActionMock.mockResolvedValue({ success: true, data: undefined });
    render(
      <BrandsView
        organizationId="org-1"
        result={makeResult()}
        filters={{}}
        canManage
      />
    );
    await user.click(screen.getByRole("button", { name: /archive/i }));
    expect(archiveActionMock).toHaveBeenCalledWith("org-1", "brand-1");
    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
  });

  it("surfaces an archive error", async () => {
    const user = userEvent.setup();
    archiveActionMock.mockResolvedValue({
      success: false,
      error: { code: "forbidden", message: "Not allowed" },
    });
    render(
      <BrandsView
        organizationId="org-1"
        result={makeResult()}
        filters={{}}
        canManage
      />
    );
    await user.click(screen.getByRole("button", { name: /archive/i }));
    expect(await screen.findByText("Not allowed")).toBeInTheDocument();
  });

  it("updates the URL when a search is submitted", async () => {
    const user = userEvent.setup();
    render(
      <BrandsView
        organizationId="org-1"
        result={makeResult()}
        filters={{}}
        canManage
      />
    );
    await user.type(screen.getByLabelText(/search brands/i), "sam{Enter}");
    expect(mockPush).toHaveBeenCalledWith("/products/brands?search=sam");
  });

  it("updates the URL when the status filter changes", async () => {
    const user = userEvent.setup();
    render(
      <BrandsView
        organizationId="org-1"
        result={makeResult()}
        filters={{}}
        canManage
      />
    );
    await user.selectOptions(
      screen.getByLabelText(/filter by status/i),
      "archived"
    );
    expect(mockPush).toHaveBeenCalledWith("/products/brands?status=archived");
  });

  it("paginates to the next page", async () => {
    const user = userEvent.setup();
    render(
      <BrandsView
        organizationId="org-1"
        result={makeResult({
          items: [makeBrand(), makeBrand({ id: "brand-2" })],
          total: 45,
          page: 1,
          pageSize: 20,
        })}
        filters={{}}
        canManage
      />
    );
    expect(screen.getByRole("button", { name: /previous/i })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /next/i }));
    expect(mockPush).toHaveBeenCalledWith("/products/brands?page=2");
  });

  it("renders an em dash for a missing description", () => {
    render(
      <BrandsView
        organizationId="org-1"
        result={makeResult({ items: [makeBrand({ description: null })] })}
        filters={{}}
        canManage
      />
    );
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("preserves the active org param in navigation", async () => {
    searchParamsRef.current = "org=org-9";
    const user = userEvent.setup();
    render(
      <BrandsView
        organizationId="org-1"
        result={makeResult()}
        filters={{}}
        canManage
      />
    );
    await user.type(screen.getByLabelText(/search brands/i), "sam{Enter}");
    expect(mockPush).toHaveBeenCalledWith(
      "/products/brands?org=org-9&search=sam"
    );
  });
});
