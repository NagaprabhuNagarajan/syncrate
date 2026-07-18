import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@/tests/utils";
import type { Branch } from "@/features/organization/types/organization.types";
import { BranchesView } from "./branches-view";

// ─────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────

const { mockCreateBranch, mockUpdateBranch, mockDeleteBranch, mockRefresh } =
  vi.hoisted(() => ({
    mockCreateBranch: vi.fn(),
    mockUpdateBranch: vi.fn(),
    mockDeleteBranch: vi.fn(),
    mockRefresh: vi.fn(),
  }));

vi.mock("@/features/organization/actions/organization.actions", () => ({
  createBranchAction: mockCreateBranch,
  updateBranchAction: mockUpdateBranch,
  deleteBranchAction: mockDeleteBranch,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: mockRefresh,
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

const ORG_ID = "org-1";

const HQ_BRANCH: Branch = {
  id: "branch-hq",
  organizationId: ORG_ID,
  name: "Head Office",
  code: "HQ01",
  isHeadquarters: true,
  phone: null,
  email: null,
  addressLine1: null,
  addressLine2: null,
  city: "Mumbai",
  state: "Maharashtra",
  pincode: null,
  gstNumber: "27AAAAA0000A1Z5",
  status: "active",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const REGULAR_BRANCH: Branch = {
  ...HQ_BRANCH,
  id: "branch-2",
  name: "Pune Branch",
  code: "PUN01",
  isHeadquarters: false,
  city: "Pune",
  status: "inactive",
  gstNumber: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

describe("BranchesView", () => {
  it("renders the page header and branch cards", () => {
    render(
      <BranchesView
        organizationId={ORG_ID}
        branches={[HQ_BRANCH, REGULAR_BRANCH]}
      />
    );

    expect(
      screen.getByRole("heading", { name: /^branches/i })
    ).toBeInTheDocument();
    expect(screen.getByText("Head Office")).toBeInTheDocument();
    expect(screen.getByText("Pune Branch")).toBeInTheDocument();
    expect(screen.getByText("HQ01")).toBeInTheDocument();
    expect(screen.getByText("PUN01")).toBeInTheDocument();
    expect(screen.getByText("HQ")).toBeInTheDocument();
  });

  it("renders the empty state when there are no branches", () => {
    render(<BranchesView organizationId={ORG_ID} branches={[]} />);

    expect(screen.getByText(/no branches yet/i)).toBeInTheDocument();
    // Both the page header and the empty state expose an "Add branch" action.
    expect(
      screen.getAllByRole("button", { name: /add branch/i }).length
    ).toBeGreaterThanOrEqual(1);
  });

  it("hides the delete action for the headquarters branch", () => {
    render(
      <BranchesView
        organizationId={ORG_ID}
        branches={[HQ_BRANCH, REGULAR_BRANCH]}
      />
    );

    expect(
      screen.queryByRole("button", { name: /delete head office/i })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /delete pune branch/i })
    ).toBeInTheDocument();
  });

  it("opens the create form when 'Add branch' is clicked", async () => {
    const user = userEvent.setup();
    render(<BranchesView organizationId={ORG_ID} branches={[HQ_BRANCH]} />);

    await user.click(
      screen.getByRole("button", { name: /add branch/i })
    );

    expect(
      await screen.findByRole("heading", { name: /add branch/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /create branch/i })
    ).toBeInTheDocument();
  });

  it("opens the edit form pre-filled when 'Edit' is clicked", async () => {
    const user = userEvent.setup();
    render(
      <BranchesView organizationId={ORG_ID} branches={[REGULAR_BRANCH]} />
    );

    await user.click(
      screen.getByRole("button", { name: /edit pune branch/i })
    );

    expect(
      await screen.findByRole("heading", { name: /edit branch/i })
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/branch name/i)).toHaveValue("Pune Branch");
  });

  it("confirms and deletes a branch, then refreshes", async () => {
    mockDeleteBranch.mockResolvedValue({ success: true, data: undefined });
    const user = userEvent.setup();
    render(
      <BranchesView organizationId={ORG_ID} branches={[REGULAR_BRANCH]} />
    );

    await user.click(
      screen.getByRole("button", { name: /delete pune branch/i })
    );
    expect(
      await screen.findByRole("dialog", { name: /delete branch/i })
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /^delete branch$/i })
    );

    await waitFor(() => expect(mockDeleteBranch).toHaveBeenCalledTimes(1));
    expect(mockDeleteBranch).toHaveBeenCalledWith(ORG_ID, REGULAR_BRANCH.id);
    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
  });

  it("shows the server error when deletion fails", async () => {
    mockDeleteBranch.mockResolvedValue({
      success: false,
      error: {
        code: "cannot_delete_headquarters",
        message: "The headquarters branch cannot be deleted",
      },
    });
    const user = userEvent.setup();
    render(
      <BranchesView organizationId={ORG_ID} branches={[REGULAR_BRANCH]} />
    );

    await user.click(
      screen.getByRole("button", { name: /delete pune branch/i })
    );
    await user.click(
      screen.getByRole("button", { name: /^delete branch$/i })
    );

    expect(
      await screen.findByText(/headquarters branch cannot be deleted/i)
    ).toBeInTheDocument();
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("closes the delete dialog when cancel is clicked", async () => {
    const user = userEvent.setup();
    render(
      <BranchesView organizationId={ORG_ID} branches={[REGULAR_BRANCH]} />
    );

    await user.click(
      screen.getByRole("button", { name: /delete pune branch/i })
    );
    expect(
      await screen.findByRole("dialog", { name: /delete branch/i })
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^cancel$/i }));

    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: /delete branch/i })
      ).not.toBeInTheDocument()
    );
    expect(mockDeleteBranch).not.toHaveBeenCalled();
  });
});
