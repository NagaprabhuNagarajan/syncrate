import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@/tests/utils";
import type {
  Branch,
  Role,
} from "@/features/organization/types/organization.types";
import { InviteUserForm } from "./invite-user-form";

// ─────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────

const { mockInviteUser } = vi.hoisted(() => ({
  mockInviteUser: vi.fn(),
}));

vi.mock("@/features/organization/actions/organization.actions", () => ({
  inviteUserAction: mockInviteUser,
}));

// ─────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────

const ORG_ID = "11111111-1111-1111-1111-111111111111";
const ROLE_ID = "22222222-2222-2222-2222-222222222222";
const BRANCH_ID = "33333333-3333-3333-3333-333333333333";

const roles: Role[] = [
  {
    id: ROLE_ID,
    name: "Accountant",
    description: null,
    isSystem: true,
    organizationId: ORG_ID,
    permissions: [],
    createdAt: new Date("2024-01-01"),
  },
];

const branches: Branch[] = [
  {
    id: BRANCH_ID,
    organizationId: ORG_ID,
    name: "Chennai HQ",
    code: "CHN",
    isHeadquarters: true,
    phone: null,
    email: null,
    addressLine1: null,
    addressLine2: null,
    city: null,
    state: null,
    pincode: null,
    gstNumber: null,
    status: "active",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  },
];

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

describe("InviteUserForm", () => {
  it("renders the email field, role and branch selects, and submit button", () => {
    render(
      <InviteUserForm
        organizationId={ORG_ID}
        roles={roles}
        branches={branches}
      />
    );

    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/role/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/branch/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /send invitation/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Accountant" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Chennai HQ" })
    ).toBeInTheDocument();
  });

  it("shows validation errors and does not submit when required fields are empty", async () => {
    const user = userEvent.setup();
    render(
      <InviteUserForm
        organizationId={ORG_ID}
        roles={roles}
        branches={branches}
      />
    );

    await user.click(screen.getByRole("button", { name: /send invitation/i }));

    expect(await screen.findByText(/email is required/i)).toBeInTheDocument();
    expect(mockInviteUser).not.toHaveBeenCalled();
  });

  it("submits the action with the correct FormData when valid", async () => {
    mockInviteUser.mockResolvedValue({
      success: true,
      data: { id: "inv-1", email: "new@user.com" },
    });
    const user = userEvent.setup();
    render(
      <InviteUserForm
        organizationId={ORG_ID}
        roles={roles}
        branches={branches}
      />
    );

    await user.type(screen.getByLabelText(/email address/i), "new@user.com");
    await user.type(screen.getByLabelText(/full name/i), "New User");
    await user.selectOptions(screen.getByLabelText(/role/i), ROLE_ID);
    await user.selectOptions(screen.getByLabelText(/branch/i), BRANCH_ID);
    await user.click(screen.getByRole("button", { name: /send invitation/i }));

    await waitFor(() => expect(mockInviteUser).toHaveBeenCalledTimes(1));
    const [orgArg, formData] = mockInviteUser.mock.calls[0] as [
      string,
      FormData,
    ];
    expect(orgArg).toBe(ORG_ID);
    expect(formData.get("email")).toBe("new@user.com");
    expect(formData.get("fullName")).toBe("New User");
    expect(formData.get("roleId")).toBe(ROLE_ID);
    expect(formData.get("branchId")).toBe(BRANCH_ID);
  });

  it("omits the optional branch when none is selected", async () => {
    mockInviteUser.mockResolvedValue({
      success: true,
      data: { id: "inv-2", email: "nobranch@user.com" },
    });
    const user = userEvent.setup();
    render(
      <InviteUserForm
        organizationId={ORG_ID}
        roles={roles}
        branches={branches}
      />
    );

    await user.type(
      screen.getByLabelText(/email address/i),
      "nobranch@user.com"
    );
    await user.selectOptions(screen.getByLabelText(/role/i), ROLE_ID);
    await user.click(screen.getByRole("button", { name: /send invitation/i }));

    await waitFor(() => expect(mockInviteUser).toHaveBeenCalledTimes(1));
    const [, formData] = mockInviteUser.mock.calls[0] as [string, FormData];
    expect(formData.get("branchId")).toBeNull();
    expect(formData.get("fullName")).toBeNull();
  });

  it("shows a success banner and calls onSuccess after a successful invite", async () => {
    mockInviteUser.mockResolvedValue({
      success: true,
      data: { id: "inv-3", email: "ok@user.com" },
    });
    const onSuccess = vi.fn();
    const user = userEvent.setup();
    render(
      <InviteUserForm
        organizationId={ORG_ID}
        roles={roles}
        branches={branches}
        onSuccess={onSuccess}
      />
    );

    await user.type(screen.getByLabelText(/email address/i), "ok@user.com");
    await user.selectOptions(screen.getByLabelText(/role/i), ROLE_ID);
    await user.click(screen.getByRole("button", { name: /send invitation/i }));

    expect(
      await screen.findByText(/invitation sent to ok@user.com/i)
    ).toBeInTheDocument();
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it("displays a server error returned by the action", async () => {
    mockInviteUser.mockResolvedValue({
      success: false,
      error: { code: "already_member", message: "User is already a member" },
    });
    const user = userEvent.setup();
    render(
      <InviteUserForm
        organizationId={ORG_ID}
        roles={roles}
        branches={branches}
      />
    );

    await user.type(screen.getByLabelText(/email address/i), "dupe@user.com");
    await user.selectOptions(screen.getByLabelText(/role/i), ROLE_ID);
    await user.click(screen.getByRole("button", { name: /send invitation/i }));

    expect(
      await screen.findByText(/user is already a member/i)
    ).toBeInTheDocument();
  });
});
