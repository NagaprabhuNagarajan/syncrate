import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@/tests/utils";
import type {
  Branch,
  OrganizationInvitation,
  OrganizationMemberWithUser,
  Role,
} from "@/features/organization/types/organization.types";
import { TeamManagementView } from "./team-management-view";

// ─────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────

const {
  mockCancelInvitation,
  mockInviteUser,
  mockResendInvitation,
  mockUpdateMemberRole,
  mockRemoveMember,
} = vi.hoisted(() => ({
  mockCancelInvitation: vi.fn(),
  mockInviteUser: vi.fn(),
  mockResendInvitation: vi.fn(),
  mockUpdateMemberRole: vi.fn(),
  mockRemoveMember: vi.fn(),
}));

vi.mock("@/features/organization/actions/organization.actions", () => ({
  cancelInvitationAction: mockCancelInvitation,
  inviteUserAction: mockInviteUser,
  resendInvitationAction: mockResendInvitation,
  updateMemberRoleAction: mockUpdateMemberRole,
  removeMemberAction: mockRemoveMember,
}));

// ─────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────

const ORG_ID = "11111111-1111-1111-1111-111111111111";
const ROLE_ID = "22222222-2222-2222-2222-222222222222";

const roles: Role[] = [
  {
    id: ROLE_ID,
    name: "Owner",
    description: null,
    isSystem: true,
    organizationId: ORG_ID,
    permissions: [],
    createdAt: new Date("2024-01-01"),
  },
];

const branches: Branch[] = [];

function makeMember(
  overrides: Partial<OrganizationMemberWithUser> = {}
): OrganizationMemberWithUser {
  return {
    id: "member-1",
    organizationId: ORG_ID,
    userId: "user-1",
    roleId: ROLE_ID,
    branchId: null,
    status: "active",
    invitedAt: null,
    joinedAt: new Date("2024-01-01"),
    invitedBy: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    email: "owner@acme.com",
    fullName: "Olivia Owner",
    avatarUrl: null,
    roleName: "Owner",
    ...overrides,
  };
}

