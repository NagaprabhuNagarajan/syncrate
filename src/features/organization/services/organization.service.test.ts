import { describe, expect, it, vi, beforeEach } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type {
  Branch,
  Organization,
  OrganizationInvitation,
  OrganizationMember,
} from "@/features/organization/types/organization.types";
import { OrganizationService } from "./organization.service";

// ─────────────────────────────────────────────────────────────
// Mock the repository the service instantiates internally
// ─────────────────────────────────────────────────────────────

const { mockRepo } = vi.hoisted(() => ({
  mockRepo: {
    findBySlug: vi.fn(),
    create: vi.fn(),
    findById: vi.fn(),
    findAllForUser: vi.fn(),
    update: vi.fn(),
    findMember: vi.fn(),
    createMember: vi.fn(),
    findBranchById: vi.fn(),
    findBranchByCode: vi.fn(),
    createBranch: vi.fn(),
    updateBranch: vi.fn(),
    softDeleteBranch: vi.fn(),
    findUserPermissions: vi.fn(),
    findBranchesByOrg: vi.fn(),
    findRolesForOrg: vi.fn(),
    findMembersByOrg: vi.fn(),
    findMembersWithUser: vi.fn(),
    findRoleById: vi.fn(),
    createInvitation: vi.fn(),
    findInvitationByToken: vi.fn(),
    updateInvitationStatus: vi.fn(),
    findPendingInvitationsByOrg: vi.fn(),
  },
}));

vi.mock(
  "@/features/organization/repositories/organization.repository",
  () => ({
    OrganizationRepository: vi.fn(() => mockRepo),
  })
);

// ─────────────────────────────────────────────────────────────
// Builders
// ─────────────────────────────────────────────────────────────

function buildOrg(overrides: Partial<Organization> = {}): Organization {
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
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    createdBy: "user-1",
    ...overrides,
  };
}

