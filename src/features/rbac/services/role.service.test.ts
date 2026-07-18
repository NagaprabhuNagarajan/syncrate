import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Role } from "@/features/rbac/types/rbac.types";
import { RoleService } from "./role.service";

const { mockRepo } = vi.hoisted(() => ({
  mockRepo: {
    listRoles: vi.fn(),
    findById: vi.fn(),
    findByName: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    touch: vi.fn(),
    softDelete: vi.fn(),
    listPermissions: vi.fn(),
    listPermissionIdsByRoles: vi.fn(),
    replacePermissions: vi.fn(),
  },
}));

vi.mock("@/features/rbac/repositories/role.repository", () => ({
  RoleRepository: vi.fn(() => mockRepo),
}));

function buildRole(overrides: Partial<Role> = {}): Role {
  return {
    id: "role-1",
    organizationId: "org-1",
    name: "Sales Manager",
    description: "Manages sales",
    isSystem: false,
    version: 1,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    createdBy: "user-1",
    ...overrides,
  };
}

let service: RoleService;

beforeEach(() => {
  vi.clearAllMocks();
  service = new RoleService({} as unknown as AppSupabaseClient);
});

describe("RoleService.listRolesWithPermissions", () => {
  it("merges roles with their assigned permission ids", async () => {
    mockRepo.listRoles.mockResolvedValue([
      buildRole({ id: "role-1" }),
      buildRole({ id: "role-2", isSystem: true, organizationId: null }),
    ]);
    mockRepo.listPermissionIdsByRoles.mockResolvedValue({
      "role-1": ["perm-a", "perm-b"],
    });

    const result = await service.listRolesWithPermissions("org-1");

    expect(mockRepo.listPermissionIdsByRoles).toHaveBeenCalledWith([
      "role-1",
      "role-2",
    ]);
    expect(result[0]?.permissionIds).toEqual(["perm-a", "perm-b"]);
    expect(result[1]?.permissionIds).toEqual([]);
  });
});

describe("RoleService.listPermissions", () => {
  it("delegates to the repository", async () => {
    mockRepo.listPermissions.mockResolvedValue([]);
    await service.listPermissions();
    expect(mockRepo.listPermissions).toHaveBeenCalled();
  });
});

describe("RoleService.getRole", () => {
  it("returns not_found when the role is missing", async () => {
    mockRepo.findById.mockResolvedValue(null);
    const result = await service.getRole("missing");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
  });
});