function makeInvitation(
  overrides: Partial<OrganizationInvitation> = {}
): OrganizationInvitation {
  return {
    id: "inv-1",
    organizationId: ORG_ID,
    email: "pending@acme.com",
    fullName: null,
    roleId: ROLE_ID,
    branchId: null,
    token: "tok-123",
    status: "pending",
    expiresAt: new Date("2030-01-01"),
    acceptedAt: null,
    acceptedBy: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    createdBy: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

describe("TeamManagementView", () => {
  it("renders the page header and a member with role and status", () => {
    render(
      <TeamManagementView
        organizationId={ORG_ID}
        members={[makeMember()]}
        roles={roles}
        branches={branches}
        pendingInvitations={[]}
      />
    );

    expect(
      screen.getByRole("heading", { name: /^team\b/i })
    ).toBeInTheDocument();
    expect(screen.getByText("Olivia Owner")).toBeInTheDocument();
    expect(screen.getByText("owner@acme.com")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("links the member's role to the roles & permissions page", () => {
    render(
      <TeamManagementView
        organizationId={ORG_ID}
        members={[makeMember()]}
        roles={roles}
        branches={branches}
        pendingInvitations={[]}
      />
    );

    expect(screen.getByRole("link", { name: "Owner" })).toHaveAttribute(
      "href",
      "/settings/roles"
    );
  });

  it("links back to the settings page", () => {
    render(
      <TeamManagementView
        organizationId={ORG_ID}
        members={[makeMember()]}
        roles={roles}
        branches={branches}
        pendingInvitations={[]}
      />
    );

    expect(screen.getByRole("link", { name: /settings/i })).toHaveAttribute(
      "href",
      "/settings"
    );
  });

  it("removes a member via the row actions menu", async () => {
    mockRemoveMember.mockResolvedValue({ success: true, data: undefined });
    const user = userEvent.setup();
    render(
      <TeamManagementView
        organizationId={ORG_ID}
        members={[makeMember()]}
        roles={roles}
        branches={branches}
        pendingInvitations={[]}
      />
    );

    await user.click(
      screen.getByRole("button", { name: /actions for olivia owner/i })
    );
    await user.click(
      screen.getByRole("menuitem", { name: /remove from organization/i })
    );

    // Confirmation dialog → confirm.
    await user.click(
      screen.getByRole("button", { name: /^remove member$/i })
    );

    await waitFor(() =>
      expect(mockRemoveMember).toHaveBeenCalledWith("member-1", ORG_ID)
    );
  });

  it("shows empty states when there are no members or invitations", async () => {
    const user = userEvent.setup();
    render(
      <TeamManagementView
        organizationId={ORG_ID}
        members={[]}
        roles={roles}
        branches={branches}
        pendingInvitations={[]}
      />
    );

    // Members tab is active by default.
    expect(screen.getByText(/no members yet/i)).toBeInTheDocument();

    await user.click(
      screen.getByRole("tab", { name: /pending invitations/i })
    );
    expect(screen.getByText(/no pending invitations/i)).toBeInTheDocument();
  });

  it("renders pending invitations with email and role", async () => {
    const user = userEvent.setup();
    render(
      <TeamManagementView
        organizationId={ORG_ID}
        members={[makeMember()]}
        roles={roles}
        branches={branches}
        pendingInvitations={[makeInvitation()]}
      />
    );

    await user.click(
      screen.getByRole("tab", { name: /pending invitations/i })
    );
    expect(screen.getByText("pending@acme.com")).toBeInTheDocument();
    expect(screen.getByText(/expires/i)).toBeInTheDocument();
  });

  it("toggles the invite form when the Invite button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <TeamManagementView
        organizationId={ORG_ID}
        members={[makeMember()]}
        roles={roles}
        branches={branches}
        pendingInvitations={[]}
      />
    );

    expect(
      screen.queryByRole("heading", { name: /invite a team member/i })
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /invite/i }));

    expect(
      screen.getByRole("heading", { name: /invite a team member/i })
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /close/i }));

    expect(
      screen.queryByRole("heading", { name: /invite a team member/i })
    ).not.toBeInTheDocument();
  });

  it("copies the invite link to the clipboard", async () => {
    const user = userEvent.setup();
    // Define after setup() so this mock wins over user-event's clipboard stub.
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    render(
      <TeamManagementView
        organizationId={ORG_ID}
        members={[makeMember()]}
        roles={roles}
        branches={branches}
        pendingInvitations={[makeInvitation()]}
      />
    );

    await user.click(
      screen.getByRole("tab", { name: /pending invitations/i })
    );
    await user.click(
      screen.getByRole("button", {
        name: /copy invite link for pending@acme.com/i,
      })
    );

    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining("/accept-invitation?token=tok-123")
    );
    expect(await screen.findByText(/copied/i)).toBeInTheDocument();
  });

  it("shows declined invitations with resend and cancel actions", async () => {
    mockResendInvitation.mockResolvedValue({ success: true, data: undefined });
    const user = userEvent.setup();
    render(
      <TeamManagementView
        organizationId={ORG_ID}
        members={[makeMember()]}
        roles={roles}
        branches={branches}
        pendingInvitations={[]}
        declinedInvitations={[
          makeInvitation({
            id: "inv-declined",
            email: "declined@acme.com",
            status: "declined",
          }),
        ]}
      />
    );

    await user.click(
      screen.getByRole("tab", { name: /declined invitations/i })
    );
    expect(screen.getByText("declined@acme.com")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: /resend invitation to declined@acme.com/i,
      })
    );
    await waitFor(() =>
      expect(mockResendInvitation).toHaveBeenCalledWith("inv-declined", ORG_ID)
    );
  });

  it("cancels an invitation via the cancel button", async () => {
    mockCancelInvitation.mockResolvedValue({ success: true, data: undefined });
    const user = userEvent.setup();
    render(
      <TeamManagementView
        organizationId={ORG_ID}
        members={[makeMember()]}
        roles={roles}
        branches={branches}
        pendingInvitations={[makeInvitation()]}
      />
    );

    await user.click(
      screen.getByRole("tab", { name: /pending invitations/i })
    );
    await user.click(
      screen.getByRole("button", {
        name: /cancel invitation for pending@acme.com/i,
      })
    );

    await waitFor(() =>
      expect(mockCancelInvitation).toHaveBeenCalledWith("inv-1", ORG_ID)
    );
  });

  it("shows an error when cancelling an invitation fails", async () => {
    mockCancelInvitation.mockResolvedValue({
      success: false,
      error: { code: "not_found", message: "Invitation not found" },
    });
    const user = userEvent.setup();
    render(
      <TeamManagementView
        organizationId={ORG_ID}
        members={[makeMember()]}
        roles={roles}
        branches={branches}
        pendingInvitations={[makeInvitation()]}
      />
    );

    await user.click(
      screen.getByRole("tab", { name: /pending invitations/i })
    );
    await user.click(
      screen.getByRole("button", {
        name: /cancel invitation for pending@acme.com/i,
      })
    );

    expect(
      await screen.findByText(/invitation not found/i)
    ).toBeInTheDocument();
  });
});
