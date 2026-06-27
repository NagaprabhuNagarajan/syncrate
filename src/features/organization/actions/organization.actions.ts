"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { AuditService } from "@/features/audit/services/audit.service";
import {
  createOrganizationSchema,
  updateOrganizationSchema,
  inviteUserSchema,
  createBranchSchema,
  updateBranchSchema,
} from "@/features/organization/schemas/organization.schemas";
import type {
  Organization,
  Branch,
  OrganizationActionResult,
  OrganizationInvitation,
} from "@/features/organization/types/organization.types";

// ─────────────────────────────────────────────────────────────
// Create Organization
// ─────────────────────────────────────────────────────────────

export async function createOrganizationAction(
  formData: FormData
): Promise<OrganizationActionResult<Organization>> {
  const raw = {
    name: formData.get("name"),
    businessType: formData.get("businessType") || undefined,
    gstNumber: formData.get("gstNumber") || undefined,
    phone: formData.get("phone") || undefined,
    email: formData.get("email") || undefined,
    city: formData.get("city") || undefined,
    state: formData.get("state") || undefined,
    country: formData.get("country") || "IN",
    pincode: formData.get("pincode") || undefined,
    addressLine1: formData.get("addressLine1") || undefined,
  };

  const parsed = createOrganizationSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: {
        code: "unknown",
        message: parsed.error.errors[0]?.message ?? "Invalid input",
      },
    };
  }

  const supabase = await createServerSupabaseClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    return {
      success: false,
      error: { code: "forbidden", message: "Not authenticated" },
    };
  }

  const service = new OrganizationService(supabase);
  const result = await service.createOrganization(
    parsed.data,
    authData.user.id
  );

  if (!result.success) {
    return result;
  }

  await new AuditService(supabase).log({
    organizationId: result.data.id,
    actorUserId: authData.user.id,
    action: "organization.create",
    entityType: "organization",
    entityId: result.data.id,
    summary: `Created organization "${parsed.data.name}"`,
  });

  redirect(`/dashboard`);
}

// ─────────────────────────────────────────────────────────────
// Update Organization
// ─────────────────────────────────────────────────────────────

export async function updateOrganizationAction(
  organizationId: string,
  formData: FormData
): Promise<OrganizationActionResult<Organization>> {
  const raw = {
    name: formData.get("name") || undefined,
    displayName: formData.get("displayName") || undefined,
    businessType: formData.get("businessType") || undefined,
    gstNumber: formData.get("gstNumber") || undefined,
    panNumber: formData.get("panNumber") || undefined,
    cinNumber: formData.get("cinNumber") || undefined,
    phone: formData.get("phone") || undefined,
    email: formData.get("email") || undefined,
    website: formData.get("website") || undefined,
    addressLine1: formData.get("addressLine1") || undefined,
    addressLine2: formData.get("addressLine2") || undefined,
    city: formData.get("city") || undefined,
    state: formData.get("state") || undefined,
    country: formData.get("country") || undefined,
    pincode: formData.get("pincode") || undefined,
  };

  const parsed = updateOrganizationSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: {
        code: "unknown",
        message: parsed.error.errors[0]?.message ?? "Invalid input",
      },
    };
  }

  const supabase = await createServerSupabaseClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    return {
      success: false,
      error: { code: "forbidden", message: "Not authenticated" },
    };
  }

  const service = new OrganizationService(supabase);
  const result = await service.updateOrganization(
    organizationId,
    parsed.data,
    authData.user.id
  );

  if (result.success) {
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: authData.user.id,
      action: "organization.update",
      entityType: "organization",
      entityId: organizationId,
      summary: `Updated organization "${result.data.name}"`,
    });
  }

  return result;
}

// ─────────────────────────────────────────────────────────────
// Invite User
// ─────────────────────────────────────────────────────────────

