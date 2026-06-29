export { RolesView, RoleFormDialog } from "@/features/rbac/components";
export { RoleService } from "@/features/rbac/services/role.service";
export { RoleRepository } from "@/features/rbac/repositories/role.repository";
export {
  createRoleAction,
  updateRoleAction,
  deleteRoleAction,
  assignPermissionsAction,
} from "@/features/rbac/actions/role.actions";
export type {
  Role,
  RoleWithPermissions,
  Permission,
  PermissionGroup,
  CreateRoleInput,
  UpdateRoleInput,
  RoleActionResult,
  RoleError,
  RoleErrorCode,
} from "@/features/rbac/types/rbac.types";
