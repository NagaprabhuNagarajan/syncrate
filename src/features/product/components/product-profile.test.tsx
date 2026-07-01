import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@/tests/utils";
import { ProductProfile } from "./product-profile";
import type { Product } from "@/features/product/types/product.types";

// ─────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────

const { mockArchive, mockPush, searchParamsRef } = vi.hoisted(() => ({
  mockArchive: vi.fn(),
  mockPush: vi.fn(),
  searchParamsRef: { current: "" },
}));

vi.mock("@/features/product/actions/product.actions", () => ({
  archiveProductAction: mockArchive,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(searchParamsRef.current),
}));

beforeEach(() => {
  vi.clearAllMocks();
  searchParamsRef.current = "";
});

// ─────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "prod-1",
    organizationId: "org-1",
    code: "PROD-001",
    name: "Premium Widget",
    description: "A high quality widget",
    type: "inventory",
    status: "active",
    categoryId: "cat-1",
    brandId: "brand-1",
    unitId: "unit-1",
    manufacturer: "Acme Corp",
    hsnCode: "3402",
    gstRate: 18,
    gstRates: [18],
    taxInclusive: false,
    purchasePrice: 100,
    sellingPrice: 199.5,
    dealerPrice: 150,
    wholesalePrice: 160,
    retailPrice: 250,
    minSellingPrice: 120,
    sku: "SKU-001",
    barcode: "8901234567890",
    qrCode: null,
    trackInventory: true,
    reorderLevel: 10,
    maxStock: 500,
    openingStock: 50,
    preferredSupplierId: null,
    isSeasonal: false,
    isFastMoving: false,
    isSlowMoving: false,
    aiTags: [],
    tags: ["featured"],
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    createdBy: null,
    ...overrides,
  };
}

const OPTIONS = {
  categories: [{ id: "cat-1", name: "Hardware" }],
  brands: [{ id: "brand-1", name: "Acme" }],
  units: [{ id: "unit-1", name: "Piece" }],
  suppliers: [{ id: "sup-1", name: "Supplier One" }],
};

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

describe("ProductProfile", () => {
  it("renders the sticky header, KPI strip and pricing/tax details", () => {
    render(
      <ProductProfile
        product={makeProduct()}
        organizationId="org-1"
        canManage
        options={OPTIONS}
      />
    );

    expect(
      screen.getByRole("heading", { name: /premium widget/i })
    ).toBeInTheDocument();
    expect(screen.getByText("PROD-001")).toBeInTheDocument();
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    expect(screen.getByText("SKU-001")).toBeInTheDocument();
    expect(screen.getByText("featured")).toBeInTheDocument();
    expect(screen.getByText("A high quality widget")).toBeInTheDocument();
    expect(screen.getByText("18%")).toBeInTheDocument();
  });

  it("resolves category, brand and unit names from the options prop", () => {
    render(
      <ProductProfile
        product={makeProduct()}
        organizationId="org-1"
        canManage
        options={OPTIONS}
      />
    );

    expect(screen.getByText("Hardware")).toBeInTheDocument();
    expect(screen.getByText("Acme")).toBeInTheDocument();
    expect(screen.getByText("Piece")).toBeInTheDocument();
  });

  it("gracefully omits classification rows when no options are provided", () => {
    render(
      <ProductProfile
        product={makeProduct()}
        organizationId="org-1"
        canManage
      />
    );

    expect(screen.queryByText("Hardware")).not.toBeInTheDocument();
    expect(screen.queryByText("Category")).not.toBeInTheDocument();
  });

  it("renders an edit link that preserves the org param", () => {
    searchParamsRef.current = "org=org-9";
    render(
      <ProductProfile
        product={makeProduct()}
        organizationId="org-1"
        canManage
      />
    );
    expect(screen.getByRole("link", { name: /edit/i })).toHaveAttribute(
      "href",
      "/products/prod-1/edit?org=org-9"
    );
  });

  it("hides management actions when the user cannot manage", () => {
    render(
      <ProductProfile
        product={makeProduct()}
        organizationId="org-1"
        canManage={false}
      />
    );
    expect(
      screen.queryByRole("link", { name: /edit/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Archive" })
    ).not.toBeInTheDocument();
  });

  it("archives the product through the confirmation dialog", async () => {
    mockArchive.mockResolvedValue({ success: true, data: undefined });
    const user = userEvent.setup();
    render(
      <ProductProfile
        product={makeProduct()}
        organizationId="org-1"
        canManage
      />
    );

    await user.click(screen.getByRole("button", { name: "Archive" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Archive product" })
    );

    await waitFor(() =>
      expect(mockArchive).toHaveBeenCalledWith("org-1", "prod-1")
    );
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/products"));
  });

  it("shows an error when archiving fails", async () => {
    mockArchive.mockResolvedValue({
      success: false,
      error: { code: "unknown", message: "Failed to archive product" },
    });
    const user = userEvent.setup();
    render(
      <ProductProfile
        product={makeProduct()}
        organizationId="org-1"
        canManage
      />
    );

    await user.click(screen.getByRole("button", { name: "Archive" }));
    await user.click(
      screen.getByRole("button", { name: "Archive product" })
    );

    expect(
      await screen.findByText(/failed to archive product/i)
    ).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("hides the archive action for an already-archived product", () => {
    render(
      <ProductProfile
        product={makeProduct({ status: "archived" })}
        organizationId="org-1"
        canManage
      />
    );
    expect(
      screen.queryByRole("button", { name: "Archive" })
    ).not.toBeInTheDocument();
    // Edit remains available.
    expect(screen.getByRole("link", { name: /edit/i })).toBeInTheDocument();
  });
});
