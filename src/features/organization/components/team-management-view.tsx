"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Mail,
  MailX,
  Users,
  UserPlus,
  UserCog,
  UserMinus,
  X,
  Clock,
  CheckCircle2,
  Ban,
  Link2,
  Check,
  RotateCcw,
  MoreHorizontal,
  AlertTriangle,
  ChevronLeft,
} from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { StatTile } from "@/components/shared/stat-tile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import type { BadgeProps } from "@/components/ui/badge";
import {
  cancelInvitationAction,
  resendInvitationAction,
  updateMemberRoleAction,
  removeMemberAction,
} from "@/features/organization/actions/organization.actions";
import type {
  Branch,
  MemberStatus,
  OrganizationInvitation,
  OrganizationMemberWithUser,
  Role,
} from "@/features/organization/types/organization.types";
import { formatDate } from "@/utils/format";
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

// ─────────────────────────────────────────────────────────────
// Member avatar
// ─────────────────────────────────────────────────────────────

function MemberAvatar({
  member,
}: {
  readonly member: OrganizationMemberWithUser;
}) {
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-primary-100 to-indigo-100 text-xs font-semibold text-primary-700 dark:from-primary-500/20 dark:to-indigo-500/20 dark:text-primary-300">
      {member.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={member.avatarUrl}
          alt={member.fullName ?? member.email ?? "Member"}
          className="h-9 w-9 object-cover"
        />
      ) : (
        <span aria-hidden="true">{initialsFor(member)}</span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Member row (change role / remove)
// ─────────────────────────────────────────────────────────────

function MemberRow({
  member,
  roles,
  organizationId,
  rolesHref,
  onRequestRemove,
}: {
  readonly member: OrganizationMemberWithUser;
  readonly roles: Role[];
  readonly organizationId: string;
  /** Link target for the role cell — the Roles & Permissions page. */
  readonly rolesHref: string;
  readonly onRequestRemove: (member: OrganizationMemberWithUser) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const memberName = member.fullName ?? member.email ?? "-";

  const handleChangeRole = (roleId: string) => {
    if (roleId === member.roleId) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await updateMemberRoleAction(
        member.id,
        roleId,
        organizationId
      );
      if (!result.success) {
        setError(result.error.message);
      }
    });
  };

  return (
    <TableRow
      className="group cursor-pointer"
      data-state={isPending ? "selected" : undefined}
    >
      <TableCell>
        <div className="flex items-center gap-3">
          <MemberAvatar member={member} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
              {memberName}
            </p>
            {member.email && (
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                {member.email}
              </p>
            )}
            {error && (
              <p
                className="text-error-600 dark:text-error-400 mt-0.5 text-xs"
                role="alert"
              >
                {error}
              </p>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell>
        {member.roleName ? (
          <Link
            href={rolesHref}
            className="text-primary-600 hover:underline dark:text-primary-400"
            title={`View roles & permissions (${member.roleName})`}
          >
            {member.roleName}
          </Link>
        ) : (
          <span className="text-slate-600 dark:text-slate-400">—</span>
        )}
      </TableCell>
      <TableCell>
        <Badge dot variant={STATUS_BADGE[member.status]}>
          {STATUS_LABEL[member.status]}
        </Badge>
      </TableCell>
      <TableCell className="text-slate-500 dark:text-slate-400">
        {member.joinedAt ? formatDate(member.joinedAt) : "—"}
      </TableCell>
      <TableCell className="text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              disabled={isPending}
              aria-label={`Actions for ${memberName}`}
                   className="rounded-md p-1.5 text-slate-400 opacity-0 transition-opacity hover:bg-slate-100 hover:text-slate-600 focus-visible:opacity-100 group-hover:opacity-100 dark:hover:bg-slate-800 dark:hover:text-slate-300"
            >
              <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <UserCog className="mr-2 h-4 w-4" aria-hidden="true" />
                Change role
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuRadioGroup
                  value={member.roleId}
                  onValueChange={handleChangeRole}
                >
                  {roles.map((role) => (
                    <DropdownMenuRadioItem key={role.id} value={role.id}>
                      {role.name}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onRequestRemove(member)}
              className="text-destructive focus:text-destructive"
            >
              <UserMinus className="h-4 w-4" aria-hidden="true" />
              Remove from organization
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

// ─────────────────────────────────────────────────────────────
// Remove member confirmation
// ─────────────────────────────────────────────────────────────

function RemoveMemberDialog({
  member,
  organizationId,
  onClose,
  onDone,
}: {
  readonly member: OrganizationMemberWithUser;
  readonly organizationId: string;
  readonly onClose: () => void;
  readonly onDone: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const name = member.fullName ?? member.email ?? "this member";

  const handleConfirm = () => {
    setError(null);
    startTransition(async () => {
      const result = await removeMemberAction(member.id, organizationId);
      if (result.success) {
        onDone();
      } else {
        setError(result.error.message);
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-slate-900/40"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.18 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="remove-member-title"
        className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex items-start gap-4">
          <div className="bg-error-50 dark:bg-error-500/10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full">
            <AlertTriangle
              className="text-error-600 dark:text-error-400 h-5 w-5"
              aria-hidden="true"
            />
          </div>
          <div>
            <h2
              id="remove-member-title"
              className="text-base font-semibold text-slate-900 dark:text-slate-100"
            >
              Remove member
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Remove{" "}
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {name}
              </span>{" "}
              from this organization? They&apos;ll lose access immediately. You
              can invite them again later.
            </p>
          </div>
        </div>

        {error && (
          <p
            className="bg-error-50 text-error-700 dark:bg-error-500/10 dark:text-error-300 mt-4 rounded-lg px-3 py-2 text-sm"
            role="alert"
          >
            {error}
          </p>
        )}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            loading={isPending}
            disabled={isPending}
          >
            <UserMinus className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Remove member
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Pending invitation row
// ─────────────────────────────────────────────────────────────

interface InvitationRowProps {
  readonly invitation: OrganizationInvitation;
  readonly organizationId: string;
  readonly roleName: string;
}

function InvitationRow({
  invitation,
  organizationId,
  roleName,
}: InvitationRowProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    const url = `${window.location.origin}/accept-invitation?token=${encodeURIComponent(
      invitation.token
    )}`;
    void navigator.clipboard
      .writeText(url)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {
        setError("Could not copy the link. Copy it manually from the address.");
      });
  };

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
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
            <Mail
              className="h-4 w-4 text-slate-500 dark:text-slate-400"
              aria-hidden="true"
            />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
              {invitation.email}
            </p>
            {error && (
              <p
                className="text-error-600 dark:text-error-400 mt-0.5 text-xs"
                role="alert"
              >
                {error}
              </p>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell className="text-slate-600 dark:text-slate-400">
        {roleName}
      </TableCell>
      <TableCell className="text-slate-500 dark:text-slate-400">
        <span className="inline-flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
          Expires {formatDate(invitation.expiresAt)}
        </span>
      </TableCell>
      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleCopyLink}
            aria-label={`Copy invite link for ${invitation.email}`}
          >
            {copied ? (
              <Check
                className="text-success-600 dark:text-success-400 mr-1 h-4 w-4"
                aria-hidden="true"
              />
            ) : (
              <Link2 className="mr-1 h-4 w-4" aria-hidden="true" />
            )}
            {copied ? "Copied" : "Copy link"}
          </Button>
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
        </div>
      </TableCell>
    </TableRow>
  );
}

// ─────────────────────────────────────────────────────────────
// Declined invitation row (resend / cancel)
// ─────────────────────────────────────────────────────────────

function DeclinedInvitationRow({
  invitation,
  organizationId,
  roleName,
}: InvitationRowProps) {
  const [isResending, startResend] = useTransition();
  const [isCancelling, startCancel] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const busy = isResending || isCancelling;

  const handleResend = () => {
    setError(null);
    startResend(async () => {
      const result = await resendInvitationAction(
        invitation.id,
        organizationId
      );
      if (!result.success) {
        setError(result.error.message);
      }
    });
  };

  const handleCancel = () => {
    setError(null);
    startCancel(async () => {
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
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-3">
          <div className="bg-error-50 dark:bg-error-500/10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
            <MailX
              className="text-error-500 dark:text-error-400 h-4 w-4"
              aria-hidden="true"
            />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
              {invitation.email}
            </p>
            {error && (
              <p
                className="text-error-600 dark:text-error-400 mt-0.5 text-xs"
                role="alert"
              >
                {error}
              </p>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell className="text-slate-600 dark:text-slate-400">
        {roleName}
      </TableCell>
      <TableCell>
        <Badge variant="destructive">Declined</Badge>
      </TableCell>
      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleResend}
            loading={isResending}
            disabled={busy}
            aria-label={`Resend invitation to ${invitation.email}`}
          >
            <RotateCcw className="mr-1 h-4 w-4" aria-hidden="true" />
            Resend
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleCancel}
            loading={isCancelling}
            disabled={busy}
            aria-label={`Cancel invitation for ${invitation.email}`}
          >
            <X className="mr-1 h-4 w-4" aria-hidden="true" />
            Cancel
          </Button>
        </div>
      </TableCell>
    </TableRow>
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
  readonly declinedInvitations?: OrganizationInvitation[];
}

export function TeamManagementView({
  organizationId,
  members,
  roles,
  branches,
  pendingInvitations,
  declinedInvitations = [],
}: TeamManagementViewProps) {
  const searchParams = useSearchParams();
  const org = searchParams.get("org");
  const settingsHref = org ? `/settings?org=${org}` : "/settings";
  const rolesHref = org ? `/settings/roles?org=${org}` : "/settings/roles";

  const [showInviteForm, setShowInviteForm] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "members" | "pending" | "declined"
  >("members");
  const [removeTarget, setRemoveTarget] =
    useState<OrganizationMemberWithUser | null>(null);

  const roleNameById = new Map(roles.map((role) => [role.id, role.name]));

  const activeCount = members.filter((m) => m.status === "active").length;
  const suspendedCount = members.filter((m) => m.status === "suspended").length;

  const handleInviteSuccess = () => {
    setShowInviteForm(false);
  };

  return (
    <div className="p-4 lg:p-6">
      {/* Back to settings */}
      <Link
        href={settingsHref}
        className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 transition-colors hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Settings
      </Link>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-brand shadow-glow-primary">
            <Users className="h-5 w-5 text-white" aria-hidden="true" />
          </div>
          <div>
            <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              Team
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                {members.length}
              </span>
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Manage members and invitations for your organization
            </p>
          </div>
        </div>

        {!showInviteForm && (
          <Button
            type="button"
            variant="gradient"
            onClick={() => setShowInviteForm(true)}
          >
            <UserPlus className="mr-1 h-4 w-4" aria-hidden="true" />
            Invite
          </Button>
        )}
      </motion.div>

      {/* Stat tiles */}
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          icon={Users}
          label="Total members"
          value={members.length}
          tint="bg-gradient-brand"
          index={0}
        />
        <StatTile
          icon={CheckCircle2}
          label="Active members"
          value={activeCount}
          tint="bg-gradient-success"
          index={1}
        />
        <StatTile
          icon={Ban}
          label="Suspended"
          value={suspendedCount}
          tint="bg-gradient-warning"
          index={2}
        />
        <StatTile
          icon={Mail}
          label="Pending invites"
          value={pendingInvitations.length}
          tint="bg-gradient-info"
          index={3}
        />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Members + invitations, tabbed */}
        <div
          className={cn(
            "min-w-0",
            showInviteForm ? "lg:col-span-2" : "lg:col-span-3"
          )}
        >
          {/* Tabs */}
          <div
            role="tablist"
            aria-label="Team sections"
            className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-900"
          >
            {(
              [
                { id: "members", label: "Members", count: members.length },
                {
                  id: "pending",
                  label: "Pending invitations",
                  count: pendingInvitations.length,
                },
                {
                  id: "declined",
                  label: "Declined invitations",
                  count: declinedInvitations.length,
                },
              ] as const
            ).map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100"
                      : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
                  )}
                >
                  {tab.label}
                  <span
                    className={cn(
                      "nums rounded-full px-1.5 py-0.5 text-xs font-semibold",
                      isActive
                        ? "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                        : "bg-slate-200/70 text-slate-500 dark:bg-slate-700/50 dark:text-slate-400"
                    )}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Active tab content */}
          <div
            role="tabpanel"
            className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900"
          >
            {activeTab === "members" &&
              (members.length === 0 ? (
                <div className="p-5">
                  <EmptyState
                    icon={Users}
                    title="No members yet"
                    description="Invite your colleagues to collaborate in this organization."
                  />
                </div>
              ) : (
                <Table
                  className="[&_td]:px-5 [&_th]:px-5"
                  wrapperClassName="rounded-none border-0 bg-transparent"
                >
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead className="text-right">
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map((member) => (
                      <MemberRow
                        key={member.id}
                        member={member}
                        roles={roles}
                        organizationId={organizationId}
                        rolesHref={rolesHref}
                        onRequestRemove={setRemoveTarget}
                      />
                    ))}
                  </TableBody>
                </Table>
              ))}

            {activeTab === "pending" &&
              (pendingInvitations.length === 0 ? (
                <div className="p-5">
                  <EmptyState
                    icon={Mail}
                    title="No pending invitations"
                    description="Invitations you send will appear here until they're accepted."
                  />
                </div>
              ) : (
                <Table
                  className="[&_td]:px-5 [&_th]:px-5"
                  wrapperClassName="rounded-none border-0 bg-transparent"
                >
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Expiry</TableHead>
                      <TableHead className="text-right">
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingInvitations.map((invitation) => (
                      <InvitationRow
                        key={invitation.id}
                        invitation={invitation}
                        organizationId={organizationId}
                        roleName={
                          roleNameById.get(invitation.roleId) ?? "Member"
                        }
                      />
                    ))}
                  </TableBody>
                </Table>
              ))}

            {activeTab === "declined" &&
              (declinedInvitations.length === 0 ? (
                <div className="p-5">
                  <EmptyState
                    icon={MailX}
                    title="No declined invitations"
                    description="Invitations that people decline will appear here."
                  />
                </div>
              ) : (
                <Table
                  className="[&_td]:px-5 [&_th]:px-5"
                  wrapperClassName="rounded-none border-0 bg-transparent"
                >
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {declinedInvitations.map((invitation) => (
                      <DeclinedInvitationRow
                        key={invitation.id}
                        invitation={invitation}
                        organizationId={organizationId}
                        roleName={
                          roleNameById.get(invitation.roleId) ?? "Member"
                        }
                      />
                    ))}
                  </TableBody>
                </Table>
              ))}
          </div>
        </div>

        {/* Invite form */}
        {showInviteForm && (
          <div className="lg:col-span-1">
            <InviteUserForm
              organizationId={organizationId}
              roles={roles}
              branches={branches}
              onSuccess={handleInviteSuccess}
              onClose={() => setShowInviteForm(false)}
            />
          </div>
        )}
      </div>

      {removeTarget && (
        <RemoveMemberDialog
          member={removeTarget}
          organizationId={organizationId}
          onClose={() => setRemoveTarget(null)}
          onDone={() => setRemoveTarget(null)}
        />
      )}
    </div>
  );
}
