import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@/tests/utils";
import { ProductsView } from "./products-view";
import type {
  Product,
  ProductListResult,
  ProductStats,
} from "@/features/product/types/product.types";

// ─────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────

const {
  mockPush,
  mockRefresh,
  searchParamsRef,
  exportActionMock,
  importActionMock,
} = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockRefresh: vi.fn(),
  searchParamsRef: { current: "" },
  exportActionMock: vi.fn(),
  importActionMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), refresh: mockRefresh }),
  useSearchParams: () => new URLSearchParams(searchParamsRef.current),
}));

vi.mock("@/features/product/actions/product.actions", () => ({
  exportProductsAction: exportActionMock,
  importProductsAction: importActionMock,
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
    description: null,
    type: "inventory",
    status: "active",
    categoryId: null,
    brandId: null,
    unitId: null,
    manufacturer: null,
    hsnCode: null,
    gstRate: 18,
    gstRates: [18],
    taxInclusive: false,
    purchasePrice: 100,
    sellingPrice: 199.5,
    dealerPrice: 0,
    wholesalePrice: 0,
    retailPrice: 250,
    minSellingPrice: 0,
    sku: "SKU-001",
    barcode: null,
    qrCode: null,
    trackInventory: true,
    reorderLevel: 0,
    maxStock: 0,
    openingStock: 0,
    preferredSupplierId: null,
    isSeasonal: false,
    isFastMoving: false,
    isSlowMoving: false,
    aiTags: [],
    tags: [],
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    createdBy: null,
    ...overrides,
  };
}

function makeResult(
  overrides: Partial<ProductListResult> = {}
): ProductListResult {
  return {
    items: [makeProduct()],
    total: 1,
    page: 1,
    pageSize: 20,
    ...overrides,
  };
}

function makeStats(overrides: Partial<ProductStats> = {}): ProductStats {
  return {
    total: 1,
    active: 1,
    draft: 0,
    discontinued: 0,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

describe("ProductsView", () => {
  it("renders the heading, table rows and add-product link when canManage", () => {
    render(
      <ProductsView
        organizationId="org-1"
        result={makeResult()}
        stats={makeStats()}
        filters={{}}
        canManage
      />
    );

    expect(
      screen.getByRole("heading", { name: /products/i })
    ).toBeInTheDocument();
    expect(screen.getByText("Premium Widget")).toBeInTheDocument();
    expect(screen.getByText("PROD-001")).toBeInTheDocument();
    expect(screen.getByText("Active", { selector: "div" })).toBeInTheDocument();
    const addLink = screen.getByRole("link", { name: /add product/i });
    expect(addLink).toHaveAttribute("href", "/products/new");
  });

  it("hides the add-product link when the user cannot manage", () => {
    render(
      <ProductsView
        organizationId="org-1"
        result={makeResult()}
        stats={makeStats()}
        filters={{}}
        canManage={false}
      />
    );
    expect(
      screen.queryByRole("link", { name: /add product/i })
    ).not.toBeInTheDocument();
  });

  it("renders an empty state when there are no products", () => {
    render(
      <ProductsView
        organizationId="org-1"
        result={makeResult({ items: [], total: 0 })}
        stats={makeStats({ total: 0, active: 0 })}
        filters={{}}
        canManage
      />
    );
    expect(screen.getByText(/no products found/i)).toBeInTheDocument();
  });

  it("navigates via the empty-state action when canManage", async () => {
    const user = userEvent.setup();
    render(
      <ProductsView
        organizationId="org-1"
        result={makeResult({ items: [], total: 0 })}
        stats={makeStats({ total: 0, active: 0 })}
        filters={{}}
        canManage
      />
    );
    await user.click(screen.getByRole("button", { name: /add product/i }));
    expect(mockPush).toHaveBeenCalledWith("/products/new");
  });

  it("updates the URL when a search is submitted", async () => {
    const user = userEvent.setup();
    render(
      <ProductsView
        organizationId="org-1"
        result={makeResult()}
        stats={makeStats()}
        filters={{}}
        canManage
      />
    );
    await user.type(screen.getByLabelText(/search products/i), "widget{Enter}");
    expect(mockPush).toHaveBeenCalledWith("/products?search=widget");
  });

  it("clears the search filter when the field is emptied", async () => {
    const user = userEvent.setup();
    render(
      <ProductsView
        organizationId="org-1"
        result={makeResult()}
        stats={makeStats()}
        filters={{ search: "widget" }}
        canManage
      />
    );
    await user.clear(screen.getByLabelText(/search products/i));
    expect(mockPush).toHaveBeenCalledWith("/products");
  });

  it("updates the URL when the status filter changes", async () => {
    const user = userEvent.setup();
    render(
      <ProductsView
        organizationId="org-1"
        result={makeResult()}
        stats={makeStats()}
        filters={{}}
        canManage
      />
    );
    await user.click(screen.getByRole("tab", { name: "Discontinued" }));
    expect(mockPush).toHaveBeenCalledWith("/products?status=discontinued");
  });

  it("updates the URL when the type filter changes", async () => {
    const user = userEvent.setup();
    render(
      <ProductsView
        organizationId="org-1"
        result={makeResult()}
        stats={makeStats()}
        filters={{}}
        canManage
      />
    );
    await user.selectOptions(
      screen.getByLabelText(/filter by type/i),
      "service"
    );
    expect(mockPush).toHaveBeenCalledWith("/products?type=service");
  });

  it("paginates to the next page", async () => {
    const user = userEvent.setup();
    render(
      <ProductsView
        organizationId="org-1"
        result={makeResult({
          items: [makeProduct(), makeProduct({ id: "prod-2" })],
          total: 45,
          page: 1,
          pageSize: 20,
        })}
        stats={makeStats()}
        filters={{}}
        canManage
      />
    );
    expect(screen.getByRole("button", { name: /previous/i })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /next/i }));
    expect(mockPush).toHaveBeenCalledWith("/products?page=2");
  });

  it("navigates to the product detail when a row is clicked", async () => {
    const user = userEvent.setup();
    render(
      <ProductsView
        organizationId="org-1"
        result={makeResult()}
        stats={makeStats()}
        filters={{}}
        canManage
      />
    );
    await user.click(screen.getByText("PROD-001"));
    expect(mockPush).toHaveBeenCalledWith("/products/prod-1");
  });

  it("renders an em dash for a missing SKU", () => {
    render(
      <ProductsView
        organizationId="org-1"
        result={makeResult({ items: [makeProduct({ sku: null })] })}
        stats={makeStats()}
        filters={{}}
        canManage
      />
    );
    expect(screen.getAllByText("—")).toHaveLength(1);
  });

  it("hides the export and import buttons when the user cannot manage", () => {
    render(
      <ProductsView
        organizationId="org-1"
        result={makeResult()}
        stats={makeStats()}
        filters={{}}
        canManage={false}
      />
    );
    expect(
      screen.queryByRole("button", { name: /export/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /import/i })
    ).not.toBeInTheDocument();
  });

  it("exports products and triggers a CSV download", async () => {
    const user = userEvent.setup();
    exportActionMock.mockResolvedValue({
      success: true,
      data: "code,name\r\nP1,Widget",
    });

    const createUrl = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:fake");
    const revokeUrl = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => undefined);
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);

    render(
      <ProductsView
        organizationId="org-1"
        result={makeResult()}
        stats={makeStats()}
        filters={{}}
        canManage
      />
    );

    await user.click(screen.getByRole("button", { name: /export/i }));

    expect(exportActionMock).toHaveBeenCalledWith("org-1");
    expect(createUrl).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeUrl).toHaveBeenCalledWith("blob:fake");

    createUrl.mockRestore();
    revokeUrl.mockRestore();
    clickSpy.mockRestore();
  });

  it("surfaces an export error without downloading", async () => {
    const user = userEvent.setup();
    exportActionMock.mockResolvedValue({
      success: false,
      error: { code: "forbidden", message: "Not allowed" },
    });
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);

    render(
      <ProductsView
        organizationId="org-1"
        result={makeResult()}
        stats={makeStats()}
        filters={{}}
        canManage
      />
    );

    await user.click(screen.getByRole("button", { name: /export/i }));

    expect(await screen.findByText("Not allowed")).toBeInTheDocument();
    expect(clickSpy).not.toHaveBeenCalled();
    clickSpy.mockRestore();
  });

  it("opens the import dialog when import is clicked", async () => {
    const user = userEvent.setup();
    render(
      <ProductsView
        organizationId="org-1"
        result={makeResult()}
        stats={makeStats()}
        filters={{}}
        canManage
      />
    );

    expect(
      screen.queryByRole("dialog", { name: /import products/i })
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^import$/i }));

    expect(
      screen.getByRole("dialog", { name: /import products/i })
    ).toBeInTheDocument();
  });

  it("preserves the active org param in links and navigation", async () => {
    searchParamsRef.current = "org=org-9";
    const user = userEvent.setup();
    render(
      <ProductsView
        organizationId="org-1"
        result={makeResult()}
        stats={makeStats()}
        filters={{}}
        canManage
      />
    );
    expect(screen.getByRole("link", { name: /add product/i })).toHaveAttribute(
      "href",
      "/products/new?org=org-9"
    );
    await user.click(screen.getByText("PROD-001"));
    expect(mockPush).toHaveBeenCalledWith("/products/prod-1?org=org-9");
  });
});
