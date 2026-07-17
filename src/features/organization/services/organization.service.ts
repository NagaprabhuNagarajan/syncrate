import type { AppSupabaseClient } from "@/lib/supabase/types";
import { OrganizationRepository } from "@/features/organization/repositories/organization.repository";
import type {
  InvitationDetails,
  Organization,
  Branch,
  OrganizationMember,
  OrganizationMemberWithUser,
  OrganizationInvitation,
  Role,
  OrganizationContext,
  CreateOrganizationInput,
  UpdateOrganizationInput,
  InviteUserInput,
  CreateBranchInput,
  UpdateBranchInput,
  OrganizationActionResult,
  OrganizationError,
  OrganizationErrorCode,
} from "@/features/organization/types/organization.types";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function ok<T>(data: T): OrganizationActionResult<T> {
  return { success: true, data };
}

function fail(
  code: OrganizationErrorCode,
  message: string
): OrganizationActionResult<never> {
  const error: OrganizationError = { code, message };
  return { success: false, error };
}

/**
 * Generates a URL-safe slug from an organization name.
 * The DB trigger also calls generate_slug() — this mirrors that logic
 * so we can pre-compute the slug in the service layer and handle conflicts.
 */
function toSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s-]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Default measurement units seeded for every new organization so the product
 * form is usable immediately (a fresh org otherwise has no units to pick).
 * Categories/brands are business-specific and intentionally left empty.
 */
const DEFAULT_UNITS: readonly { name: string; symbol: string }[] = [
  { name: "Piece", symbol: "Pcs" },
  { name: "Numbers", symbol: "Nos" },
  { name: "Kilogram", symbol: "kg" },
  { name: "Gram", symbol: "g" },
  { name: "Litre", symbol: "L" },
  { name: "Millilitre", symbol: "ml" },
  { name: "Metre", symbol: "m" },
  { name: "Box", symbol: "Box" },
  { name: "Dozen", symbol: "Dzn" },
  { name: "Pack", symbol: "Pack" },
  { name: "Hour", symbol: "Hr" },
];

// ─────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────

export class OrganizationService {
  private readonly repo: OrganizationRepository;
  private readonly supabase: AppSupabaseClient;

  constructor(supabase: AppSupabaseClient) {
    this.repo = new OrganizationRepository(supabase);
    this.supabase = supabase;
  }

  // ── Create Organization ──────────────────────────────────

  async createOrganization(
    input: CreateOrganizationInput,
    userId: string
  ): Promise<OrganizationActionResult<Organization>> {
    // Check slug uniqueness before inserting (the DB trigger will also enforce this)
    const baseSlug = toSlug(input.name);
    if (!baseSlug) {
      return fail(
        "unknown",
        "Organization name produced an invalid slug. Please use letters or numbers."
      );
    }

    const existing = await this.repo.findBySlug(baseSlug);
    let slug = baseSlug;

    if (existing) {
      // Append a timestamp fragment to make it unique
      slug = `${baseSlug}-${Date.now().toString(36)}`;
    }

    const org = await this.repo.create({
      name: input.name.trim(),
      slug,
      businessType: input.businessType ?? null,
      gstNumber: input.gstNumber?.toUpperCase() ?? null,
      phone: input.phone ?? null,
      email: input.email?.toLowerCase() ?? null,
      city: input.city ?? null,
      state: input.state ?? null,
      country: input.country ?? "IN",
      pincode: input.pincode ?? null,
      addressLine1: input.addressLine1 ?? null,
      createdBy: userId,
    });

    if (!org) {
      return fail(
        "unknown",
        "Failed to create organization. Please try again."
      );
    }

    // Seed default measurement units (best-effort — never block org creation).
    await this.seedDefaultUnits(org.id, userId);

    return ok(org);
  }

  /**
   * Inserts the default unit set for a freshly created organization.
   * Best-effort: any failure is swallowed so it can never fail org creation.
   */
  private async seedDefaultUnits(
    organizationId: string,
    userId: string
  ): Promise<void> {
    try {
      await this.supabase.from("units").insert(
        DEFAULT_UNITS.map((u) => ({
          organization_id: organizationId,
          name: u.name,
          symbol: u.symbol,
          created_by: userId,
        }))
      );
    } catch {
      // Non-critical — the org is already created; units can be added manually.
    }
  }