describe("RoleService.createRole", () => {
  it("rejects a duplicate name", async () => {
    mockRepo.findByName.mockResolvedValue(buildRole());
    const result = await service.createRole(
      { name: "Sales Manager" },
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("duplicate_name");
    }
    expect(mockRepo.create).not.toHaveBeenCalled();
  });

  it("creates a custom role and assigns permissions", async () => {
    mockRepo.findByName.mockResolvedValue(null);
    mockRepo.create.mockResolvedValue(buildRole({ id: "role-9" }));
    mockRepo.replacePermissions.mockResolvedValue(true);

    const result = await service.createRole(
      { name: "  Sales Manager  ", description: "  desc  ", permissionIds: ["p1", "p2"] },
      "org-1",
      "user-1"
    );

    expect(result.success).toBe(true);
    const insertArg = mockRepo.create.mock.calls[0][0] as Record<string, unknown>;
    expect(insertArg.name).toBe("Sales Manager");
    expect(insertArg.description).toBe("desc");
    expect(insertArg.is_system).toBe(false);
    expect(insertArg.organization_id).toBe("org-1");
    expect(insertArg.created_by).toBe("user-1");
    expect(mockRepo.replacePermissions).toHaveBeenCalledWith(
      "role-9",
      ["p1", "p2"],
      "user-1"
    );
    if (result.success) {
      expect(result.data.permissionIds).toEqual(["p1", "p2"]);
    }
  });

  it("does not assign permissions when none are provided", async () => {
    mockRepo.findByName.mockResolvedValue(null);
    mockRepo.create.mockResolvedValue(buildRole());
    const result = await service.createRole(
      { name: "Viewer" },
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(true);
    expect(mockRepo.replacePermissions).not.toHaveBeenCalled();
  });

  it("returns unknown when creation fails", async () => {
    mockRepo.findByName.mockResolvedValue(null);
    mockRepo.create.mockResolvedValue(null);
    const result = await service.createRole(
      { name: "Viewer" },
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("unknown");
    }
  });

  it("returns unknown when permission assignment fails", async () => {
    mockRepo.findByName.mockResolvedValue(null);
    mockRepo.create.mockResolvedValue(buildRole());
    mockRepo.replacePermissions.mockResolvedValue(false);
    const result = await service.createRole(
      { name: "Viewer", permissionIds: ["p1"] },
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("unknown");
    }
  });
});

describe("RoleService.updateRole", () => {
  it("blocks editing a system role", async () => {
    mockRepo.findById.mockResolvedValue(
      buildRole({ isSystem: true, organizationId: null })
    );
    const result = await service.updateRole(
      "role-1",
      { name: "Hacked", version: 1 },
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("system_role");
    }
    expect(mockRepo.update).not.toHaveBeenCalled();
  });

  it("blocks editing a role from another organization", async () => {
    mockRepo.findById.mockResolvedValue(
      buildRole({ organizationId: "org-other" })
    );
    const result = await service.updateRole(
      "role-1",
      { name: "X", version: 1 },
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("forbidden");
    }
  });

  it("returns not_found when the role does not exist", async () => {
    mockRepo.findById.mockResolvedValue(null);
    const result = await service.updateRole(
      "role-1",
      { name: "X", version: 1 },
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
  });

  it("rejects a duplicate name held by another role", async () => {
    mockRepo.findById.mockResolvedValue(buildRole());
    mockRepo.findByName.mockResolvedValue(buildRole({ id: "role-other" }));
    const result = await service.updateRole(
      "role-1",
      { name: "Taken", version: 1 },
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("duplicate_name");
    }
    expect(mockRepo.update).not.toHaveBeenCalled();
  });

  it("returns conflict when the optimistic lock fails", async () => {
    mockRepo.findById.mockResolvedValue(buildRole());
    mockRepo.findByName.mockResolvedValue(null);
    mockRepo.update.mockResolvedValue(null);
    const result = await service.updateRole(
      "role-1",
      { name: "Renamed", version: 1 },
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("conflict");
    }
  });

  it("forwards the expected version and updates successfully", async () => {
    mockRepo.findById.mockResolvedValue(buildRole({ version: 3 }));
    mockRepo.findByName.mockResolvedValue(null);
    mockRepo.update.mockResolvedValue(buildRole({ name: "Renamed", version: 4 }));
    const result = await service.updateRole(
      "role-1",
      { name: "Renamed", description: "", version: 3 },
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(true);
    expect(mockRepo.update).toHaveBeenCalledWith(
      "role-1",
      { name: "Renamed", description: null },
      "user-1",
      3
    );
  });
});

describe("RoleService.deleteRole", () => {
  it("blocks deleting a system role", async () => {
    mockRepo.findById.mockResolvedValue(
      buildRole({ isSystem: true, organizationId: null })
    );
    const result = await service.deleteRole("role-1", "org-1", "user-1");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("system_role");
    }
    expect(mockRepo.softDelete).not.toHaveBeenCalled();
  });

  it("soft-deletes a custom role", async () => {
    mockRepo.findById.mockResolvedValue(buildRole());
    mockRepo.softDelete.mockResolvedValue(true);
    const result = await service.deleteRole("role-1", "org-1", "user-1");
    expect(result.success).toBe(true);
    expect(mockRepo.softDelete).toHaveBeenCalledWith("role-1", "user-1");
  });

  it("returns unknown when soft delete fails", async () => {
    mockRepo.findById.mockResolvedValue(buildRole());
    mockRepo.softDelete.mockResolvedValue(false);
    const result = await service.deleteRole("role-1", "org-1", "user-1");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("unknown");
    }
  });
});

describe("RoleService.assignPermissions", () => {
  it("blocks assigning to the Owner system role", async () => {
    mockRepo.findById.mockResolvedValue(
      buildRole({ isSystem: true, name: "Owner", organizationId: "org-1" })
    );
    const result = await service.assignPermissions(
      "role-1",
      ["p1"],
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("system_role");
    }
    expect(mockRepo.replacePermissions).not.toHaveBeenCalled();
  });

  it("blocks assigning to a role from another organization", async () => {
    mockRepo.findById.mockResolvedValue(
      buildRole({ isSystem: true, name: "Accountant", organizationId: null })
    );
    const result = await service.assignPermissions(
      "role-1",
      ["p1"],
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("forbidden");
    }
    expect(mockRepo.replacePermissions).not.toHaveBeenCalled();
  });

  it("allows assigning permissions to a non-Owner system role", async () => {
    mockRepo.findById.mockResolvedValue(
      buildRole({ isSystem: true, name: "Accountant", organizationId: "org-1" })
    );
    mockRepo.replacePermissions.mockResolvedValue(true);
    mockRepo.touch.mockResolvedValue(null);
    const result = await service.assignPermissions(
      "role-1",
      ["p1", "p2"],
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(true);
    expect(mockRepo.replacePermissions).toHaveBeenCalledWith(
      "role-1",
      ["p1", "p2"],
      "user-1"
    );
  });

  it("replaces permissions and returns the new set", async () => {
    mockRepo.findById.mockResolvedValue(buildRole());
    mockRepo.replacePermissions.mockResolvedValue(true);
    mockRepo.touch.mockResolvedValue(buildRole({ version: 2 }));
    const result = await service.assignPermissions(
      "role-1",
      ["p1", "p2"],
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(true);
    expect(mockRepo.replacePermissions).toHaveBeenCalledWith(
      "role-1",
      ["p1", "p2"],
      "user-1"
    );
    if (result.success) {
      expect(result.data.permissionIds).toEqual(["p1", "p2"]);
    }
  });

  it("returns unknown when the replace fails", async () => {
    mockRepo.findById.mockResolvedValue(buildRole());
    mockRepo.replacePermissions.mockResolvedValue(false);
    const result = await service.assignPermissions(
      "role-1",
      ["p1"],
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("unknown");
    }
  });
});
