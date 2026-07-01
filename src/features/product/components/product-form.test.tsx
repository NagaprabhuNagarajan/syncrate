import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@/tests/utils";
import { ProductForm } from "./product-form";
import type { Product } from "@/features/product/types/product.types";

// ─────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────

const { mockCreate, mockUpdate, mockPush } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
  mockPush: vi.fn(),
}));

vi.mock("@/features/product/actions/product.actions", () => ({
  createProductAction: mockCreate,
  updateProductAction: mockUpdate,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), refresh: vi.fn() }),
}));

beforeEach(() => {
  vi.clearAllMocks();
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
    sku: null,
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
    tags: ["featured", "seasonal"],
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    createdBy: null,
    ...overrides,
  };
}

// Ids must be valid UUIDs — the create schema validates category/brand/unit
// selections with z.string().uuid().
const OPTIONS = {
  categories: [{ id: "11111111-1111-4111-8111-111111111111", name: "Hardware" }],
  brands: [{ id: "22222222-2222-4222-8222-222222222222", name: "Acme" }],
  units: [{ id: "33333333-3333-4333-8333-333333333333", name: "Piece" }],
  suppliers: [
    { id: "44444444-4444-4444-8444-444444444444", name: "Supplier One" },
  ],
};

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

describe("ProductForm (create)", () => {
  it("renders the create heading and required name field", () => {
    render(<ProductForm organizationId="org-1" {...OPTIONS} />);
    expect(
      screen.getByRole("heading", { name: /add product/i })
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/product name/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /create product/i })
    ).toBeInTheDocument();
  });

  it("renders the brand select alongside category and unit", () => {
    render(<ProductForm organizationId="org-1" {...OPTIONS} />);
    expect(screen.getByLabelText(/^brand$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^category$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^unit$/i)).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Acme" })).toBeInTheDocument();
  });

  it("shows a validation error and does not submit when the name is empty", async () => {
    const user = userEvent.setup();
    render(<ProductForm organizationId="org-1" {...OPTIONS} />);

    await user.click(screen.getByRole("button", { name: /create product/i }));

    expect(
      await screen.findByText(/product name is required/i)
    ).toBeInTheDocument();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("submits FormData with an uppercased code, type, brand, pricing tiers and CSV tags", async () => {
    mockCreate.mockResolvedValue({ success: true, data: makeProduct() });
    const user = userEvent.setup();
    render(<ProductForm organizationId="org-1" {...OPTIONS} />);

    await user.type(screen.getByLabelText(/product name/i), "Premium Widget");
    await user.type(screen.getByLabelText(/product code/i), "prod-1");
    await user.selectOptions(
      screen.getByLabelText(/^brand$/i),
      "22222222-2222-4222-8222-222222222222"
    );
    await user.type(screen.getByLabelText(/manufacturer/i), "Acme Corp");
    await user.type(screen.getByLabelText("Selling price (₹)"), "199.5");
    await user.type(screen.getByLabelText(/^tags$/i), "featured, seasonal");
    await user.click(screen.getByRole("button", { name: /create product/i }));

    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
    const [orgId, formData] = mockCreate.mock.calls[0] as [string, FormData];
    expect(orgId).toBe("org-1");
    expect(formData.get("name")).toBe("Premium Widget");
    expect(formData.get("code")).toBe("PROD-1");
    expect(formData.get("type")).toBe("inventory");
    expect(formData.get("brandId")).toBe(
      "22222222-2222-4222-8222-222222222222"
    );
    expect(formData.get("manufacturer")).toBe("Acme Corp");
    expect(formData.get("sellingPrice")).toBe("199.5");
    expect(formData.get("tags")).toBe("featured, seasonal");
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/products"));
  });

  it("submits the type chosen from the option cards", async () => {
    mockCreate.mockResolvedValue({ success: true, data: makeProduct() });
    const user = userEvent.setup();
    render(<ProductForm organizationId="org-1" {...OPTIONS} />);

    await user.type(screen.getByLabelText(/product name/i), "Repair Service");
    await user.click(screen.getByRole("radio", { name: /service/i }));
    await user.click(screen.getByRole("button", { name: /create product/i }));

    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
    const [, formData] = mockCreate.mock.calls[0] as [string, FormData];
    expect(formData.get("type")).toBe("service");
  });

  it("submits every GST rate selected from the multi-select", async () => {
    mockCreate.mockResolvedValue({ success: true, data: makeProduct() });
    const user = userEvent.setup();
    render(<ProductForm organizationId="org-1" {...OPTIONS} />);

    await user.type(screen.getByLabelText(/product name/i), "Taxable Widget");
    await user.click(screen.getByRole("checkbox", { name: "18%" }));
    await user.click(screen.getByRole("checkbox", { name: "5%" }));
    await user.click(screen.getByRole("button", { name: /create product/i }));

    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
    const [, formData] = mockCreate.mock.calls[0] as [string, FormData];
    expect(formData.getAll("gstRates")).toEqual(["5", "18"]);
  });

  it("displays a server error returned by the action", async () => {
    mockCreate.mockResolvedValue({
      success: false,
      error: {
        code: "duplicate_code",
        message: "A product with code already exists",
      },
    });
    const user = userEvent.setup();
    render(<ProductForm organizationId="org-1" {...OPTIONS} />);

    await user.type(screen.getByLabelText(/product name/i), "Premium Widget");
    await user.click(screen.getByRole("button", { name: /create product/i }));

    expect(
      await screen.findByText(/a product with code already exists/i)
    ).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("calls onSuccess instead of navigating when provided", async () => {
    const onSuccess = vi.fn();
    mockCreate.mockResolvedValue({ success: true, data: makeProduct() });
    const user = userEvent.setup();
    render(
      <ProductForm organizationId="org-1" onSuccess={onSuccess} {...OPTIONS} />
    );

    await user.type(screen.getByLabelText(/product name/i), "Premium Widget");
    await user.click(screen.getByRole("button", { name: /create product/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(mockPush).not.toHaveBeenCalled();
  });
});

describe("ProductForm (edit)", () => {
  it("pre-fills fields from the product and shows the segmented status control", () => {
    render(
      <ProductForm
        organizationId="org-1"
        product={makeProduct()}
        {...OPTIONS}
      />
    );

    expect(
      screen.getByRole("heading", { name: /edit product/i })
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/product name/i)).toHaveValue("Premium Widget");
    expect(screen.getByLabelText(/^status$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^tags$/i)).toHaveValue("featured, seasonal");
  });

  it("submits an update via updateProductAction with the product id", async () => {
    mockUpdate.mockResolvedValue({ success: true, data: makeProduct() });
    const user = userEvent.setup();
    render(
      <ProductForm
        organizationId="org-1"
        product={makeProduct()}
        {...OPTIONS}
      />
    );

    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
    const [orgId, productId, formData] = mockUpdate.mock.calls[0] as [
      string,
      string,
      FormData,
    ];
    expect(orgId).toBe("org-1");
    expect(productId).toBe("prod-1");
    expect(formData.get("name")).toBe("Premium Widget");
    expect(formData.get("status")).toBe("active");
  });

  it("submits the status chosen from the segmented control", async () => {
    mockUpdate.mockResolvedValue({ success: true, data: makeProduct() });
    const user = userEvent.setup();
    render(
      <ProductForm
        organizationId="org-1"
        product={makeProduct()}
        {...OPTIONS}
      />
    );

    await user.click(screen.getByRole("radio", { name: "Discontinued" }));
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
    const [, , formData] = mockUpdate.mock.calls[0] as [
      string,
      string,
      FormData,
    ];
    expect(formData.get("status")).toBe("discontinued");
  });
});