  // ── Get Organization ──────────────────────────────────────

  async getOrganization(
    id: string
  ): Promise<OrganizationActionResult<Organization>> {
    const org = await this.repo.findById(id);
    if (!org) {
      return fail("not_found", "Organization not found");
    }
    return ok(org);
  }

  // ── List User's Organizations ─────────────────────────────

  async listUserOrganizations(userId: string): Promise<Organization[]> {
    return this.repo.findAllForUser(userId);
  }

  // ── Update Organization ───────────────────────────────────

  async updateOrganization(
    id: string,
    input: UpdateOrganizationInput,
    userId: string
  ): Promise<OrganizationActionResult<Organization>> {
    const org = await this.repo.update(id, {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.displayName !== undefined && {
        display_name: input.displayName,
      }),
      ...(input.businessType !== undefined && {
        business_type: input.businessType,
      }),
      ...(input.gstNumber !== undefined && {
        gst_number: input.gstNumber?.toUpperCase() ?? null,
      }),
      ...(input.panNumber !== undefined && {
        pan_number: input.panNumber?.toUpperCase() ?? null,
      }),
      ...(input.cinNumber !== undefined && { cin_number: input.cinNumber }),
      ...(input.phone !== undefined && { phone: input.phone || null }),
      ...(input.email !== undefined && {
        email: input.email?.toLowerCase() || null,
      }),
      ...(input.website !== undefined && { website: input.website || null }),
      ...(input.addressLine1 !== undefined && {
        address_line1: input.addressLine1,
      }),
      ...(input.addressLine2 !== undefined && {
        address_line2: input.addressLine2,
      }),
      ...(input.city !== undefined && { city: input.city }),
      ...(input.state !== undefined && { state: input.state }),
      ...(input.country !== undefined && { country: input.country }),
      ...(input.pincode !== undefined && { pincode: input.pincode || null }),
      updated_by: userId,
    });

    if (!org) {
      return fail("not_found", "Organization not found or update failed");
    }