export async function inviteUserAction(
  organizationId: string,
  formData: FormData
): Promise<OrganizationActionResult<OrganizationInvitation>> {
  const raw = {
    email: formData.get("email"),
    fullName: formData.get("fullName") || undefined,
    roleId: formData.get("roleId"),
    branchId: formData.get("branchId") || undefined,
  };

  const parsed = inviteUserSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: {
        code: "unknown",
        message: parsed.error.errors[0]?.message ?? "Invalid input",
      },
    };
  }

  const supabase = await createServerSupabaseClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    return {
      success: false,
      error: { code: "forbidden", message: "Not authenticated" },
    };
  }

  const service = new OrganizationService(supabase);

  const context = await service.getOrganizationContext(
    organizationId,
    authData.user.id
  );
  if (!context) {
    return {
      success: false,
      error: {
        code: "forbidden",
        message: "You do not have access to this organization",
      },
    };
  }

  if (!context.permissions.includes("settings.users")) {
    return {
      success: false,
      error: {
        code: "forbidden",
        message: "You do not have permission to invite users",
      },
    };
  }

  const result = await service.inviteUser(
    parsed.data,
    organizationId,
    authData.user.id
  );

  if (result.success) {
    revalidatePath("/settings/team");
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: authData.user.id,
      action: "invitation.create",
      entityType: "invitation",
      entityId: result.data.id,
      summary: `Invited ${parsed.data.email}`,
    });
  }

  return result;
}

// ─────────────────────────────────────────────────────────────
// Cancel Invitation
// ─────────────────────────────────────────────────────────────

export async function cancelInvitationAction(
  invitationId: string,
  organizationId: string
): Promise<OrganizationActionResult<void>> {
  const supabase = await createServerSupabaseClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    return {
      success: false,
      error: { code: "forbidden", message: "Not authenticated" },
    };
  }

  const service = new OrganizationService(supabase);

  // Verify caller is member of the org
  const context = await service.getOrganizationContext(
    organizationId,
    authData.user.id
  );
  if (!context) {
    return {
      success: false,
      error: {
        code: "forbidden",
        message: "You do not have access to this organization",
      },
    };
  }

  if (!context.permissions.includes("settings.users")) {
    return {
      success: false,
      error: {
        code: "forbidden",
        message: "You do not have permission to manage invitations",
      },
    };
  }

  const result = await service.cancelInvitation(
    invitationId,
    authData.user.id
  );

  if (result.success) {
    revalidatePath("/settings/team");
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: authData.user.id,
      action: "invitation.cancel",
      entityType: "invitation",
      entityId: invitationId,
      summary: "Cancelled invitation",
    });
  }

  return result;
}

// ─────────────────────────────────────────────────────────────
// Accept Invitation
// ─────────────────────────────────────────────────────────────

export async function acceptInvitationAction(
  token: string
): Promise<OrganizationActionResult<Organization>> {
  const supabase = await createServerSupabaseClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    return {
      success: false,
      error: { code: "forbidden", message: "Not authenticated" },
    };
  }

  const service = new OrganizationService(supabase);
  const result = await service.acceptInvitation(token, authData.user.id);

  if (result.success) {
    revalidatePath("/dashboard");
    revalidatePath("/select-organization");
    await new AuditService(supabase).log({
      organizationId: result.data.id,
      actorUserId: authData.user.id,
      action: "invitation.accept",
      entityType: "invitation",
      entityId: null,
      summary: "Accepted invitation",
    });
  }

  return result;
}

// ─────────────────────────────────────────────────────────────
// Branch Management
// ─────────────────────────────────────────────────────────────

async function authorizeBranchManagement(
  service: OrganizationService,
  organizationId: string,
  userId: string
): Promise<OrganizationActionResult<void>> {
  const context = await service.getOrganizationContext(organizationId, userId);
  if (!context) {
    return {
      success: false,
      error: {
        code: "forbidden",
        message: "You do not have access to this organization",
      },
    };
  }

  if (!context.permissions.includes("settings.branches")) {
    return {
      success: false,
      error: {
        code: "forbidden",
        message: "You do not have permission to manage branches",
      },
    };
  }

  return { success: true, data: undefined };
}

