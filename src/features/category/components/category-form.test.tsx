import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor, within } from "@/tests/utils";
import { CategoryForm } from "./category-form";
import type { Category } from "@/features/category/types/category.types";

// ─────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────

const { mockCreate, mockUpdate } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
}));

vi.mock("@/features/category/actions/category.actions", () => ({
  createCategoryAction: mockCreate,
  updateCategoryAction: mockUpdate,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const PARENT_UUID = "11111111-1111-1111-1111-111111111111";

// ─────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────

function makeCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: "cat-1",
    organizationId: "org-1",
    parentId: null,
    name: "Electronics",
    description: "Electronic goods",
    status: "active",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    createdBy: null,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

describe("CategoryForm (create)", () => {
  it("renders the create heading and required name field", () => {
    render(<CategoryForm organizationId="org-1" allCategories={[]} />);
    expect(
      screen.getByRole("heading", { name: /add category/i })
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/category name/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /create category/i })
    ).toBeInTheDocument();
  });

  it("shows a validation error and does not submit when the name is empty", async () => {
    const user = userEvent.setup();
    render(<CategoryForm organizationId="org-1" allCategories={[]} />);

    await user.click(screen.getByRole("button", { name: /create category/i }));

    expect(
      await screen.findByText(/name must be at least 2 characters/i)
    ).toBeInTheDocument();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("submits FormData with the name and selected parent", async () => {
    mockCreate.mockResolvedValue({ success: true, data: makeCategory() });
    const onSuccess = vi.fn();
    const user = userEvent.setup();
    render(
      <CategoryForm
        organizationId="org-1"
        allCategories={[makeCategory({ id: PARENT_UUID, name: "Devices" })]}
        onSuccess={onSuccess}
      />
    );

    await user.type(screen.getByLabelText(/category name/i), "Phones");
    await user.selectOptions(
      screen.getByLabelText(/parent category/i),
      PARENT_UUID
    );
    await user.click(screen.getByRole("button", { name: /create category/i }));

    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
    const [orgId, formData] = mockCreate.mock.calls[0] as [string, FormData];
    expect(orgId).toBe("org-1");
    expect(formData.get("name")).toBe("Phones");
    expect(formData.get("parentId")).toBe(PARENT_UUID);
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
  });

  it("displays a server error returned by the action", async () => {
    mockCreate.mockResolvedValue({
      success: false,
      error: { code: "duplicate_name", message: "A category named exists" },
    });
    const user = userEvent.setup();
    render(<CategoryForm organizationId="org-1" allCategories={[]} />);

    await user.type(screen.getByLabelText(/category name/i), "Phones");
    await user.click(screen.getByRole("button", { name: /create category/i }));

    expect(
      await screen.findByText(/a category named exists/i)
    ).toBeInTheDocument();
  });
});

describe("CategoryForm (edit)", () => {
  it("pre-fills fields, shows the status select and excludes self from parents", () => {
    render(
      <CategoryForm
        organizationId="org-1"
        category={makeCategory()}
        allCategories={[
          makeCategory(),
          makeCategory({ id: "cat-2", name: "Devices" }),
        ]}
      />
    );

    expect(
      screen.getByRole("heading", { name: /edit category/i })
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/category name/i)).toHaveValue("Electronics");
    expect(screen.getByLabelText(/^status$/i)).toBeInTheDocument();

    const parentSelect = screen.getByLabelText(/parent category/i);
    // The "Devices" sibling is offered, but the category itself is excluded.
    expect(
      within(parentSelect).getByRole("option", { name: "Devices" })
    ).toBeInTheDocument();
    expect(
      within(parentSelect).queryByRole("option", { name: "Electronics" })
    ).not.toBeInTheDocument();
  });

  it("submits an update via updateCategoryAction with the category id", async () => {
    mockUpdate.mockResolvedValue({ success: true, data: makeCategory() });
    const onSuccess = vi.fn();
    const user = userEvent.setup();
    render(
      <CategoryForm
        organizationId="org-1"
        category={makeCategory()}
        allCategories={[makeCategory()]}
        onSuccess={onSuccess}
      />
    );

    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
    const [orgId, categoryId, formData] = mockUpdate.mock.calls[0] as [
      string,
      string,
      FormData,
    ];
    expect(orgId).toBe("org-1");
    expect(categoryId).toBe("cat-1");
    expect(formData.get("name")).toBe("Electronics");
    expect(formData.get("status")).toBe("active");
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
  });
});
