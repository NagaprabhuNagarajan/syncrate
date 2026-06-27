"use client";

import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import { Mail, Users, UserPlus, X, Clock } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { BadgeProps } from "@/components/ui/badge";
import { cancelInvitationAction } from "@/features/organization/actions/organization.actions";
import type {
  Branch,
  MemberStatus,
  OrganizationInvitation,
  OrganizationMemberWithUser,
  Role,
} from "@/features/organization/types/organization.types";
import { cn } from "@/utils/cn";
import { InviteUserForm } from "./invite-user-form";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<MemberStatus, BadgeProps["variant"]> = {
  active: "success",
  invited: "info",
  inactive: "muted",
  suspended: "warning",
};

const STATUS_LABEL: Record<MemberStatus, string> = {
  active: "Active",
  invited: "Invited",
  inactive: "Inactive",
  suspended: "Suspended",
};

function initialsFor(member: OrganizationMemberWithUser): string {
  const source = member.fullName ?? member.email ?? "?";
  const parts = source.trim().split(/\s+/).filter(Boolean);
  const [first, second] = parts;
  if (!first) {
    return "?";
  }
  if (!second) {
    return first.slice(0, 2).toUpperCase();
  }
  return `${first.charAt(0)}${second.charAt(0)}`.toUpperCase();
}

function formatExpiry(date: Date): string {
  const value = date instanceof Date ? date : new Date(date);
  return value.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ─────────────────────────────────────────────────────────────
// Member row
// ─────────────────────────────────────────────────────────────

interface MemberRowProps {
  readonly member: OrganizationMemberWithUser;
  readonly index: number;
}

function MemberRow({ member, index }: MemberRowProps) {
  const status = member.status;
  return (
    <motion.li
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, delay: index * 0.04 }}
      className="flex items-center gap-4 px-5 py-3.5"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-primary-100 to-indigo-100 text-sm font-semibold text-primary-700">
        {member.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={member.avatarUrl}
            alt={member.fullName ?? member.email ?? "Member"}
            className="h-10 w-10 object-cover"
          />
        ) : (
          <span aria-hidden="true">{initialsFor(member)}</span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-900">
          {member.fullName ?? member.email ?? "Unknown member"}
        </p>
        {member.email && (
          <p className="truncate text-xs text-slate-500">{member.email}</p>
        )}
      </div>

      <div className="hidden shrink-0 sm:block">
        <span className="text-sm text-slate-600">
          {member.roleName ?? "—"}
        </span>
      </div>

      <Badge variant={STATUS_BADGE[status]} className="shrink-0 capitalize">
        {STATUS_LABEL[status]}
      </Badge>
    </motion.li>
  );
}

// ─────────────────────────────────────────────────────────────
// Pending invitation row
// ─────────────────────────────────────────────────────────────

interface InvitationRowProps {
  readonly invitation: OrganizationInvitation;
  readonly organizationId: string;
  readonly roleName: string;
  readonly index: number;
}

function InvitationRow({
  invitation,
  organizationId,
  roleName,
  index,
}: InvitationRowProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleCancel = () => {
    setError(null);
    startTransition(async () => {
      const result = await cancelInvitationAction(
        invitation.id,
        organizationId
      );
      if (!result.success) {
        setError(result.error.message);
      }
    });
  };

  return (
    <motion.li
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, delay: index * 0.04 }}
      className="flex items-center gap-4 px-5 py-3.5"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100">
        <Mail className="h-4 w-4 text-slate-500" aria-hidden="true" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-900">
          {invitation.email}
        </p>
        <p className="flex items-center gap-1.5 text-xs text-slate-500">
          <span>{roleName}</span>
          <span aria-hidden="true">·</span>
          <Clock className="h-3 w-3" aria-hidden="true" />
          <span>Expires {formatExpiry(invitation.expiresAt)}</span>
        </p>
        {error && (
          <p className="text-error-600 mt-1 text-xs" role="alert">
            {error}
          </p>
        )}
      </div>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={handleCancel}
        loading={isPending}
        disabled={isPending}
        aria-label={`Cancel invitation for ${invitation.email}`}
      >
        <X className="mr-1 h-4 w-4" aria-hidden="true" />
        Cancel
      </Button>
    </motion.li>
  );
}

// ─────────────────────────────────────────────────────────────
// Team Management View
// ─────────────────────────────────────────────────────────────

interface TeamManagementViewProps {
  readonly organizationId: string;
  readonly members: OrganizationMemberWithUser[];
  readonly roles: Role[];
  readonly branches: Branch[];
  readonly pendingInvitations: OrganizationInvitation[];
}

export function TeamManagementView({
  organizationId,
  members,
  roles,
  branches,
  pendingInvitations,
}: TeamManagementViewProps) {
  const [showInviteForm, setShowInviteForm] = useState(false);

  const roleNameById = new Map(roles.map((role) => [role.id, role.name]));

  const handleToggleInvite = () => {
    setShowInviteForm((prev) => !prev);
  };

  const handleInviteSuccess = () => {
    setShowInviteForm(false);
  };

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title="Team"
        description="Manage members and invitations for your organization"
        icon={Users}
      >
        <Button type="button" onClick={handleToggleInvite}>
          <UserPlus className="mr-2 h-4 w-4" aria-hidden="true" />
          {showInviteForm ? "Close" : "Invite"}
        </Button>
      </PageHeader>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Members + invitations */}
        <div
          className={cn(
            "space-y-6",
            showInviteForm ? "lg:col-span-2" : "lg:col-span-3"
          )}
        >
          {/* Members */}
          <section className="rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="text-sm font-semibold text-slate-900">
                Members
              </h2>
              <span className="text-xs text-slate-400">
                {members.length}{" "}
                {members.length === 1 ? "member" : "members"}
              </span>
            </div>
            {members.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  icon={Users}
                  title="No members yet"
                  description="Invite your colleagues to collaborate in this organization."
                />
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {members.map((member, i) => (
                  <MemberRow key={member.id} member={member} index={i} />
                ))}
              </ul>
            )}
          </section>

          {/* Pending invitations */}
          <section className="rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="text-sm font-semibold text-slate-900">
                Pending invitations
              </h2>
              <span className="text-xs text-slate-400">
                {pendingInvitations.length} pending
              </span>
            </div>
            {pendingInvitations.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  icon={Mail}
                  title="No pending invitations"
                  description="Invitations you send will appear here until they're accepted."
                />
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {pendingInvitations.map((invitation, i) => (
                  <InvitationRow
                    key={invitation.id}
                    invitation={invitation}
                    organizationId={organizationId}
                    roleName={
                      roleNameById.get(invitation.roleId) ?? "Member"
                    }
                    index={i}
                  />
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Invite form */}
        {showInviteForm && (
          <div className="lg:col-span-1">
            <InviteUserForm
              organizationId={organizationId}
              roles={roles}
              branches={branches}
              onSuccess={handleInviteSuccess}
            />
          </div>
        )}
      </div>
    </div>
  );
}