export async function createBranchAction(
  organizationId: string,
  formData: FormData
): Promise<OrganizationActionResult<Branch>> {
  const raw = {
    name: formData.get("name"),
    code: formData.get("code"),
    isHeadquarters: formData.get("isHeadquarters") === "on",
    phone: formData.get("phone") || undefined,
    email: formData.get("email") || undefined,
    addressLine1: formData.get("addressLine1") || undefined,
    addressLine2: formData.get("addressLine2") || undefined,
    city: formData.get("city") || undefined,
    state: formData.get("state") || undefined,
    pincode: formData.get("pincode") || undefined,
    gstNumber: formData.get("gstNumber") || undefined,
  };

  const parsed = createBranchSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: {
        code: "unknown",
        message: parsed.error.errors[0]?.message ?? "Invalid input",
      },
    };
  }

  const supabase = await createServerSupabaseClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) {
    return {
      success: false,
      error: { code: "forbidden", message: "Not authenticated" },
    };
  }

  const service = new OrganizationService(supabase);
  const auth = await authorizeBranchManagement(
    service,
    organizationId,
    authData.user.id
  );
  if (!auth.success) {
    return auth;
  }

  const result = await service.createBranch(
    parsed.data,
    organizationId,
    authData.user.id
  );

  if (result.success) {
    revalidatePath("/settings/branches");
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: authData.user.id,
      action: "branch.create",
      entityType: "branch",
      entityId: result.data.id,
      summary: `Created branch "${parsed.data.name}" (${parsed.data.code})`,
    });
  }

  return result;
}

export async function updateBranchAction(
  organizationId: string,
  branchId: string,
  formData: FormData
): Promise<OrganizationActionResult<Branch>> {
  const raw = {
    name: formData.get("name") || undefined,
    code: formData.get("code") || undefined,
    isHeadquarters: formData.has("isHeadquarters")
      ? formData.get("isHeadquarters") === "on"
      : undefined,
    phone: formData.get("phone") || undefined,
    email: formData.get("email") || undefined,
    addressLine1: formData.get("addressLine1") || undefined,
    addressLine2: formData.get("addressLine2") || undefined,
    city: formData.get("city") || undefined,
    state: formData.get("state") || undefined,
    pincode: formData.get("pincode") || undefined,
    gstNumber: formData.get("gstNumber") || undefined,
    status: formData.get("status") || undefined,
  };

  const parsed = updateBranchSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: {
        code: "unknown",
        message: parsed.error.errors[0]?.message ?? "Invalid input",
      },
    };
  }

  const supabase = await createServerSupabaseClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) {
    return {
      success: false,
      error: { code: "forbidden", message: "Not authenticated" },
    };
  }

  const service = new OrganizationService(supabase);
  const auth = await authorizeBranchManagement(
    service,
    organizationId,
    authData.user.id
  );
  if (!auth.success) {
    return auth;
  }

  const result = await service.updateBranch(
    branchId,
    parsed.data,
    organizationId,
    authData.user.id
  );

  if (result.success) {
    revalidatePath("/settings/branches");
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: authData.user.id,
      action: "branch.update",
      entityType: "branch",
      entityId: branchId,
      summary: `Updated branch "${result.data.name}"`,
    });
  }

  return result;
}

export async function deleteBranchAction(
  organizationId: string,
  branchId: string
): Promise<OrganizationActionResult<void>> {
  const supabase = await createServerSupabaseClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) {
    return {
      success: false,
      error: { code: "forbidden", message: "Not authenticated" },
    };
  }

  const service = new OrganizationService(supabase);
  const auth = await authorizeBranchManagement(
    service,
    organizationId,
    authData.user.id
  );
  if (!auth.success) {
    return auth;
  }

  const result = await service.deleteBranch(branchId, authData.user.id);

  if (result.success) {
    revalidatePath("/settings/branches");
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: authData.user.id,
      action: "branch.delete",
      entityType: "branch",
      entityId: branchId,
      summary: "Deleted branch",
    });
  }

  return result;
}

// ─────────────────────────────────────────────────────────────
// Switch Organization (select-org page)
// ─────────────────────────────────────────────────────────────

export async function switchOrganizationAction(
  organizationId: string
): Promise<void> {
  // The organization context is stored server-side via cookies / session.
  // We simply redirect to the dashboard with the org in the URL.
  // Detailed org-session management can be wired in Sprint 2.
  redirect(`/dashboard?org=${organizationId}`);
}
