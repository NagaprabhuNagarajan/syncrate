import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@/tests/utils";
import type { Branch } from "@/features/organization/types/organization.types";
import { BranchForm } from "./branch-form";

// ─────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────

const { mockCreateBranch, mockUpdateBranch } = vi.hoisted(() => ({
  mockCreateBranch: vi.fn(),
  mockUpdateBranch: vi.fn(),
}));

vi.mock("@/features/organization/actions/organization.actions", () => ({
  createBranchAction: mockCreateBranch,
  updateBranchAction: mockUpdateBranch,
}));

const ORG_ID = "org-1";

const EXISTING_BRANCH: Branch = {
  id: "branch-1",
  organizationId: ORG_ID,
  name: "Pune Branch",
  code: "PUN01",
  isHeadquarters: false,
  phone: "+91 98765 43210",
  email: "pune@company.com",
  addressLine1: "12 MG Road",
  addressLine2: null,
  city: "Pune",
  state: "Maharashtra",
  pincode: "411001",
  gstNumber: "27AAAAA0000A1Z5",
  status: "active",
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

describe("BranchForm — create mode", () => {
  it("renders the create heading and required fields", () => {
    render(<BranchForm organizationId={ORG_ID} />);

    expect(
      screen.getByRole("heading", { name: /add branch/i })
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/branch name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/branch code/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/set as headquarters/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /create branch/i })
    ).toBeInTheDocument();
    // Status select is edit-only.
    expect(screen.queryByLabelText(/status/i)).not.toBeInTheDocument();
  });

  it("shows validation errors and does not submit when required fields are invalid", async () => {
    const user = userEvent.setup();
    render(<BranchForm organizationId={ORG_ID} />);

    await user.type(screen.getByLabelText(/branch code/i), "a");
    await user.click(screen.getByRole("button", { name: /create branch/i }));

    expect(
      await screen.findByText(/name must be at least 2 characters/i)
    ).toBeInTheDocument();
    expect(mockCreateBranch).not.toHaveBeenCalled();
  });

  it("submits create with an uppercased code and HQ flag set when checked", async () => {
    mockCreateBranch.mockResolvedValue({
      success: true,
      data: { id: "branch-2" },
    });
    const onSuccess = vi.fn();
    const user = userEvent.setup();
    render(
      <BranchForm organizationId={ORG_ID} onSuccess={onSuccess} />
    );

    await user.type(screen.getByLabelText(/branch name/i), "Mumbai Office");
    await user.type(screen.getByLabelText(/branch code/i), "mum01");
    await user.click(screen.getByLabelText(/set as headquarters/i));
    await user.click(screen.getByRole("button", { name: /create branch/i }));

    await waitFor(() => expect(mockCreateBranch).toHaveBeenCalledTimes(1));
    const [orgArg, formData] = mockCreateBranch.mock.calls[0] as [
      string,
      FormData,
    ];
    expect(orgArg).toBe(ORG_ID);
    expect(formData.get("name")).toBe("Mumbai Office");
    expect(formData.get("code")).toBe("MUM01");
    expect(formData.get("isHeadquarters")).toBe("on");
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
  });

  it("sends the HQ flag as 'off' when the checkbox is unchecked", async () => {
    mockCreateBranch.mockResolvedValue({
      success: true,
      data: { id: "branch-3" },
    });
    const user = userEvent.setup();
    render(<BranchForm organizationId={ORG_ID} />);

    await user.type(screen.getByLabelText(/branch name/i), "Delhi Office");
    await user.type(screen.getByLabelText(/branch code/i), "DEL01");
    await user.click(screen.getByRole("button", { name: /create branch/i }));

    await waitFor(() => expect(mockCreateBranch).toHaveBeenCalledTimes(1));
    const formData = mockCreateBranch.mock.calls[0]?.[1] as FormData;
    // Always sent (on/off) so unchecking persists as false on edit.
    expect(formData.get("isHeadquarters")).toBe("off");
  });

  it("displays a server error returned by the create action", async () => {
    mockCreateBranch.mockResolvedValue({
      success: false,
      error: { code: "duplicate_code", message: "Branch code already in use" },
    });
    const user = userEvent.setup();
    render(<BranchForm organizationId={ORG_ID} />);

    await user.type(screen.getByLabelText(/branch name/i), "Mumbai Office");
    await user.type(screen.getByLabelText(/branch code/i), "MUM01");
    await user.click(screen.getByRole("button", { name: /create branch/i }));

    expect(
      await screen.findByText(/branch code already in use/i)
    ).toBeInTheDocument();
  });

  it("calls onCancel when the cancel button is clicked", async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(<BranchForm organizationId={ORG_ID} onCancel={onCancel} />);

    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe("BranchForm — edit mode", () => {
  it("pre-fills the form from the branch and shows the status control", () => {
    render(
      <BranchForm organizationId={ORG_ID} branch={EXISTING_BRANCH} />
    );

    expect(
      screen.getByRole("heading", { name: /edit branch/i })
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/branch name/i)).toHaveValue("Pune Branch");
    expect(screen.getByLabelText(/branch code/i)).toHaveValue("PUN01");
    // Status is a segmented control; the branch's status is the checked radio.
    expect(screen.getByRole("radio", { name: "Active" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(
      screen.getByRole("button", { name: /save changes/i })
    ).toBeInTheDocument();
  });

  it("submits update with the branch id and status", async () => {
    mockUpdateBranch.mockResolvedValue({
      success: true,
      data: { id: EXISTING_BRANCH.id },
    });
    const onSuccess = vi.fn();
    const user = userEvent.setup();
    render(
      <BranchForm
        organizationId={ORG_ID}
        branch={EXISTING_BRANCH}
        onSuccess={onSuccess}
      />
    );

    await user.clear(screen.getByLabelText(/branch name/i));
    await user.type(screen.getByLabelText(/branch name/i), "Pune HQ Branch");
    await user.click(screen.getByRole("radio", { name: "Inactive" }));
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(mockUpdateBranch).toHaveBeenCalledTimes(1));
    const [orgArg, branchArg, formData] = mockUpdateBranch.mock.calls[0] as [
      string,
      string,
      FormData,
    ];
    expect(orgArg).toBe(ORG_ID);
    expect(branchArg).toBe(EXISTING_BRANCH.id);
    expect(formData.get("name")).toBe("Pune HQ Branch");
    expect(formData.get("status")).toBe("inactive");
    expect(mockCreateBranch).not.toHaveBeenCalled();
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
  });
});
