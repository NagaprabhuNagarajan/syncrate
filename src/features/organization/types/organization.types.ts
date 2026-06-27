/**
 * Organization domain types.
 * These are application-level types that mirror the DB schema
 * but use camelCase and proper TypeScript primitives.
 */

// ─────────────────────────────────────────────────────────────
// Enumerations
// ─────────────────────────────────────────────────────────────

export type OrganizationStatus = "active" | "suspended" | "inactive";
export type OrganizationPlan =
  | "free"
  | "starter"
  | "professional"
  | "enterprise";
export type OrganizationVerificationStatus =
  | "unverified"
  | "email_verified"
  | "mobile_verified"
  | "gst_verified"
  | "document_verified"
  | "trusted";

export type BranchStatus = "active" | "inactive" | "closed";
export type MemberStatus = "active" | "inactive" | "invited" | "suspended";
export type InvitationStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "expired"
  | "cancelled";

// ─────────────────────────────────────────────────────────────
// Core Domain Entities
// ─────────────────────────────────────────────────────────────

export interface Organization {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly displayName: string | null;
  // Business details
  readonly businessType: string | null;
  readonly gstNumber: string | null;
  readonly panNumber: string | null;
  readonly cinNumber: string | null;
  // Contact
  readonly phone: string | null;
  readonly email: string | null;
  readonly website: string | null;
  // Address
  readonly addressLine1: string | null;
  readonly addressLine2: string | null;
  readonly city: string | null;
  readonly state: string | null;
  readonly country: string;
  readonly pincode: string | null;
  // Branding
  readonly logoUrl: string | null;
  // Status
  readonly verificationStatus: OrganizationVerificationStatus;
  readonly status: OrganizationStatus;
  // Subscription
  readonly plan: OrganizationPlan;
  readonly planExpiresAt: Date | null;
  // Audit
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdBy: string | null;
}

export interface Branch {
  readonly id: string;
  readonly organizationId: string;
  readonly name: string;
  readonly code: string;
  readonly isHeadquarters: boolean;
  // Contact
  readonly phone: string | null;
  readonly email: string | null;
  // Address
  readonly addressLine1: string | null;
  readonly addressLine2: string | null;
  readonly city: string | null;
  readonly state: string | null;
  readonly pincode: string | null;
  readonly gstNumber: string | null;
  // Status
  readonly status: BranchStatus;
  // Audit
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface Role {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly isSystem: boolean;
  readonly organizationId: string | null;
  readonly permissions: Permission[];
  readonly createdAt: Date;
}

export interface Permission {
  readonly id: string;
  readonly module: string;
  readonly action: string;
  readonly name: string; // "module.action"
  readonly description: string | null;
}

export interface OrganizationMember {
  readonly id: string;
  readonly organizationId: string;
  readonly userId: string;
  readonly roleId: string;
  readonly branchId: string | null;
  readonly status: MemberStatus;
  readonly invitedAt: Date | null;
  readonly joinedAt: Date | null;
  readonly invitedBy: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  // Joined fields
  readonly role?: Role;
  readonly branch?: Branch | null;
}

export interface OrganizationMemberWithUser extends OrganizationMember {
  readonly email: string | null;
  readonly fullName: string | null;
  readonly avatarUrl: string | null;
  readonly roleName: string | null;
}

export interface OrganizationInvitation {
  readonly id: string;
  readonly organizationId: string;
  readonly email: string;
  readonly fullName: string | null;
  readonly roleId: string;
  readonly branchId: string | null;
  readonly token: string;
  readonly status: InvitationStatus;
  readonly expiresAt: Date;
  readonly acceptedAt: Date | null;
  readonly acceptedBy: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdBy: string | null;
  // Joined fields
  readonly role?: Role;
}

export interface FinancialYear {
  readonly id: string;
  readonly organizationId: string;
  readonly name: string;
  readonly startDate: Date;
  readonly endDate: Date;
  readonly isCurrent: boolean;
  readonly isClosed: boolean;
  readonly createdAt: Date;
}

// ─────────────────────────────────────────────────────────────
// Input / Command types
// ─────────────────────────────────────────────────────────────

export interface CreateOrganizationInput {
  readonly name: string;
  readonly businessType?: string;
  readonly gstNumber?: string;
  readonly phone?: string;
  readonly email?: string;
  readonly city?: string;
  readonly state?: string;
  readonly country?: string;
  readonly pincode?: string;
  readonly addressLine1?: string;
}

export interface UpdateOrganizationInput {
  readonly name?: string;
  readonly displayName?: string;
  readonly businessType?: string;
  readonly gstNumber?: string;
  readonly panNumber?: string;
  readonly cinNumber?: string;
  readonly phone?: string;
  readonly email?: string;
  readonly website?: string;
  readonly addressLine1?: string;
  readonly addressLine2?: string;
  readonly city?: string;
  readonly state?: string;
  readonly country?: string;
  readonly pincode?: string;
}

export interface InviteUserInput {
  readonly email: string;
  readonly fullName?: string;
  readonly roleId: string;
  readonly branchId?: string;
}

export interface CreateBranchInput {
  readonly name: string;
  readonly code: string;
  readonly isHeadquarters?: boolean;
  readonly phone?: string;
  readonly email?: string;
  readonly addressLine1?: string;
  readonly addressLine2?: string;
  readonly city?: string;
  readonly state?: string;
  readonly pincode?: string;
  readonly gstNumber?: string;
}

export interface UpdateBranchInput {
  readonly name?: string;
  readonly code?: string;
  readonly isHeadquarters?: boolean;
  readonly phone?: string;
  readonly email?: string;
  readonly addressLine1?: string;
  readonly addressLine2?: string;
  readonly city?: string;
  readonly state?: string;
  readonly pincode?: string;
  readonly gstNumber?: string;
  readonly status?: BranchStatus;
}

// ─────────────────────────────────────────────────────────────
// Result types
// ─────────────────────────────────────────────────────────────

export type OrganizationActionResult<T = void> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: OrganizationError };

export interface OrganizationError {
  readonly code: OrganizationErrorCode;
  readonly message: string;
}

export type OrganizationErrorCode =
  | "not_found"
  | "forbidden"
  | "already_member"
  | "invitation_expired"
  | "invitation_already_used"
  | "duplicate_slug"
  | "duplicate_code"
  | "cannot_delete_headquarters"
  | "unknown";

// ─────────────────────────────────────────────────────────────
// Context type (what the app carries in session)
// ─────────────────────────────────────────────────────────────

export interface OrganizationContext {
  readonly organization: Organization;
  readonly member: OrganizationMember;
  readonly branch: Branch | null;
  readonly permissions: readonly string[];
}