function buildMember(
  overrides: Partial<OrganizationMember> = {}
): OrganizationMember {
  return {
    id: "member-1",
    organizationId: "org-1",
    userId: "user-1",
    roleId: "role-1",
    branchId: null,
    status: "active",
    invitedAt: null,
    joinedAt: null,
    invitedBy: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

function buildInvitation(
  overrides: Partial<OrganizationInvitation> = {}
): OrganizationInvitation {
  return {
    id: "inv-1",
    organizationId: "org-1",
    email: "new@example.com",
    fullName: null,
    roleId: "role-1",
    branchId: null,
    token: "tok-123",
    status: "pending",
    expiresAt: new Date("2999-01-01T00:00:00Z"),
    acceptedAt: null,
    acceptedBy: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    createdBy: "user-1",
    ...overrides,
  };
}

function buildBranch(overrides: Partial<Branch> = {}): Branch {
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
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

let service: OrganizationService;

beforeEach(() => {
  vi.clearAllMocks();
  service = new OrganizationService({} as unknown as AppSupabaseClient);
});

// ─────────────────────────────────────────────────────────────
// createOrganization
// ─────────────────────────────────────────────────────────────

describe("OrganizationService.createOrganization", () => {
  it("fails when the name produces an empty slug", async () => {
    const result = await service.createOrganization({ name: "!!!" }, "user-1");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("unknown");
    }
    expect(mockRepo.create).not.toHaveBeenCalled();
  });

  it("creates an organization with a clean slug when there is no conflict", async () => {
    mockRepo.findBySlug.mockResolvedValue(null);
    mockRepo.create.mockResolvedValue(buildOrg());

    const result = await service.createOrganization(
      { name: "Acme Co", gstNumber: "22aaaaa0000a1z5" },
      "user-1"
    );

    expect(result.success).toBe(true);
    const createArg = mockRepo.create.mock.calls[0]?.[0];
    expect(createArg.slug).toBe("acme-co");
    expect(createArg.gstNumber).toBe("22AAAAA0000A1Z5");
    expect(createArg.country).toBe("IN");
    expect(createArg.createdBy).toBe("user-1");
  });

  it("appends a unique suffix to the slug on conflict", async () => {
    mockRepo.findBySlug.mockResolvedValue(buildOrg());
    mockRepo.create.mockResolvedValue(buildOrg());

    await service.createOrganization({ name: "Acme Co" }, "user-1");

    const createArg = mockRepo.create.mock.calls[0]?.[0];
    expect(createArg.slug).not.toBe("acme-co");
    expect(createArg.slug.startsWith("acme-co-")).toBe(true);
  });

  it("fails when the repository create returns null", async () => {
    mockRepo.findBySlug.mockResolvedValue(null);
    mockRepo.create.mockResolvedValue(null);

    const result = await service.createOrganization(
      { name: "Acme Co" },
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("unknown");
    }
  });
});

// ─────────────────────────────────────────────────────────────
// getOrganization / listUserOrganizations
// ─────────────────────────────────────────────────────────────

describe("OrganizationService.getOrganization", () => {
  it("returns the organization when found", async () => {
    mockRepo.findById.mockResolvedValue(buildOrg());
    const result = await service.getOrganization("org-1");
    expect(result.success).toBe(true);
  });

  it("returns not_found when missing", async () => {
    mockRepo.findById.mockResolvedValue(null);
    const result = await service.getOrganization("missing");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
  });
});

describe("OrganizationService.listUserOrganizations", () => {
  it("delegates to the repository", async () => {
    const orgs = [buildOrg()];
    mockRepo.findAllForUser.mockResolvedValue(orgs);
    expect(await service.listUserOrganizations("user-1")).toBe(orgs);
    expect(mockRepo.findAllForUser).toHaveBeenCalledWith("user-1");
  });
});

// ─────────────────────────────────────────────────────────────
// updateOrganization
// ─────────────────────────────────────────────────────────────

describe("OrganizationService.updateOrganization", () => {
  it("maps provided fields (uppercasing GST) and sets updated_by", async () => {
    mockRepo.update.mockResolvedValue(buildOrg());

    const result = await service.updateOrganization(
      "org-1",
      { name: "New Name", gstNumber: "22aaaaa0000a1z5" },
      "user-1"
    );

    expect(result.success).toBe(true);
    const patch = mockRepo.update.mock.calls[0]?.[1];
    expect(patch.name).toBe("New Name");
    expect(patch.gst_number).toBe("22AAAAA0000A1Z5");
    expect(patch.updated_by).toBe("user-1");
  });

  it("returns not_found when the update fails", async () => {
    mockRepo.update.mockResolvedValue(null);
    const result = await service.updateOrganization("org-1", {}, "user-1");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
  });
});

// ─────────────────────────────────────────────────────────────
// getOrganizationContext
// ─────────────────────────────────────────────────────────────

describe("OrganizationService.getOrganizationContext", () => {
  it("returns null when the membership is missing", async () => {
    mockRepo.findById.mockResolvedValue(buildOrg());
    mockRepo.findMember.mockResolvedValue(null);
    expect(
      await service.getOrganizationContext("org-1", "user-1")
    ).toBeNull();
  });

  it("returns null when the organization is missing", async () => {
    mockRepo.findById.mockResolvedValue(null);
    mockRepo.findMember.mockResolvedValue(buildMember());
    expect(
      await service.getOrganizationContext("org-1", "user-1")
    ).toBeNull();
  });

  it("resolves the branch when the member has one assigned", async () => {
    mockRepo.findById.mockResolvedValue(buildOrg());
    mockRepo.findMember.mockResolvedValue(buildMember({ branchId: "br-1" }));
    mockRepo.findBranchById.mockResolvedValue({ id: "br-1" });
    mockRepo.findUserPermissions.mockResolvedValue(["invoice.create"]);

    const ctx = await service.getOrganizationContext("org-1", "user-1");
    expect(ctx?.branch).toEqual({ id: "br-1" });
    expect(ctx?.permissions).toEqual(["invoice.create"]);
    expect(mockRepo.findBranchById).toHaveBeenCalledWith("br-1");
  });

  it("returns a null branch when the member has none", async () => {
    mockRepo.findById.mockResolvedValue(buildOrg());
    mockRepo.findMember.mockResolvedValue(buildMember({ branchId: null }));
    mockRepo.findUserPermissions.mockResolvedValue([]);

    const ctx = await service.getOrganizationContext("org-1", "user-1");
    expect(ctx?.branch).toBeNull();
    expect(mockRepo.findBranchById).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────
// inviteUser
// ─────────────────────────────────────────────────────────────

describe("OrganizationService.inviteUser", () => {
  const input = { email: "new@example.com", roleId: "role-1" };

  it("fails when the role does not exist", async () => {
    mockRepo.findRoleById.mockResolvedValue(null);
    const result = await service.inviteUser(input, "org-1", "user-1");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
  });

  it("creates an invitation when no pending invitation exists for this email", async () => {
    mockRepo.findRoleById.mockResolvedValue({ id: "role-1" });
    // No pending invitations for this email yet.
    mockRepo.findPendingInvitationsByOrg.mockResolvedValue([]);
    mockRepo.createInvitation.mockResolvedValue(buildInvitation());

    const result = await service.inviteUser(input, "org-1", "user-1");
    expect(result.success).toBe(true);
    const arg = mockRepo.createInvitation.mock.calls[0]?.[0];
    expect(arg.organizationId).toBe("org-1");
    expect(arg.email).toBe("new@example.com");
    expect(arg.createdBy).toBe("user-1");
  });

  it("creates an invitation even when the org has other active members (different email)", async () => {
    mockRepo.findRoleById.mockResolvedValue({ id: "role-1" });
    // A pending invitation exists, but for a DIFFERENT email address.
    mockRepo.findPendingInvitationsByOrg.mockResolvedValue([
      buildInvitation({ email: "other@example.com" }),
    ]);
    mockRepo.createInvitation.mockResolvedValue(buildInvitation());

    // input.email is "new@example.com", which differs from "other@example.com".
    const result = await service.inviteUser(input, "org-1", "user-1");
    expect(result.success).toBe(true);
  });

  it("fails with already_member when a pending invitation already exists for this email", async () => {
    mockRepo.findRoleById.mockResolvedValue({ id: "role-1" });
    // A pending invitation already exists for the SAME email.
    mockRepo.findPendingInvitationsByOrg.mockResolvedValue([
      buildInvitation({ email: "new@example.com" }),
    ]);

    const result = await service.inviteUser(input, "org-1", "user-1");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("already_member");
    }
  });

  it("performs the email comparison case-insensitively", async () => {
    mockRepo.findRoleById.mockResolvedValue({ id: "role-1" });
    // Invitation stored with uppercase email.
    mockRepo.findPendingInvitationsByOrg.mockResolvedValue([
      buildInvitation({ email: "NEW@EXAMPLE.COM" }),
    ]);

    // input.email is lowercase "new@example.com" — should still match.
    const result = await service.inviteUser(input, "org-1", "user-1");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("already_member");
    }
  });

  it("fails when invitation creation returns null", async () => {
    mockRepo.findRoleById.mockResolvedValue({ id: "role-1" });
    // No pending invitation for this email, so the duplicate check passes.
    mockRepo.findPendingInvitationsByOrg.mockResolvedValue([]);
    mockRepo.createInvitation.mockResolvedValue(null);

    const result = await service.inviteUser(input, "org-1", "user-1");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("unknown");
    }
  });
});

// ─────────────────────────────────────────────────────────────
// acceptInvitation
// ─────────────────────────────────────────────────────────────

describe("OrganizationService.acceptInvitation", () => {
  it("fails when the invitation is not found", async () => {
    mockRepo.findInvitationByToken.mockResolvedValue(null);
    const result = await service.acceptInvitation("tok", "user-1");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
  });

  it("fails when the invitation status is expired", async () => {
    mockRepo.findInvitationByToken.mockResolvedValue(
      buildInvitation({ status: "expired" })
    );
    const result = await service.acceptInvitation("tok", "user-1");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("invitation_expired");
    }
  });

  it("fails when the invitation was already used", async () => {
    mockRepo.findInvitationByToken.mockResolvedValue(
      buildInvitation({ status: "accepted" })
    );
    const result = await service.acceptInvitation("tok", "user-1");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("invitation_already_used");
    }
  });

  it("expires a pending-but-past-due invitation", async () => {
    mockRepo.findInvitationByToken.mockResolvedValue(
      buildInvitation({ expiresAt: new Date("2000-01-01T00:00:00Z") })
    );
    mockRepo.updateInvitationStatus.mockResolvedValue(true);

    const result = await service.acceptInvitation("tok", "user-1");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("invitation_expired");
    }
    expect(mockRepo.updateInvitationStatus).toHaveBeenCalledWith(
      "inv-1",
      "expired"
    );
  });

  it("creates the membership then marks the invitation accepted", async () => {
    mockRepo.findInvitationByToken.mockResolvedValue(
      buildInvitation({ roleId: "role-9", branchId: "branch-9" })
    );
    mockRepo.findById.mockResolvedValue(buildOrg());
    mockRepo.findMember.mockResolvedValue(null);
    mockRepo.createMember.mockResolvedValue(buildMember());
    mockRepo.updateInvitationStatus.mockResolvedValue(buildInvitation());

    const result = await service.acceptInvitation("tok", "user-1");
    expect(result.success).toBe(true);

    const memberArg = mockRepo.createMember.mock.calls[0]?.[0];
    expect(memberArg.organizationId).toBe("org-1");
    expect(memberArg.userId).toBe("user-1");
    expect(memberArg.roleId).toBe("role-9");
    expect(memberArg.branchId).toBe("branch-9");
    expect(memberArg.createdBy).toBe("user-1");

    expect(mockRepo.updateInvitationStatus).toHaveBeenCalledWith(
      "inv-1",
      "accepted",
      expect.objectContaining({ accepted_by: "user-1" })
    );
  });

  it("skips creating a membership when the user is already a member", async () => {
    mockRepo.findInvitationByToken.mockResolvedValue(buildInvitation());
    mockRepo.findById.mockResolvedValue(buildOrg());
    mockRepo.findMember.mockResolvedValue(buildMember());
    mockRepo.updateInvitationStatus.mockResolvedValue(buildInvitation());

    const result = await service.acceptInvitation("tok", "user-1");
    expect(result.success).toBe(true);
    expect(mockRepo.createMember).not.toHaveBeenCalled();
    expect(mockRepo.updateInvitationStatus).toHaveBeenCalledWith(
      "inv-1",
      "accepted",
      expect.objectContaining({ accepted_by: "user-1" })
    );
  });

  it("fails with unknown when the membership cannot be created", async () => {
    mockRepo.findInvitationByToken.mockResolvedValue(buildInvitation());
    mockRepo.findById.mockResolvedValue(buildOrg());
    mockRepo.findMember.mockResolvedValue(null);
    mockRepo.createMember.mockResolvedValue(null);

    const result = await service.acceptInvitation("tok", "user-1");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("unknown");
    }
    expect(mockRepo.updateInvitationStatus).not.toHaveBeenCalled();
  });

  it("fails when the org is gone after acceptance", async () => {
    mockRepo.findInvitationByToken.mockResolvedValue(buildInvitation());
    mockRepo.findById.mockResolvedValue(null);

    const result = await service.acceptInvitation("tok", "user-1");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
  });
});