    return ok(org);
  }

  // ── Get Organization Context ──────────────────────────────

  async getOrganizationContext(
    organizationId: string,
    userId: string
  ): Promise<OrganizationContext | null> {
    const [org, member] = await Promise.all([
      this.repo.findById(organizationId),
      this.repo.findMember(organizationId, userId),
    ]);

    if (!org || !member) {
      return null;
    }

    const [branch, permissions] = await Promise.all([
      member.branchId
        ? this.repo.findBranchById(member.branchId)
        : Promise.resolve(null),
      this.repo.findUserPermissions(organizationId, userId),
    ]);

    return {
      organization: org,
      member,
      branch,
      permissions,
    };
  }

  // ── Branches ──────────────────────────────────────────────

  async listBranches(organizationId: string): Promise<Branch[]> {
    return this.repo.findBranchesByOrg(organizationId);
  }

  async getBranch(id: string): Promise<OrganizationActionResult<Branch>> {
    const branch = await this.repo.findBranchById(id);
    if (!branch) {
      return fail("not_found", "Branch not found");
    }
    return ok(branch);
  }

  async createBranch(
    input: CreateBranchInput,
    organizationId: string,
    userId: string
  ): Promise<OrganizationActionResult<Branch>> {
    const existing = await this.repo.findBranchByCode(
      organizationId,
      input.code
    );
    if (existing) {
      return fail(
        "duplicate_code",
        `A branch with code "${input.code.toUpperCase()}" already exists`
      );
    }

    const branch = await this.repo.createBranch({
      organizationId,
      name: input.name.trim(),
      code: input.code,
      isHeadquarters: input.isHeadquarters ?? false,
      phone: input.phone || null,
      email: input.email?.toLowerCase() || null,
      addressLine1: input.addressLine1 ?? null,
      addressLine2: input.addressLine2 ?? null,
      city: input.city ?? null,
      state: input.state ?? null,
      pincode: input.pincode || null,
      gstNumber: input.gstNumber?.toUpperCase() || null,
      createdBy: userId,
    });

    if (!branch) {
      return fail("unknown", "Failed to create branch. Please try again.");
    }

    return ok(branch);
  }

  async updateBranch(
    branchId: string,
    input: UpdateBranchInput,
    organizationId: string,
    userId: string
  ): Promise<OrganizationActionResult<Branch>> {
    // If the code is changing, enforce uniqueness within the org.
    if (input.code !== undefined) {
      const existing = await this.repo.findBranchByCode(
        organizationId,
        input.code
      );
      if (existing && existing.id !== branchId) {
        return fail(
          "duplicate_code",
          `A branch with code "${input.code.toUpperCase()}" already exists`
        );
      }
    }

    const branch = await this.repo.updateBranch(
      branchId,
      {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.code !== undefined && { code: input.code.toUpperCase() }),
        ...(input.isHeadquarters !== undefined && {
          is_headquarters: input.isHeadquarters,
        }),
        ...(input.phone !== undefined && { phone: input.phone || null }),
        ...(input.email !== undefined && {
          email: input.email?.toLowerCase() || null,
        }),
        ...(input.addressLine1 !== undefined && {
          address_line1: input.addressLine1,
        }),
        ...(input.addressLine2 !== undefined && {
          address_line2: input.addressLine2,
        }),
        ...(input.city !== undefined && { city: input.city }),
        ...(input.state !== undefined && { state: input.state }),
        ...(input.pincode !== undefined && { pincode: input.pincode || null }),
        ...(input.gstNumber !== undefined && {
          gst_number: input.gstNumber?.toUpperCase() || null,
        }),
        ...(input.status !== undefined && { status: input.status }),
      },
      userId
    );

    if (!branch) {
      return fail("not_found", "Branch not found or update failed");
    }

    return ok(branch);
  }

  async deleteBranch(
    branchId: string,
    userId: string
  ): Promise<OrganizationActionResult<void>> {
    const branch = await this.repo.findBranchById(branchId);
    if (!branch) {
      return fail("not_found", "Branch not found");
    }

    if (branch.isHeadquarters) {
      return fail(
        "cannot_delete_headquarters",
        "The headquarters branch cannot be deleted"
      );
    }

    const deleted = await this.repo.softDeleteBranch(branchId, userId);
    if (!deleted) {
      return fail("unknown", "Failed to delete branch. Please try again.");
    }

    return ok(undefined);
  }

  // ── Roles ─────────────────────────────────────────────────

  async listRoles(organizationId: string): Promise<Role[]> {
    return this.repo.findRolesForOrg(organizationId);
  }

  // ── Members ───────────────────────────────────────────────

  async listMembers(organizationId: string): Promise<OrganizationMember[]> {
    return this.repo.findMembersByOrg(organizationId);
  }

  async listMembersWithUser(
    organizationId: string
  ): Promise<OrganizationMemberWithUser[]> {
    return this.repo.findMembersWithUser(organizationId);
  }

  /** The signed-in user's role name in an organization (e.g. "Owner"). */
  async getUserRoleName(
    organizationId: string,
    userId: string
  ): Promise<string | null> {
    return this.repo.findMemberRoleName(organizationId, userId);
  }

  /** Counts active Owner members — used to protect the last owner. */
  private countActiveOwners(members: OrganizationMemberWithUser[]): number {
    return members.filter(
      (m) => m.roleName === "Owner" && m.status === "active"
    ).length;
  }

  async updateMemberRole(
    organizationId: string,
    memberId: string,
    roleId: string,
    actorUserId: string
  ): Promise<OrganizationActionResult<void>> {
    const members = await this.repo.findMembersWithUser(organizationId);
    const target = members.find((m) => m.id === memberId);
    if (!target) {
      return fail("not_found", "Member not found.");
    }

    const role = await this.repo.findRoleById(roleId);
    if (!role) {
      return fail("not_found", "The selected role does not exist.");
    }

    // Never leave the organization without an owner.
    if (
      target.roleName === "Owner" &&
      role.name !== "Owner" &&
      this.countActiveOwners(members) <= 1
    ) {
      return fail(
        "validation",
        "You can't change the role of the last owner. Assign another owner first."
      );
    }

    const updated = await this.repo.updateMemberRole(
      memberId,
      roleId,
      actorUserId
    );
    if (!updated) {
      return fail("unknown", "Failed to update the member's role.");
    }
    return ok(undefined);
  }

  async removeMember(
    organizationId: string,
    memberId: string,
    actorUserId: string
  ): Promise<OrganizationActionResult<void>> {
    const members = await this.repo.findMembersWithUser(organizationId);
    const target = members.find((m) => m.id === memberId);
    if (!target) {
      return fail("not_found", "Member not found.");
    }

    if (
      target.roleName === "Owner" &&
      this.countActiveOwners(members) <= 1
    ) {
      return fail(
        "validation",
        "You can't remove the last owner. Assign another owner first."
      );
    }

    const removed = await this.repo.softDeleteMember(memberId, actorUserId);
    if (!removed) {
      return fail("unknown", "Failed to remove the member.");
    }
    return ok(undefined);
  }

  // ── Invite User ───────────────────────────────────────────

  async inviteUser(
    input: InviteUserInput,
    organizationId: string,
    invitedBy: string,
    inviterEmail?: string | null
  ): Promise<OrganizationActionResult<OrganizationInvitation>> {
    // Validate role exists
    const role = await this.repo.findRoleById(input.roleId);
    if (!role) {
      return fail("not_found", "Selected role does not exist");
    }

    // You can't invite your own (already-signed-in) email address.
    if (
      inviterEmail &&
      inviterEmail.toLowerCase() === input.email.toLowerCase()
    ) {
      return fail(
        "already_member",
        "You're already a member — you can't invite your own email address."
      );
    }

    // One invitation record per (org, email). If a prior invitation exists in
    // any state, reuse it instead of inserting a duplicate row — otherwise a
    // declined/expired invite plus a fresh one would coexist for one address.
    const existing = await this.repo.findInvitationByEmail(
      organizationId,
      input.email
    );

    if (existing) {
      if (existing.status === "accepted") {
        return fail(
          "already_member",
          "This email address already belongs to a member of this organization."
        );
      }
      if (
        existing.status === "pending" &&
        new Date(existing.expiresAt) >= new Date()
      ) {
        return fail(
          "already_member",
          "A pending invitation for this email address already exists."
        );
      }

      // declined / cancelled / expired (or a lapsed pending) → re-activate the
      // same row with the newly-chosen role/branch and a fresh expiry.
      const reactivated = await this.repo.reactivateInvitation(existing.id, {
        roleId: input.roleId,
        branchId: input.branchId ?? null,
        createdBy: invitedBy,
      });
      if (!reactivated) {
        return fail(
          "unknown",
          "Failed to send the invitation. Please try again."
        );
      }
      return ok(reactivated);
    }

    const invitation = await this.repo.createInvitation({
      organizationId,
      email: input.email,
      fullName: input.fullName ?? null,
      roleId: input.roleId,
      branchId: input.branchId ?? null,
      createdBy: invitedBy,
    });

    if (!invitation) {
      return fail("unknown", "Failed to create invitation. Please try again.");
    }

    return ok(invitation);
  }

  // ── Accept Invitation ─────────────────────────────────────

  async acceptInvitation(
    token: string,
    userId: string
  ): Promise<OrganizationActionResult<Organization>> {
    const invitation = await this.repo.findInvitationByToken(token);

    if (!invitation) {
      return fail("not_found", "Invitation not found");
    }

    if (invitation.status !== "pending") {
      if (invitation.status === "expired") {
        return fail("invitation_expired", "This invitation has expired");
      }
      return fail(
        "invitation_already_used",
        "This invitation has already been used"
      );
    }

    if (new Date(invitation.expiresAt) < new Date()) {
      await this.repo.updateInvitationStatus(invitation.id, "expired");
      return fail("invitation_expired", "This invitation has expired");
    }

    const org = await this.repo.findById(invitation.organizationId);
    if (!org) {
      return fail("not_found", "Organization not found");
    }

    // Create the membership unless the user is already an active member.
    const existing = await this.repo.findMember(
      invitation.organizationId,
      userId
    );

    if (!existing) {
      const member = await this.repo.createMember({
        organizationId: invitation.organizationId,
        userId,
        roleId: invitation.roleId,
        branchId: invitation.branchId,
        invitedBy: invitation.createdBy,
        createdBy: userId,
      });

      if (!member) {
        return fail(
          "unknown",
          "Failed to join the organization. Please try again."
        );
      }
    }

    // Mark invitation accepted only after membership is in place.
    await this.repo.updateInvitationStatus(invitation.id, "accepted", {
      accepted_at: new Date().toISOString(),
      accepted_by: userId,
    });

    return ok(org);
  }

  // ── Invitation preview (public accept page) ───────────────

  /** Resolves an invitation token to its display details, or a typed error
   * when it's missing, expired, or no longer pending. */
  async getInvitationDetails(
    token: string
  ): Promise<OrganizationActionResult<InvitationDetails>> {
    const invitation = await this.repo.findInvitationByToken(token);
    if (!invitation) {
      return fail("not_found", "This invitation could not be found.");
    }

    if (invitation.status !== "pending") {
      if (invitation.status === "expired") {
        return fail("invitation_expired", "This invitation has expired.");
      }
      return fail(
        "invitation_already_used",
        "This invitation is no longer active."
      );
    }

    if (new Date(invitation.expiresAt) < new Date()) {
      await this.repo.updateInvitationStatus(invitation.id, "expired");
      return fail("invitation_expired", "This invitation has expired.");
    }

    const [org, role] = await Promise.all([
      this.repo.findById(invitation.organizationId),
      this.repo.findRoleById(invitation.roleId),
    ]);
    if (!org) {
      return fail("not_found", "Organization not found.");
    }

    return ok({
      email: invitation.email,
      organizationName: org.name,
      roleName: role?.name ?? "Member",
      expiresAt: invitation.expiresAt,
    });
  }

  // ── Decline Invitation (by the invitee) ───────────────────

  async declineInvitation(
    token: string,
    _userId: string
  ): Promise<OrganizationActionResult<void>> {
    const invitation = await this.repo.findInvitationByToken(token);
    if (!invitation) {
      return fail("not_found", "This invitation could not be found.");
    }

    if (invitation.status !== "pending") {
      return fail(
        "invitation_already_used",
        "This invitation is no longer active."
      );
    }

    const updated = await this.repo.updateInvitationStatus(
      invitation.id,
      "declined"
    );
    if (!updated) {
      return fail(
        "unknown",
        "Failed to decline the invitation. Please try again."
      );
    }
    return ok(undefined);
  }

  // ── Cancel Invitation ─────────────────────────────────────

  async cancelInvitation(
    invitationId: string,
    _cancelledBy: string
  ): Promise<OrganizationActionResult<void>> {
    const updated = await this.repo.updateInvitationStatus(
      invitationId,
      "cancelled"
    );
    if (!updated) {
      return fail(
        "not_found",
        "Invitation not found or could not be cancelled"
      );
    }
    return ok(undefined);
  }

  // ── List Invitations ──────────────────────────────────────

  async listPendingInvitations(
    organizationId: string
  ): Promise<OrganizationInvitation[]> {
    return this.repo.findPendingInvitationsByOrg(organizationId);
  }

  async listDeclinedInvitations(
    organizationId: string
  ): Promise<OrganizationInvitation[]> {
    return this.repo.findInvitationsByStatus(organizationId, "declined");
  }

  /** Re-activates a previously declined (or otherwise inactive) invitation so
   * the invitee can accept again, with a fresh 7-day expiry. */
  async resendInvitation(
    invitationId: string,
    _resentBy: string
  ): Promise<OrganizationActionResult<OrganizationInvitation>> {
    const updated = await this.repo.reactivateInvitation(invitationId);
    if (!updated) {
      return fail("not_found", "Invitation not found.");
    }
    return ok(updated);
  }
}
