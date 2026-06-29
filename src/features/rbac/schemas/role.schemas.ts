import { z } from "zod";

// ─────────────────────────────────────────────────────────────
// Reusable validators
// ─────────────────────────────────────────────────────────────

const roleName = z
  .string({ required_error: "Role name is required" })
  .trim()
  .min(2, "Role name must be at least 2 characters")
  .max(50, "Role name must be 50 characters or less");

const roleDescription = z
  .string()
  .trim()
  .max(255, "Description must be 255 characters or less")
  .optional()
  .or(z.literal(""));

const permissionIds = z
  .array(z.string().uuid("Invalid permission id"))
  .max(500, "Too many permissions selected");

// ─────────────────────────────────────────────────────────────
// Create / Update role
// ─────────────────────────────────────────────────────────────

export const createRoleSchema = z.object({
  name: roleName,
  description: roleDescription,
  permissionIds: permissionIds.optional(),
});

export type CreateRoleFormValues = z.infer<typeof createRoleSchema>;

export const updateRoleSchema = z.object({
  name: roleName.optional(),
  description: roleDescription,
  version: z.coerce
    .number({ invalid_type_error: "Version must be a number" })
    .int("Version must be a whole number")
    .min(1, "Version must be at least 1"),
});

export type UpdateRoleFormValues = z.infer<typeof updateRoleSchema>;

// ─────────────────────────────────────────────────────────────
// Permission assignment
// ─────────────────────────────────────────────────────────────

export const assignPermissionsSchema = z.object({
  permissionIds,
});

export type AssignPermissionsFormValues = z.infer<
  typeof assignPermissionsSchema
>;