// ─────────────────────────────────────────────────────────────
// Branches
// ─────────────────────────────────────────────────────────────

describe("OrganizationService.getBranch", () => {
  it("returns the branch when found", async () => {
    mockRepo.findBranchById.mockResolvedValue(buildBranch());
    const result = await service.getBranch("branch-1");
    expect(result.success).toBe(true);
  });

  it("returns not_found when the branch is missing", async () => {
    mockRepo.findBranchById.mockResolvedValue(null);
    const result = await service.getBranch("missing");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
  });
});

describe("OrganizationService.createBranch", () => {
  const input = { name: "  Second  ", code: "sec1", gstNumber: "22aaaaa0000a1z5" };

  it("fails with duplicate_code when the code is already taken", async () => {
    mockRepo.findBranchByCode.mockResolvedValue(buildBranch());
    const result = await service.createBranch(input, "org-1", "user-1");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("duplicate_code");
    }
    expect(mockRepo.createBranch).not.toHaveBeenCalled();
  });

  it("maps fields, trims the name, and creates the branch", async () => {
    mockRepo.findBranchByCode.mockResolvedValue(null);
    mockRepo.createBranch.mockResolvedValue(buildBranch());

    const result = await service.createBranch(input, "org-1", "user-1");
    expect(result.success).toBe(true);

    const arg = mockRepo.createBranch.mock.calls[0]?.[0];
    expect(arg.organizationId).toBe("org-1");
    expect(arg.name).toBe("Second");
    expect(arg.gstNumber).toBe("22AAAAA0000A1Z5");
    expect(arg.createdBy).toBe("user-1");
  });

  it("fails with unknown when the repository returns null", async () => {
    mockRepo.findBranchByCode.mockResolvedValue(null);
    mockRepo.createBranch.mockResolvedValue(null);

    const result = await service.createBranch(input, "org-1", "user-1");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("unknown");
    }
  });
});

