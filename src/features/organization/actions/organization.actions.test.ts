import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type {
  Branch,
  Organization,
  OrganizationActionResult,
  OrganizationContext,
  OrganizationInvitation,
} from "@/features/organization/types/organization.types";
import {
  createOrganizationAction,
  updateOrganizationAction,
  inviteUserAction,
  cancelInvitationAction,
  acceptInvitationAction,
  createBranchAction,
  updateBranchAction,
  deleteBranchAction,
  switchOrganizationAction,
} from "./organization.actions";

// ─────────────────────────────────────────────────────────────
// Hoisted mocks
// ─────────────────────────────────────────────────────────────

const {
  mockService,
  redirectMock,
  revalidateMock,
  getUserMock,
  createClientMock,
  logMock,
} = vi.hoisted(() => ({
  mockService: {
    createOrganization: vi.fn(),
    updateOrganization: vi.fn(),
    inviteUser: vi.fn(),
    cancelInvitation: vi.fn(),
    acceptInvitation: vi.fn(),
    createBranch: vi.fn(),
    updateBranch: vi.fn(),
    deleteBranch: vi.fn(),
    getOrganizationContext: vi.fn(),
  },
  redirectMock: vi.fn(),
  revalidateMock: vi.fn(),
  getUserMock: vi.fn(),
  createClientMock: vi.fn(),
  logMock: vi.fn().mockResolvedValue(true),
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidateMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: createClientMock,
}));

vi.mock("@/features/organization/services/organization.service", () => ({
  OrganizationService: vi.fn(() => mockService),
}));

vi.mock("@/features/audit/services/audit.service", () => ({
  AuditService: vi.fn(() => ({ log: logMock })),
}));

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

const ROLE_ID = "11111111-1111-1111-1111-111111111111";

function fd(entries: Record<string, string>): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    form.set(key, value);
  }
  return form;
}

const fakeSupabase = {
  auth: { getUser: getUserMock },
} as unknown as AppSupabaseClient;

function authedAs(userId: string): void {
  getUserMock.mockResolvedValue({ data: { user: { id: userId } } });
}

function unauthenticated(): void {
  getUserMock.mockResolvedValue({ data: { user: null } });
}

function buildOrg(): Organization {
  return {
    id: "org-1",
    name: "Acme Co",
    slug: "acme-co",
    displayName: null,
    businessType: null,
    gstNumber: null,
    panNumber: null,
    cinNumber: null,
    phone: null,
    email: null,
    website: null,
    addressLine1: null,
    addressLine2: null,
    city: null,
    state: null,
    country: "IN",
    pincode: null,
    logoUrl: null,
    verificationStatus: "unverified",
    status: "active",
    plan: "free",
    planExpiresAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: "user-1",
  };
}

