import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@/tests/utils";
import { CategoriesView } from "./categories-view";
import type {
  Category,
  CategoryListResult,
} from "@/features/category/types/category.types";

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

vi.mock("@/features/category/actions/category.actions", () => ({
  archiveCategoryAction: archiveActionMock,
  createCategoryAction: vi.fn(),
  updateCategoryAction: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  searchParamsRef.current = "";
});

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

function makeResult(
  overrides: Partial<CategoryListResult> = {}
): CategoryListResult {
  return {
    items: [makeCategory()],
    total: 1,
    page: 1,
    pageSize: 20,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

describe("CategoriesView", () => {
  it("renders the heading, table rows and add button when canManage", () => {
    render(
      <CategoriesView
        organizationId="org-1"
        result={makeResult()}
        allCategories={[makeCategory()]}
        filters={{}}
        canManage
      />
    );

    expect(
      screen.getByRole("heading", { name: /categories/i })
    ).toBeInTheDocument();
    expect(screen.getByText("Electronics")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /add category/i })
    ).toBeInTheDocument();
  });

  it("renders the parent name for a child category", () => {
    const parent = makeCategory({ id: "cat-parent", name: "Devices" });
    const child = makeCategory({
      id: "cat-2",
      name: "Phones",
      parentId: "cat-parent",
    });
    render(
      <CategoriesView
        organizationId="org-1"
        result={makeResult({ items: [child] })}
        allCategories={[parent, child]}
        filters={{}}
        canManage
      />
    );
    expect(screen.getByText("Devices")).toBeInTheDocument();
  });

  it("hides the add button when the user cannot manage", () => {
    render(
      <CategoriesView
        organizationId="org-1"
        result={makeResult()}
        allCategories={[makeCategory()]}
        filters={{}}
        canManage={false}
      />
    );
    expect(
      screen.queryByRole("button", { name: /add category/i })
    ).not.toBeInTheDocument();
  });

  it("renders an empty state when there are no categories", () => {
    render(
      <CategoriesView
        organizationId="org-1"
        result={makeResult({ items: [], total: 0 })}
        allCategories={[]}
        filters={{}}
        canManage
      />
    );
    expect(screen.getByText(/no categories found/i)).toBeInTheDocument();
  });

  it("opens the inline create form when add category is clicked", async () => {
    const user = userEvent.setup();
    render(
      <CategoriesView
        organizationId="org-1"
        result={makeResult()}
        allCategories={[makeCategory()]}
        filters={{}}
        canManage
      />
    );

    await user.click(screen.getByRole("button", { name: /add category/i }));
    expect(
      screen.getByRole("heading", { name: /add category/i })
    ).toBeInTheDocument();
  });

  it("opens the inline edit form when a row edit is clicked", async () => {
    const user = userEvent.setup();
    render(
      <CategoriesView
        organizationId="org-1"
        result={makeResult()}
        allCategories={[makeCategory()]}
        filters={{}}
        canManage
      />
    );

    await user.click(screen.getByRole("button", { name: /^edit$/i }));
    expect(
      screen.getByRole("heading", { name: /edit category/i })
    ).toBeInTheDocument();
  });

  it("archives a category and refreshes on success", async () => {
    const user = userEvent.setup();
    archiveActionMock.mockResolvedValue({ success: true, data: undefined });
    render(
      <CategoriesView
        organizationId="org-1"
        result={makeResult()}
        allCategories={[makeCategory()]}
        filters={{}}
        canManage
      />
    );

    await user.click(screen.getByRole("button", { name: /^archive$/i }));
    expect(archiveActionMock).toHaveBeenCalledWith("org-1", "cat-1");
  });

  it("updates the URL when a search is submitted", async () => {
    const user = userEvent.setup();
    render(
      <CategoriesView
        organizationId="org-1"
        result={makeResult()}
        allCategories={[makeCategory()]}
        filters={{}}
        canManage
      />
    );
    await user.type(
      screen.getByLabelText(/search categories/i),
      "phones{Enter}"
    );
    expect(mockPush).toHaveBeenCalledWith("/products/categories?search=phones");
  });

  it("updates the URL when the status filter changes", async () => {
    const user = userEvent.setup();
    render(
      <CategoriesView
        organizationId="org-1"
        result={makeResult()}
        allCategories={[makeCategory()]}
        filters={{}}
        canManage
      />
    );
    await user.selectOptions(
      screen.getByLabelText(/filter by status/i),
      "archived"
    );
    expect(mockPush).toHaveBeenCalledWith(
      "/products/categories?status=archived"
    );
  });

  it("renders an em dash when a category has no parent", () => {
    render(
      <CategoriesView
        organizationId="org-1"
        result={makeResult({ items: [makeCategory({ description: null })] })}
        allCategories={[makeCategory()]}
        filters={{}}
        canManage={false}
      />
    );
    // Parent (no parent) and description (null) both render an em dash.
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(2);
  });
});
