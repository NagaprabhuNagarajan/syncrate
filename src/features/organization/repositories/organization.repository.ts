import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Database } from "@/types/database.types";
import type {
  Organization,
  Branch,
  OrganizationMember,
  OrganizationMemberWithUser,
  OrganizationInvitation,
  Role,
  Permission,
} from "@/features/organization/types/organization.types";

type DbOrg = Database["public"]["Tables"]["organizations"]["Row"];
type DbBranch = Database["public"]["Tables"]["branches"]["Row"];
type DbMember = Database["public"]["Tables"]["organization_members"]["Row"];
type DbInvitation =
  Database["public"]["Tables"]["organization_invitations"]["Row"];
type DbRole = Database["public"]["Tables"]["roles"]["Row"];
type DbPermission = Database["public"]["Tables"]["permissions"]["Row"];

// ─────────────────────────────────────────────────────────────
// Joined query result types
// ─────────────────────────────────────────────────────────────

/**
 * Shape returned when we select roles with their permissions via join.
 * Typed explicitly because Supabase JS can't infer join types without
 * generated schema types from a live project.
 */
interface DbRoleWithPermissions extends DbRole {
  role_permissions: Array<{
    permissions: DbPermission | null;
  }>;
}

interface DbMemberWithRole extends DbMember {
  roles: {
    role_permissions: Array<{
      permissions: { name: string } | null;
    }>;
  } | null;
}

interface DbMemberWithUser extends DbMember {
  users: {
    email: string;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
  roles: { name: string } | null;
}

// ─────────────────────────────────────────────────────────────
// Mappers
// ─────────────────────────────────────────────────────────────

function mapOrg(row: DbOrg): Organization {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    displayName: row.display_name,
    businessType: row.business_type,
    gstNumber: row.gst_number,
    panNumber: row.pan_number,
    cinNumber: row.cin_number,
    phone: row.phone,
    email: row.email,
    website: row.website,
    addressLine1: row.address_line1,
    addressLine2: row.address_line2,
    city: row.city,
    state: row.state,
    country: row.country,
    pincode: row.pincode,
    logoUrl: row.logo_url,
    verificationStatus:
      row.verification_status as Organization["verificationStatus"],
    status: row.status as Organization["status"],
    plan: row.plan as Organization["plan"],
    planExpiresAt: row.plan_expires_at ? new Date(row.plan_expires_at) : null,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    createdBy: row.created_by,
  };
}

function mapBranch(row: DbBranch): Branch {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    code: row.code,
    isHeadquarters: row.is_headquarters,
    phone: row.phone,
    email: row.email,
    addressLine1: row.address_line1,
    addressLine2: row.address_line2,
    city: row.city,
    state: row.state,
    pincode: row.pincode,
    gstNumber: row.gst_number,
    status: row.status as Branch["status"],
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function mapPermission(row: DbPermission): Permission {
  return {
    id: row.id,
    module: row.module,
    action: row.action,
    name: row.name,
    description: row.description,
  };
}

function mapRole(row: DbRole, permissions: Permission[] = []): Role {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    isSystem: row.is_system,
    organizationId: row.organization_id,
    permissions,
    createdAt: new Date(row.created_at),
  };
}

