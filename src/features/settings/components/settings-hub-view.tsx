"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Users,
  ShieldCheck,
  KeyRound,
  ScrollText,
  CheckSquare,
  Settings as SettingsIcon,
  ArrowUpRight,
  type LucideIcon,
} from "lucide-react";

interface SettingsSection {
  readonly key: string;
  readonly label: string;
  readonly description: string;
  readonly href: string;
  readonly icon: LucideIcon;
  /** Permission required to see this section. */
  readonly permission: string;
}

const SECTIONS: readonly SettingsSection[] = [
  {
    key: "team",
    label: "Team",
    description: "Invite members and manage who has access.",
    href: "/settings/team",
    icon: Users,
    permission: "settings.users",
  },
  {
    key: "roles",
    label: "Roles & Permissions",
    description: "Create custom roles and fine-tune what each can do.",
    href: "/settings/roles",
    icon: ShieldCheck,
    permission: "role.view",
  },
  {
    key: "api-keys",
    label: "API Keys",
    description: "Issue and revoke keys for programmatic access.",
    href: "/settings/api-keys",
    icon: KeyRound,
    permission: "api_key.view",
  },
  {
    key: "approvals",
    label: "Approvals",
    description: "Configure approval rules and action pending requests.",
    href: "/settings/approvals",
    icon: CheckSquare,
    permission: "approval.view",
  },
  // Webhooks and Workflows are hidden from the hub until they have real use
  // cases (more emitted events / richer step types) and an SSRF guard. Their
  // routes and code remain — restore these entries to re-enable.
  {
    key: "audit",
    label: "Audit Center",
    description: "Review the immutable trail of every action.",
    href: "/settings/audit",
    icon: ScrollText,
    permission: "audit.view",
  },
];

interface SettingsHubViewProps {
  readonly permissions: readonly string[];
}

/** Permission-aware launcher for all organization settings sections. */
export function SettingsHubView({ permissions }: SettingsHubViewProps) {
  const visible = SECTIONS.filter((s) => permissions.includes(s.permission));

  return (
    <div className="space-y-4 p-4 lg:p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-brand shadow-glow-primary">
          <SettingsIcon className="h-5 w-5 text-white" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Settings</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Manage your organization, access control, and integrations.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((section, index) => {
          const Icon = section.icon;
          return (
            <motion.div
              key={section.key}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: index * 0.03 }}
            >
              <Link
                href={section.href}
                className="group flex h-full items-start gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-card transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-brand text-white shadow-glow-primary">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {section.label}
                    </h2>
                    <ArrowUpRight
                      className="h-4 w-4 shrink-0 text-slate-300 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary-500 dark:text-slate-600 dark:group-hover:text-primary-400"
                      aria-hidden="true"
                    />
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                    {section.description}
                  </p>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
