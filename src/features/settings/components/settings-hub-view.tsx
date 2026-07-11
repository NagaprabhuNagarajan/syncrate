"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Users,
  Building2,
  ShieldCheck,
  KeyRound,
  ScrollText,
  CheckSquare,
  Webhook,
  Workflow as WorkflowIcon,
  Settings as SettingsIcon,
  type LucideIcon,
} from "lucide-react";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
    key: "organization",
    label: "Organization",
    description:
      "Update business details and state — sets CGST/SGST vs IGST on sales.",
    href: "/organization",
    icon: Building2,
    permission: "settings.manage",
  },
  {
    key: "team",
    label: "Team",
    description: "Invite members and manage who has access.",
    href: "/team",
    icon: Users,
    permission: "settings.users",
  },
  {
    key: "branches",
    label: "Branches",
    description: "Manage business locations and branch settings.",
    href: "/branches",
    icon: Building2,
    permission: "settings.branches",
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
  {
    key: "webhooks",
    label: "Webhooks",
    description: "Deliver signed events to your external systems.",
    href: "/settings/webhooks",
    icon: Webhook,
    permission: "webhook.view",
  },
  {
    key: "workflows",
    label: "Workflows",
    description: "Automate multi-step processes triggered by events.",
    href: "/settings/workflows",
    icon: WorkflowIcon,
    permission: "workflow.view",
  },
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((section, index) => {
          const Icon = section.icon;
          return (
            <motion.div
              key={section.key}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: index * 0.03 }}
            >
              <Link href={section.href} className="block h-full">
                <Card hover className="h-full">
                  <CardHeader>
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-brand text-white shadow-glow-primary">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <CardTitle className="mt-3 text-base">
                      {section.label}
                    </CardTitle>
                    <CardDescription>{section.description}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
