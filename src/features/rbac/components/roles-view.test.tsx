import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@/tests/utils";
import { RolesView } from "./roles-view";
import type {
  Permission,
  RoleWithPermissions,
} from "@/features/rbac/types/rbac.types";

const { mockRefresh, deleteActionMock } = vi.hoisted(() => ({
  mockRefresh: vi.fn(),
  deleteActionMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: mockRefresh }),
}));

vi.mock("@/features/rbac/actions/role.actions", () => ({
  createRoleAction: vi.fn(),
  updateRoleAction: vi.fn(),
  deleteRoleAction: deleteActionMock,
  assignPermissionsAction: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

function makeRole(
  overrides: Partial<RoleWithPermissions> = {}
): RoleWithPermissions {
  return {
    id: "role-1",
    organizationId: "org-1",
    name: "Sales Manager",
    description: "Manages sales",
    isSystem: false,
    version: 1,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    createdBy: "user-1",
    permissionIds: ["perm-1"],
    ...overrides,
  };
}

const permissions: Permission[] = [
  {
    id: "perm-1",
    module: "customer",
    action: "create",
    name: "customer.create",
    description: "Create customers",
  },
  {
    id: "perm-2",
    module: "customer",
    action: "view",
    name: "customer.view",
    description: "View customers",
  },
];

describe("RolesView", () => {
  it("renders the heading and a create button when canManage", () => {
    render(
      <RolesView
        organizationId="org-1"
        roles={[makeRole()]}
        permissions={permissions}
        canManage
      />
    );
    expect(
      screen.getByRole("heading", { name: /roles & permissions/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /create role/i })
    ).toBeInTheDocument();
    expect(screen.getByText("Sales Manager")).toBeInTheDocument();
  });

  it("distinguishes system roles from custom roles", () => {
    render(
      <RolesView
        organizationId="org-1"
        roles={[
          makeRole({ id: "r1" }),
          makeRole({
            id: "r2",
            name: "Owner",
            isSystem: true,
            organizationId: null,
          }),
        ]}
        permissions={permissions}
        canManage
      />
    );
    expect(screen.getByText("System")).toBeInTheDocument();
    expect(screen.getByText("Custom")).toBeInTheDocument();
    // System roles cannot be edited.
    expect(screen.getByText("Read-only")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /edit owner/i })
    ).not.toBeInTheDocument();
  });

  it("hides management controls when the user cannot manage", () => {
    render(
      <RolesView
        organizationId="org-1"
        roles={[makeRole()]}
        permissions={permissions}
        canManage={false}
      />
    );
    expect(
      screen.queryByRole("button", { name: /create role/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /edit sales manager/i })
    ).not.toBeInTheDocument();
  });

  it("renders an empty state when there are no roles", () => {
    render(
      <RolesView
        organizationId="org-1"
        roles={[]}
        permissions={permissions}
        canManage
      />
    );
    expect(screen.getByText(/no roles found/i)).toBeInTheDocument();
  });

  it("opens the create dialog when create role is clicked", async () => {
    const user = userEvent.setup();
    render(
      <RolesView
        organizationId="org-1"
        roles={[makeRole()]}
        permissions={permissions}
        canManage
      />
    );
    await user.click(screen.getByRole("button", { name: /create role/i }));
    expect(
      screen.getByRole("dialog", { name: /create role/i })
    ).toBeInTheDocument();
  });

  it("opens a delete confirmation for a custom role", async () => {
    const user = userEvent.setup();
    render(
      <RolesView
        organizationId="org-1"
        roles={[makeRole()]}
        permissions={permissions}
        canManage
      />
    );
    await user.click(
      screen.getByRole("button", { name: /delete sales manager/i })
    );
    expect(
      screen.getByRole("dialog", { name: /delete role/i })
    ).toBeInTheDocument();
  });
});