describe("OrganizationService.updateBranch", () => {
  it("fails with duplicate_code when the new code belongs to a different branch", async () => {
    mockRepo.findBranchByCode.mockResolvedValue(buildBranch({ id: "other" }));

    const result = await service.updateBranch(
      "branch-1",
      { code: "DUP" },
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("duplicate_code");
    }
    expect(mockRepo.updateBranch).not.toHaveBeenCalled();
  });

  it("allows updating to a code owned by the same branch", async () => {
    mockRepo.findBranchByCode.mockResolvedValue(buildBranch({ id: "branch-1" }));
    mockRepo.updateBranch.mockResolvedValue(buildBranch({ id: "branch-1" }));

    const result = await service.updateBranch(
      "branch-1",
      { code: "hq01", name: "New Name" },
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(true);

    const patch = mockRepo.updateBranch.mock.calls[0]?.[1];
    expect(patch.code).toBe("HQ01");
    expect(patch.name).toBe("New Name");
    expect(mockRepo.updateBranch.mock.calls[0]?.[2]).toBe("user-1");
  });

  it("updates without a duplicate check when the code is not provided", async () => {
    mockRepo.updateBranch.mockResolvedValue(buildBranch());

    const result = await service.updateBranch(
      "branch-1",
      { name: "Renamed" },
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(true);
    expect(mockRepo.findBranchByCode).not.toHaveBeenCalled();
  });

  it("returns not_found when the repository update returns null", async () => {
    mockRepo.updateBranch.mockResolvedValue(null);

    const result = await service.updateBranch(
      "branch-1",
      { name: "Renamed" },
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
  });
});

describe("OrganizationService.deleteBranch", () => {
  it("returns not_found when the branch is missing", async () => {
    mockRepo.findBranchById.mockResolvedValue(null);
    const result = await service.deleteBranch("branch-1", "user-1");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
    expect(mockRepo.softDeleteBranch).not.toHaveBeenCalled();
  });

  it("refuses to delete the headquarters branch", async () => {
    mockRepo.findBranchById.mockResolvedValue(
      buildBranch({ isHeadquarters: true })
    );
    const result = await service.deleteBranch("branch-1", "user-1");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("cannot_delete_headquarters");
    }
    expect(mockRepo.softDeleteBranch).not.toHaveBeenCalled();
  });

  it("fails with unknown when the soft delete fails", async () => {
    mockRepo.findBranchById.mockResolvedValue(buildBranch());
    mockRepo.softDeleteBranch.mockResolvedValue(false);

    const result = await service.deleteBranch("branch-1", "user-1");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("unknown");
    }
  });

  it("succeeds when the branch is soft deleted", async () => {
    mockRepo.findBranchById.mockResolvedValue(buildBranch());
    mockRepo.softDeleteBranch.mockResolvedValue(true);

    const result = await service.deleteBranch("branch-1", "user-1");
    expect(result.success).toBe(true);
    expect(mockRepo.softDeleteBranch).toHaveBeenCalledWith("branch-1", "user-1");
  });
});

describe("OrganizationService.listMembersWithUser", () => {
  it("delegates to the repository", async () => {
    const members = ["member-with-user"];
    mockRepo.findMembersWithUser.mockResolvedValue(members);
    expect(await service.listMembersWithUser("org-1")).toBe(members);
    expect(mockRepo.findMembersWithUser).toHaveBeenCalledWith("org-1");
  });
});

// ─────────────────────────────────────────────────────────────
// cancelInvitation / listings
// ─────────────────────────────────────────────────────────────

describe("OrganizationService.cancelInvitation", () => {
  it("succeeds when the invitation is cancelled", async () => {
    mockRepo.updateInvitationStatus.mockResolvedValue(true);
    const result = await service.cancelInvitation("inv-1", "user-1");
    expect(result.success).toBe(true);
  });

  it("fails when the invitation cannot be cancelled", async () => {
    mockRepo.updateInvitationStatus.mockResolvedValue(false);
    const result = await service.cancelInvitation("inv-1", "user-1");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
  });
});

describe("OrganizationService listing delegations", () => {
  it("lists branches, roles, members, and pending invitations via the repo", async () => {
    mockRepo.findBranchesByOrg.mockResolvedValue(["branch"]);
    mockRepo.findRolesForOrg.mockResolvedValue(["role"]);
    mockRepo.findMembersByOrg.mockResolvedValue(["member"]);
    mockRepo.findPendingInvitationsByOrg.mockResolvedValue(["inv"]);

    expect(await service.listBranches("org-1")).toEqual(["branch"]);
    expect(await service.listRoles("org-1")).toEqual(["role"]);
    expect(await service.listMembers("org-1")).toEqual(["member"]);
    expect(await service.listPendingInvitations("org-1")).toEqual(["inv"]);
  });
});