function mapMember(row: DbMember): OrganizationMember {
  return {
    id: row.id,
    organizationId: row.organization_id,
    userId: row.user_id,
    roleId: row.role_id,
    branchId: row.branch_id,
    status: row.status as OrganizationMember["status"],
    invitedAt: row.invited_at ? new Date(row.invited_at) : null,
    joinedAt: row.joined_at ? new Date(row.joined_at) : null,
    invitedBy: row.invited_by,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function mapInvitation(row: DbInvitation): OrganizationInvitation {
  return {
    id: row.id,
    organizationId: row.organization_id,
    email: row.email,
    fullName: row.full_name,
    roleId: row.role_id,
    branchId: row.branch_id,
    token: row.token,
    status: row.status as OrganizationInvitation["status"],
    expiresAt: new Date(row.expires_at),
    acceptedAt: row.accepted_at ? new Date(row.accepted_at) : null,
    acceptedBy: row.accepted_by,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    createdBy: row.created_by,
  };
}

// ─────────────────────────────────────────────────────────────
// Repository
// ─────────────────────────────────────────────────────────────

export class OrganizationRepository {
  constructor(private readonly supabase: AppSupabaseClient) {}

  // ── Organizations ──────────────────────────────────────────

  async findById(id: string): Promise<Organization | null> {
    const { data, error } = await this.supabase
      .from("organizations")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (error || !data) {
      return null;
    }
    return mapOrg(data);
  }

  async findBySlug(slug: string): Promise<Organization | null> {
    const { data, error } = await this.supabase
      .from("organizations")
      .select("*")
      .eq("slug", slug)
      .is("deleted_at", null)
      .single();

    if (error || !data) {
      return null;
    }
    return mapOrg(data);
  }

  async findAllForUser(userId: string): Promise<Organization[]> {
    // Step 1: get org IDs for this user
    const { data: memberData, error: memberError } = await this.supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", userId)
      .eq("status", "active")
      .is("deleted_at", null);

    if (memberError || !memberData || memberData.length === 0) {
      return [];
    }

    const orgIds = memberData.map((m) => m.organization_id);

    // Step 2: fetch those organizations
    const { data, error } = await this.supabase
      .from("organizations")
      .select("*")
      .in("id", orgIds)
      .is("deleted_at", null)
      .order("name");

    if (error || !data) {
      return [];
    }
    return data.map(mapOrg);
  }

  async create(input: {
    name: string;
    slug: string;
    businessType?: string | null;
    gstNumber?: string | null;
    phone?: string | null;
    email?: string | null;
    city?: string | null;
    state?: string | null;
    country?: string;
    pincode?: string | null;
    addressLine1?: string | null;
    createdBy: string;
  }): Promise<Organization | null> {
    // NOTE: do NOT chain `.select()` onto this insert. The organizations SELECT
    // policy (organizations_select_members) only exposes rows the caller is a
    // member of. Membership is created by the AFTER-INSERT trigger
    // (handle_new_organization), but that row isn't visible to the
    // INSERT...RETURNING statement's own RLS evaluation — so a chained select
    // returns 0 rows and org creation appears to fail. Insert first, then read
    // back in a separate statement where the new membership is visible.
    const { error } = await this.supabase.from("organizations").insert({
      name: input.name,
      slug: input.slug,
      business_type: input.businessType ?? null,
      gst_number: input.gstNumber ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      city: input.city ?? null,
      state: input.state ?? null,
      country: input.country ?? "IN",
      pincode: input.pincode ?? null,
      address_line1: input.addressLine1 ?? null,
      created_by: input.createdBy,
    });

    if (error) {
      return null;
    }
    // Separate statement: the trigger-created owner membership is now visible.
    return this.findBySlug(input.slug);
  }

  async update(
    id: string,
    patch: Partial<DbOrg>
  ): Promise<Organization | null> {
    const { data, error } = await this.supabase
      .from("organizations")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id)
      .is("deleted_at", null)
      .select("*")
      .single();

    if (error || !data) {
      return null;
    }
    return mapOrg(data);
  }

  // ── Branches ──────────────────────────────────────────────

  async findBranchesByOrg(organizationId: string): Promise<Branch[]> {
    const { data, error } = await this.supabase
      .from("branches")
      .select("*")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("is_headquarters", { ascending: false })
      .order("name");

    if (error || !data) {
      return [];
    }
    return data.map(mapBranch);
  }

  async findBranchById(id: string): Promise<Branch | null> {
    const { data, error } = await this.supabase
      .from("branches")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (error || !data) {
      return null;
    }
    return mapBranch(data);
  }

  async findBranchByCode(
    organizationId: string,
    code: string
  ): Promise<Branch | null> {
    const { data, error } = await this.supabase
      .from("branches")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("code", code.toUpperCase().trim())
      .is("deleted_at", null)
      .single();

    if (error || !data) {
      return null;
    }
    return mapBranch(data);
  }

  async createBranch(input: {
    organizationId: string;
    name: string;
    code: string;
    isHeadquarters?: boolean;
    phone?: string | null;
    email?: string | null;
    addressLine1?: string | null;
    addressLine2?: string | null;
    city?: string | null;
    state?: string | null;
    pincode?: string | null;
    gstNumber?: string | null;
    createdBy: string;
  }): Promise<Branch | null> {
    const { data, error } = await this.supabase
      .from("branches")
      .insert({
        organization_id: input.organizationId,
        name: input.name,
        code: input.code.toUpperCase().trim(),
        is_headquarters: input.isHeadquarters ?? false,
        phone: input.phone ?? null,
        email: input.email ?? null,
        address_line1: input.addressLine1 ?? null,
        address_line2: input.addressLine2 ?? null,
        city: input.city ?? null,
        state: input.state ?? null,
        pincode: input.pincode ?? null,
        gst_number: input.gstNumber ?? null,
        created_by: input.createdBy,
      })
      .select("*")
      .single();

    if (error || !data) {
      return null;
    }
    return mapBranch(data);
  }

  async updateBranch(
    id: string,
    patch: Partial<DbBranch>,
    updatedBy: string
  ): Promise<Branch | null> {
    const { data, error } = await this.supabase
      .from("branches")
      .update({
        ...patch,
        updated_by: updatedBy,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .is("deleted_at", null)
      .select("*")
      .single();

    if (error || !data) {
      return null;
    }
    return mapBranch(data);
  }

  /** Counts the active headquarters branches in an organization. */
  async countHeadquarters(organizationId: string): Promise<number> {
    const { count, error } = await this.supabase
      .from("branches")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("is_headquarters", true)
      .is("deleted_at", null);

    if (error) {
      return 0;
    }
    return count ?? 0;
  }

  /**
   * Clears the headquarters flag on every branch in the org except `exceptId`.
   * Used to enforce a single headquarters per organization when one is promoted.
   */
  async demoteOtherHeadquarters(
    organizationId: string,
    exceptId: string,
    updatedBy: string
  ): Promise<void> {
    await this.supabase
      .from("branches")
      .update({
        is_headquarters: false,
        updated_by: updatedBy,
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", organizationId)
      .eq("is_headquarters", true)
      .neq("id", exceptId)
      .is("deleted_at", null);
  }

  async softDeleteBranch(id: string, deletedBy: string): Promise<boolean> {
    const { error } = await this.supabase
      .from("branches")
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: deletedBy,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .is("deleted_at", null);

    return !error;
  }

  // ── Members ───────────────────────────────────────────────

  async findMember(
    organizationId: string,
    userId: string
  ): Promise<OrganizationMember | null> {
    const { data, error } = await this.supabase
      .from("organization_members")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("user_id", userId)
      .eq("status", "active")
      .is("deleted_at", null)
      .single();

    if (error || !data) {
      return null;
    }
    return mapMember(data);
  }

  async findMembersByOrg(
    organizationId: string
  ): Promise<OrganizationMember[]> {
    const { data, error } = await this.supabase
      .from("organization_members")
      .select("*")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("created_at");

    if (error || !data) {
      return [];
    }
    return data.map(mapMember);
  }

  async findMembersWithUser(
    organizationId: string
  ): Promise<OrganizationMemberWithUser[]> {
    const { data, error } = await this.supabase
      .from("organization_members")
      .select(
        // organization_members has several FKs to users (user_id, invited_by,
        // created_by, …), so the embed MUST name the user_id relationship —
        // otherwise PostgREST can't disambiguate and the query errors out.
        `
        *,
        users!user_id(email, full_name, avatar_url),
        roles(name)
      `
      )
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("created_at");

    if (error || !data) {
      return [];
    }

    return (data as unknown as DbMemberWithUser[]).map((row) => ({
      ...mapMember(row),
      email: row.users?.email ?? null,
      fullName: row.users?.full_name ?? null,
      avatarUrl: row.users?.avatar_url ?? null,
      roleName: row.roles?.name ?? null,
    }));
  }

  async createMember(input: {
    organizationId: string;
    userId: string;
    roleId: string;
    branchId?: string | null;
    invitedBy?: string | null;
    createdBy: string;
  }): Promise<OrganizationMember | null> {
    const now = new Date().toISOString();
    const { data, error } = await this.supabase
      .from("organization_members")
      .insert({
        organization_id: input.organizationId,
        user_id: input.userId,
        role_id: input.roleId,
        branch_id: input.branchId ?? null,
        status: "active",
        invited_by: input.invitedBy ?? null,
        joined_at: now,
        created_by: input.createdBy,
      })
      .select("*")
      .single();

    if (error || !data) {
      return null;
    }
    return mapMember(data);
  }

  /** The role name of a user in an org — for the sidebar's "you are" badge.
   * organization_members has a single FK to roles, so this embed is safe. */
  async findMemberRoleName(
    organizationId: string,
    userId: string
  ): Promise<string | null> {
    const { data, error } = await this.supabase
      .from("organization_members")
      .select("roles(name)")
      .eq("organization_id", organizationId)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error || !data) {
      return null;
    }
    const row = data as unknown as { roles: { name: string } | null };
    return row.roles?.name ?? null;
  }

  async updateMemberRole(
    memberId: string,
    roleId: string,
    updatedBy: string
  ): Promise<boolean> {
    const { error } = await this.supabase
      .from("organization_members")
      .update({
        role_id: roleId,
        updated_by: updatedBy,
        updated_at: new Date().toISOString(),
      })
      .eq("id", memberId)
      .is("deleted_at", null);
    return !error;
  }

  async softDeleteMember(
    memberId: string,
    deletedBy: string
  ): Promise<boolean> {
    const { error } = await this.supabase
      .from("organization_members")
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: deletedBy,
        updated_at: new Date().toISOString(),
      })
      .eq("id", memberId)
      .is("deleted_at", null);
    return !error;
  }

  // ── Roles & Permissions ───────────────────────────────────

  async findRolesForOrg(organizationId: string): Promise<Role[]> {
    // Supabase JS can't infer join types without generated types from a live project.
    // We cast the response to our explicit type after the query.
    // Org-scoped only: each org owns its copies of the system roles, so the
    // global templates (and other orgs' system roles) must be excluded.
    const { data, error } = await this.supabase
      .from("roles")
      .select(
        `
        *,
        role_permissions(
          permissions(*)
        )
      `
      )
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("name");

    if (error || !data) {
      return [];
    }

    return (data as unknown as DbRoleWithPermissions[]).map((row) => {
      const perms: Permission[] = row.role_permissions
        .map((rp) => rp.permissions)
        .filter((p): p is DbPermission => p !== null)
        .map(mapPermission);
      return mapRole(row, perms);
    });
  }

  async findRoleById(id: string): Promise<Role | null> {
    const { data, error } = await this.supabase
      .from("roles")
      .select(
        `
        *,
        role_permissions(
          permissions(*)
        )
      `
      )
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (error || !data) {
      return null;
    }

    const row = data as unknown as DbRoleWithPermissions;
    const perms: Permission[] = row.role_permissions
      .map((rp) => rp.permissions)
      .filter((p): p is DbPermission => p !== null)
      .map(mapPermission);

    return mapRole(row, perms);
  }

  async findUserPermissions(
    organizationId: string,
    userId: string
  ): Promise<string[]> {
    const { data, error } = await this.supabase
      .from("organization_members")
      .select(
        `
        roles(
          role_permissions(
            permissions(name)
          )
        )
      `
      )
      .eq("organization_id", organizationId)
      .eq("user_id", userId)
      .eq("status", "active")
      .is("deleted_at", null)
      .single();

    if (error || !data) {
      return [];
    }

    const row = data as unknown as DbMemberWithRole;
    if (!row.roles) {
      return [];
    }

    return row.roles.role_permissions
      .map((rp) => rp.permissions?.name)
      .filter((name): name is string => name !== undefined);
  }

  // ── Invitations ───────────────────────────────────────────

  async findInvitationByToken(
    token: string
  ): Promise<OrganizationInvitation | null> {
    const { data, error } = await this.supabase
      .from("organization_invitations")
      .select("*")
      .eq("token", token)
      .is("deleted_at", null)
      .single();

    if (error || !data) {
      return null;
    }
    return mapInvitation(data);
  }

  async findPendingInvitationsByOrg(
    organizationId: string
  ): Promise<OrganizationInvitation[]> {
    const { data, error } = await this.supabase
      .from("organization_invitations")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("status", "pending")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error || !data) {
      return [];
    }
    return data.map(mapInvitation);
  }

  /** The single live invitation for an (org, email), whatever its status.
   * Emails are stored lower-cased, so the lookup is case-insensitive. */
  async findInvitationByEmail(
    organizationId: string,
    email: string
  ): Promise<OrganizationInvitation | null> {
    const { data, error } = await this.supabase
      .from("organization_invitations")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("email", email.toLowerCase().trim())
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return null;
    }
    return mapInvitation(data);
  }

  async findInvitationsByStatus(
    organizationId: string,
    status: OrganizationInvitation["status"]
  ): Promise<OrganizationInvitation[]> {
    const { data, error } = await this.supabase
      .from("organization_invitations")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("status", status)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false });

    if (error || !data) {
      return [];
    }
    return data.map(mapInvitation);
  }

  /** Re-activates an invitation (e.g. after it was declined): back to pending
   * with a fresh 7-day expiry. An optional patch updates role/branch/inviter
   * when the same email is re-invited with different details. */
  async reactivateInvitation(
    id: string,
    patch?: {
      roleId?: string;
      branchId?: string | null;
      createdBy?: string;
    }
  ): Promise<OrganizationInvitation | null> {
    const expiresAt = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000
    ).toISOString();
    const update: Database["public"]["Tables"]["organization_invitations"]["Update"] =
      {
        status: "pending",
        expires_at: expiresAt,
        accepted_at: null,
        accepted_by: null,
        updated_at: new Date().toISOString(),
      };
    if (patch?.roleId !== undefined) {
      update.role_id = patch.roleId;
    }
    if (patch?.branchId !== undefined) {
      update.branch_id = patch.branchId;
    }
    if (patch?.createdBy !== undefined) {
      update.created_by = patch.createdBy;
    }

    const { data, error } = await this.supabase
      .from("organization_invitations")
      .update(update)
      .eq("id", id)
      .select("*")
      .single();

    if (error || !data) {
      return null;
    }
    return mapInvitation(data);
  }

  async createInvitation(input: {
    organizationId: string;
    email: string;
    fullName?: string | null;
    roleId: string;
    branchId?: string | null;
    createdBy: string;
  }): Promise<OrganizationInvitation | null> {
    const { data, error } = await this.supabase
      .from("organization_invitations")
      .insert({
        organization_id: input.organizationId,
        email: input.email.toLowerCase().trim(),
        full_name: input.fullName ?? null,
        role_id: input.roleId,
        branch_id: input.branchId ?? null,
        created_by: input.createdBy,
      })
      .select("*")
      .single();

    if (error || !data) {
      return null;
    }
    return mapInvitation(data);
  }

  async updateInvitationStatus(
    id: string,
    status: OrganizationInvitation["status"],
    patch: Partial<Pick<DbInvitation, "accepted_at" | "accepted_by">> = {}
  ): Promise<OrganizationInvitation | null> {
    const { data, error } = await this.supabase
      .from("organization_invitations")
      .update({ status, ...patch, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();

    if (error || !data) {
      return null;
    }
    return mapInvitation(data);
  }
}