function buildContext(
  permissions: readonly string[]
): OrganizationContext {
  return {
    organization: buildOrg(),
    member: {
      id: "member-1",
      organizationId: "org-1",
      userId: "user-1",
      roleId: ROLE_ID,
      branchId: null,
      status: "active",
      invitedAt: null,
      joinedAt: null,
      invitedBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    branch: null,
    permissions,
  };
}

function buildBranch(): Branch {
  return {
    id: "branch-1",
    organizationId: "org-1",
    name: "HQ",
    code: "HQ01",
    isHeadquarters: false,
    phone: null,
    email: null,
    addressLine1: null,
    addressLine2: null,
    city: null,
    state: null,
    pincode: null,
    gstNumber: null,
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  createClientMock.mockResolvedValue(fakeSupabase);
});

// ─────────────────────────────────────────────────────────────
// createOrganizationAction
// ─────────────────────────────────────────────────────────────

describe("createOrganizationAction", () => {
  it("returns unknown error and does not call the service on invalid input", async () => {
    const result = await createOrganizationAction(fd({ name: "A" }));

    expect(result).toEqual({
      success: false,
      error: { code: "unknown", message: expect.any(String) },
    });
    expect(mockService.createOrganization).not.toHaveBeenCalled();
  });

  it("returns forbidden when the user is not authenticated", async () => {
    unauthenticated();

    const result = await createOrganizationAction(fd({ name: "Acme Co" }));

    expect(result).toEqual({
      success: false,
      error: { code: "forbidden", message: "Not authenticated" },
    });
    expect(mockService.createOrganization).not.toHaveBeenCalled();
  });

  it("surfaces the service failure result", async () => {
    authedAs("user-1");
    const failure: OrganizationActionResult<Organization> = {
      success: false,
      error: { code: "duplicate_slug", message: "taken" },
    };
    mockService.createOrganization.mockResolvedValue(failure);

    const result = await createOrganizationAction(fd({ name: "Acme Co" }));

    expect(result).toBe(failure);
    expect(redirectMock).not.toHaveBeenCalled();
    expect(logMock).not.toHaveBeenCalled();
  });

  it("calls the service with parsed data and redirects on success", async () => {
    authedAs("user-1");
    mockService.createOrganization.mockResolvedValue({
      success: true,
      data: buildOrg(),
    });

    await createOrganizationAction(fd({ name: "Acme Co" }));

    expect(mockService.createOrganization).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Acme Co", country: "IN" }),
      "user-1"
    );
    expect(redirectMock).toHaveBeenCalledWith("/dashboard");
    expect(logMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "organization.create",
        entityType: "organization",
      })
    );
  });

  it("does not audit-log on invalid input", async () => {
    await createOrganizationAction(fd({ name: "A" }));

    expect(logMock).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────
// updateOrganizationAction
// ─────────────────────────────────────────────────────────────

describe("updateOrganizationAction", () => {
  it("returns unknown error and does not call the service on invalid input", async () => {
    const result = await updateOrganizationAction("org-1", fd({ name: "A" }));

    expect(result).toEqual({
      success: false,
      error: { code: "unknown", message: expect.any(String) },
    });
    expect(mockService.updateOrganization).not.toHaveBeenCalled();
  });

  it("returns forbidden when the user is not authenticated", async () => {
    unauthenticated();

    const result = await updateOrganizationAction(
      "org-1",
      fd({ name: "Valid Name" })
    );

    expect(result).toEqual({
      success: false,
      error: { code: "forbidden", message: "Not authenticated" },
    });
    expect(mockService.updateOrganization).not.toHaveBeenCalled();
  });

  it("returns the service result on success", async () => {
    authedAs("user-1");
    const success: OrganizationActionResult<Organization> = {
      success: true,
      data: buildOrg(),
    };
    mockService.updateOrganization.mockResolvedValue(success);

    const result = await updateOrganizationAction(
      "org-1",
      fd({ name: "Valid Name" })
    );

    expect(mockService.updateOrganization).toHaveBeenCalledWith(
      "org-1",
      expect.objectContaining({ name: "Valid Name" }),
      "user-1"
    );
    expect(result).toBe(success);
    expect(logMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "organization.update",
        entityType: "organization",
      })
    );
  });

  it("does not audit-log when the service fails", async () => {
    authedAs("user-1");
    mockService.updateOrganization.mockResolvedValue({
      success: false,
      error: { code: "not_found", message: "nope" },
    });

    await updateOrganizationAction("org-1", fd({ name: "Valid Name" }));

    expect(logMock).not.toHaveBeenCalled();
  });

  it("does not audit-log on invalid input", async () => {
    await updateOrganizationAction("org-1", fd({ name: "A" }));

    expect(logMock).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────
// inviteUserAction
// ─────────────────────────────────────────────────────────────

describe("inviteUserAction", () => {
  it("returns unknown error and does not call the service on invalid input", async () => {
    const result = await inviteUserAction(
      "org-1",
      fd({ email: "not-an-email", roleId: "not-a-uuid" })
    );

    expect(result).toEqual({
      success: false,
      error: { code: "unknown", message: expect.any(String) },
    });
    expect(mockService.inviteUser).not.toHaveBeenCalled();
  });

  it("returns forbidden when the user is not authenticated", async () => {
    unauthenticated();

    const result = await inviteUserAction(
      "org-1",
      fd({ email: "new@example.com", roleId: ROLE_ID })
    );

    expect(result).toEqual({
      success: false,
      error: { code: "forbidden", message: "Not authenticated" },
    });
    expect(mockService.inviteUser).not.toHaveBeenCalled();
  });

  it("returns forbidden when the caller has no access to the organization", async () => {
    authedAs("user-1");
    mockService.getOrganizationContext.mockResolvedValue(null);

    const result = await inviteUserAction(
      "org-1",
      fd({ email: "new@example.com", roleId: ROLE_ID })
    );

    expect(result).toEqual({
      success: false,
      error: {
        code: "forbidden",
        message: "You do not have access to this organization",
      },
    });
    expect(mockService.inviteUser).not.toHaveBeenCalled();
  });

  it("returns forbidden when the caller lacks the settings.users permission", async () => {
    authedAs("user-1");
    mockService.getOrganizationContext.mockResolvedValue(
      buildContext(["invoice.create"])
    );

    const result = await inviteUserAction(
      "org-1",
      fd({ email: "new@example.com", roleId: ROLE_ID })
    );

    expect(result).toEqual({
      success: false,
      error: {
        code: "forbidden",
        message: "You do not have permission to invite users",
      },
    });
    expect(mockService.inviteUser).not.toHaveBeenCalled();
  });

  it("returns the service result on success and revalidates", async () => {
    authedAs("user-1");
    mockService.getOrganizationContext.mockResolvedValue(
      buildContext(["settings.users"])
    );
    const invitation = { id: "inv-1" } as unknown as OrganizationInvitation;
    const success: OrganizationActionResult<OrganizationInvitation> = {
      success: true,
      data: invitation,
    };
    mockService.inviteUser.mockResolvedValue(success);

    const result = await inviteUserAction(
      "org-1",
      fd({ email: "NEW@example.com", roleId: ROLE_ID })
    );

    expect(mockService.inviteUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: "new@example.com", roleId: ROLE_ID }),
      "org-1",
      "user-1"
    );
    expect(result).toBe(success);
    expect(revalidateMock).toHaveBeenCalledWith("/settings/team");
    expect(logMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "invitation.create",
        entityType: "invitation",
      })
    );
  });

  it("does not audit-log when forbidden or on invalid input", async () => {
    const invalid = await inviteUserAction(
      "org-1",
      fd({ email: "bad", roleId: "bad" })
    );
    expect(invalid.success).toBe(false);

    authedAs("user-1");
    mockService.getOrganizationContext.mockResolvedValue(
      buildContext(["invoice.create"])
    );
    await inviteUserAction(
      "org-1",
      fd({ email: "new@example.com", roleId: ROLE_ID })
    );

    expect(logMock).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────
// cancelInvitationAction
// ─────────────────────────────────────────────────────────────

describe("cancelInvitationAction", () => {
  it("returns forbidden when the user is not authenticated", async () => {
    unauthenticated();

    const result = await cancelInvitationAction("inv-1", "org-1");

    expect(result).toEqual({
      success: false,
      error: { code: "forbidden", message: "Not authenticated" },
    });
    expect(mockService.getOrganizationContext).not.toHaveBeenCalled();
  });

  it("returns forbidden when the caller has no access to the organization", async () => {
    authedAs("user-1");
    mockService.getOrganizationContext.mockResolvedValue(null);

    const result = await cancelInvitationAction("inv-1", "org-1");

    expect(result).toEqual({
      success: false,
      error: {
        code: "forbidden",
        message: "You do not have access to this organization",
      },
    });
    expect(mockService.cancelInvitation).not.toHaveBeenCalled();
  });

  it("returns forbidden when the caller lacks the settings.users permission", async () => {
    authedAs("user-1");
    mockService.getOrganizationContext.mockResolvedValue(
      buildContext(["invoice.create"])
    );

    const result = await cancelInvitationAction("inv-1", "org-1");

    expect(result).toEqual({
      success: false,
      error: {
        code: "forbidden",
        message: "You do not have permission to manage invitations",
      },
    });
    expect(mockService.cancelInvitation).not.toHaveBeenCalled();
  });

  it("returns the service result when the caller is authorized", async () => {
    authedAs("user-1");
    mockService.getOrganizationContext.mockResolvedValue(
      buildContext(["settings.users"])
    );
    const success: OrganizationActionResult<void> = {
      success: true,
      data: undefined,
    };
    mockService.cancelInvitation.mockResolvedValue(success);

    const result = await cancelInvitationAction("inv-1", "org-1");

    expect(mockService.getOrganizationContext).toHaveBeenCalledWith(
      "org-1",
      "user-1"
    );
    expect(mockService.cancelInvitation).toHaveBeenCalledWith("inv-1", "user-1");
    expect(result).toBe(success);
    expect(logMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "invitation.cancel",
        entityType: "invitation",
      })
    );
  });

  it("does not audit-log when forbidden", async () => {
    authedAs("user-1");
    mockService.getOrganizationContext.mockResolvedValue(
      buildContext(["invoice.create"])
    );

    await cancelInvitationAction("inv-1", "org-1");

    expect(logMock).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────
// acceptInvitationAction
// ─────────────────────────────────────────────────────────────

describe("acceptInvitationAction", () => {
  it("returns forbidden when the user is not authenticated", async () => {
    unauthenticated();

    const result = await acceptInvitationAction("tok-123");

    expect(result).toEqual({
      success: false,
      error: { code: "forbidden", message: "Not authenticated" },
    });
    expect(mockService.acceptInvitation).not.toHaveBeenCalled();
  });

  it("calls the service and revalidates on success", async () => {
    authedAs("user-1");
    const success: OrganizationActionResult<Organization> = {
      success: true,
      data: buildOrg(),
    };
    mockService.acceptInvitation.mockResolvedValue(success);

    const result = await acceptInvitationAction("tok-123");

    expect(mockService.acceptInvitation).toHaveBeenCalledWith(
      "tok-123",
      "user-1"
    );
    expect(result).toBe(success);
    expect(revalidateMock).toHaveBeenCalledWith("/dashboard");
    expect(revalidateMock).toHaveBeenCalledWith("/select-organization");
    expect(logMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "invitation.accept",
        entityType: "invitation",
      })
    );
  });

  it("does not revalidate or audit-log when the service fails", async () => {
    authedAs("user-1");
    const failure: OrganizationActionResult<Organization> = {
      success: false,
      error: { code: "invitation_expired", message: "expired" },
    };
    mockService.acceptInvitation.mockResolvedValue(failure);

    const result = await acceptInvitationAction("tok-123");

    expect(result).toBe(failure);
    expect(revalidateMock).not.toHaveBeenCalled();
    expect(logMock).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────
// createBranchAction
// ─────────────────────────────────────────────────────────────

describe("createBranchAction", () => {
  it("returns unknown error and does not call the service on invalid input", async () => {
    const result = await createBranchAction("org-1", fd({ name: "A" }));

    expect(result).toEqual({
      success: false,
      error: { code: "unknown", message: expect.any(String) },
    });
    expect(mockService.createBranch).not.toHaveBeenCalled();
  });

  it("returns forbidden when the user is not authenticated", async () => {
    unauthenticated();

    const result = await createBranchAction(
      "org-1",
      fd({ name: "Main Branch", code: "MB01" })
    );

    expect(result).toEqual({
      success: false,
      error: { code: "forbidden", message: "Not authenticated" },
    });
    expect(mockService.createBranch).not.toHaveBeenCalled();
  });

  it("returns forbidden when the caller lacks the settings.branches permission", async () => {
    authedAs("user-1");
    mockService.getOrganizationContext.mockResolvedValue(
      buildContext(["invoice.create"])
    );

    const result = await createBranchAction(
      "org-1",
      fd({ name: "Main Branch", code: "MB01" })
    );

    expect(result).toEqual({
      success: false,
      error: {
        code: "forbidden",
        message: "You do not have permission to manage branches",
      },
    });
    expect(mockService.createBranch).not.toHaveBeenCalled();
  });

  it("returns forbidden when the caller has no access to the organization", async () => {
    authedAs("user-1");
    mockService.getOrganizationContext.mockResolvedValue(null);

    const result = await createBranchAction(
      "org-1",
      fd({ name: "Main Branch", code: "MB01" })
    );

    expect(result).toEqual({
      success: false,
      error: {
        code: "forbidden",
        message: "You do not have access to this organization",
      },
    });
    expect(mockService.createBranch).not.toHaveBeenCalled();
  });

  it("calls the service and revalidates on success", async () => {
    authedAs("user-1");
    mockService.getOrganizationContext.mockResolvedValue(
      buildContext(["settings.branches"])
    );
    const success: OrganizationActionResult<Branch> = {
      success: true,
      data: buildBranch(),
    };
    mockService.createBranch.mockResolvedValue(success);

    const result = await createBranchAction(
      "org-1",
      fd({ name: "Main Branch", code: "MB01" })
    );

    expect(mockService.createBranch).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Main Branch", code: "MB01" }),
      "org-1",
      "user-1"
    );
    expect(result).toBe(success);
    expect(revalidateMock).toHaveBeenCalledWith("/settings/branches");
    expect(logMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "branch.create",
        entityType: "branch",
      })
    );
  });

  it("does not audit-log when forbidden or on invalid input", async () => {
    const invalid = await createBranchAction("org-1", fd({ name: "A" }));
    expect(invalid.success).toBe(false);

    authedAs("user-1");
    mockService.getOrganizationContext.mockResolvedValue(
      buildContext(["invoice.create"])
    );
    await createBranchAction("org-1", fd({ name: "Main Branch", code: "MB01" }));

    expect(logMock).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────
// updateBranchAction
// ─────────────────────────────────────────────────────────────

describe("updateBranchAction", () => {
  it("returns unknown error and does not call the service on invalid input", async () => {
    const result = await updateBranchAction(
      "org-1",
      "branch-1",
      fd({ code: "!" })
    );

    expect(result).toEqual({
      success: false,
      error: { code: "unknown", message: expect.any(String) },
    });
    expect(mockService.updateBranch).not.toHaveBeenCalled();
  });

  it("returns forbidden when the user is not authenticated", async () => {
    unauthenticated();

    const result = await updateBranchAction(
      "org-1",
      "branch-1",
      fd({ name: "Renamed" })
    );

    expect(result).toEqual({
      success: false,
      error: { code: "forbidden", message: "Not authenticated" },
    });
    expect(mockService.updateBranch).not.toHaveBeenCalled();
  });

  it("returns forbidden when the caller lacks the settings.branches permission", async () => {
    authedAs("user-1");
    mockService.getOrganizationContext.mockResolvedValue(
      buildContext(["invoice.create"])
    );

    const result = await updateBranchAction(
      "org-1",
      "branch-1",
      fd({ name: "Renamed" })
    );

    expect(result).toEqual({
      success: false,
      error: {
        code: "forbidden",
        message: "You do not have permission to manage branches",
      },
    });
    expect(mockService.updateBranch).not.toHaveBeenCalled();
  });

  it("calls the service and revalidates on success", async () => {
    authedAs("user-1");
    mockService.getOrganizationContext.mockResolvedValue(
      buildContext(["settings.branches"])
    );
    const success: OrganizationActionResult<Branch> = {
      success: true,
      data: buildBranch(),
    };
    mockService.updateBranch.mockResolvedValue(success);

    const result = await updateBranchAction(
      "org-1",
      "branch-1",
      fd({ name: "Renamed" })
    );

    expect(mockService.updateBranch).toHaveBeenCalledWith(
      "branch-1",
      expect.objectContaining({ name: "Renamed" }),
      "org-1",
      "user-1"
    );
    expect(result).toBe(success);
    expect(revalidateMock).toHaveBeenCalledWith("/settings/branches");
    expect(logMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "branch.update",
        entityType: "branch",
      })
    );
  });

  it("does not audit-log when forbidden", async () => {
    authedAs("user-1");
    mockService.getOrganizationContext.mockResolvedValue(
      buildContext(["invoice.create"])
    );

    await updateBranchAction("org-1", "branch-1", fd({ name: "Renamed" }));

    expect(logMock).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────
// deleteBranchAction
// ─────────────────────────────────────────────────────────────

describe("deleteBranchAction", () => {
  it("returns forbidden when the user is not authenticated", async () => {
    unauthenticated();

    const result = await deleteBranchAction("org-1", "branch-1");

    expect(result).toEqual({
      success: false,
      error: { code: "forbidden", message: "Not authenticated" },
    });
    expect(mockService.deleteBranch).not.toHaveBeenCalled();
  });

  it("returns forbidden when the caller lacks the settings.branches permission", async () => {
    authedAs("user-1");
    mockService.getOrganizationContext.mockResolvedValue(
      buildContext(["invoice.create"])
    );

    const result = await deleteBranchAction("org-1", "branch-1");

    expect(result).toEqual({
      success: false,
      error: {
        code: "forbidden",
        message: "You do not have permission to manage branches",
      },
    });
    expect(mockService.deleteBranch).not.toHaveBeenCalled();
  });

  it("calls the service and revalidates on success", async () => {
    authedAs("user-1");
    mockService.getOrganizationContext.mockResolvedValue(
      buildContext(["settings.branches"])
    );
    const success: OrganizationActionResult<void> = {
      success: true,
      data: undefined,
    };
    mockService.deleteBranch.mockResolvedValue(success);

    const result = await deleteBranchAction("org-1", "branch-1");

    expect(mockService.deleteBranch).toHaveBeenCalledWith("branch-1", "user-1");
    expect(result).toBe(success);
    expect(revalidateMock).toHaveBeenCalledWith("/settings/branches");
    expect(logMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "branch.delete",
        entityType: "branch",
      })
    );
  });

  it("does not revalidate or audit-log when the service fails", async () => {
    authedAs("user-1");
    mockService.getOrganizationContext.mockResolvedValue(
      buildContext(["settings.branches"])
    );
    const failure: OrganizationActionResult<void> = {
      success: false,
      error: { code: "cannot_delete_headquarters", message: "no" },
    };
    mockService.deleteBranch.mockResolvedValue(failure);

    const result = await deleteBranchAction("org-1", "branch-1");

    expect(result).toBe(failure);
    expect(revalidateMock).not.toHaveBeenCalled();
    expect(logMock).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────
// switchOrganizationAction
// ─────────────────────────────────────────────────────────────

describe("switchOrganizationAction", () => {
  it("redirects to the dashboard with the org query param", async () => {
    await switchOrganizationAction("org-42");

    expect(redirectMock).toHaveBeenCalledWith("/dashboard?org=org-42");
  });
});
