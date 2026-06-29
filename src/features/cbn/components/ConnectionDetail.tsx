"use client";

import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import {
  Settings2,
  FileText,
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  Unplug,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { BadgeProps } from "@/components/ui/badge";
import {
  updateConnectionPermissions,
  disconnectBusiness,
} from "@/features/cbn/actions/connection.actions";
import { VerificationBadge } from "@/features/cbn/components/VerificationBadge";
import { TrustScoreBadge } from "@/features/cbn/components/TrustScoreBadge";
import type {
  BusinessConnection,
  ConnectionStatus,
  CbnSharedDocument,
  CbnEvent,
} from "@/features/cbn/types/cbn.types";

type DetailTab = "overview" | "documents" | "events";

const STATUS_VARIANT: Record<ConnectionStatus, BadgeProps["variant"]> = {
  pending: "warning",
  accepted: "success",
  rejected: "destructive",
  blocked: "destructive",
  disconnected: "muted",
};

const CONNECTION_PERMISSIONS = [
  { id: "receive_invoices", label: "Receive Invoices" },
  { id: "receive_purchase_orders", label: "Receive Purchase Orders" },
  { id: "receive_quotations", label: "Receive Quotations" },
  { id: "view_catalog", label: "View Supplier Catalog" },
  { id: "view_stock", label: "View Stock Levels" },
  { id: "receive_payments", label: "Receive Payment Notifications" },
  { id: "share_documents", label: "Share Documents" },
  { id: "receive_delivery_updates", label: "Receive Delivery Updates" },
  { id: "view_pricing", label: "View Pricing" },
] as const;

interface OtherOrgInfo {
  readonly name: string;
  readonly businessId?: string | null;
  readonly verificationLevel?: number;
  readonly trustScore?: number;
}

interface ConnectionDetailProps {
  readonly connection: BusinessConnection;
  readonly myOrgId: string;
  readonly otherOrg: OtherOrgInfo;
  readonly sharedDocuments: readonly CbnSharedDocument[];
  readonly events: readonly CbnEvent[];
}

function formatDate(d: Date | null): string {
  if (!d) {return "—";}
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getEventIcon(eventType: string): React.ComponentType<{ className?: string }> {
  if (eventType.includes("accepted") || eventType.includes("success")) {return CheckCircle2;}
  if (eventType.includes("rejected") || eventType.includes("failed")) {return XCircle;}
  if (eventType.includes("pending")) {return Clock;}
  return Activity;
}

// ─── Tab: Overview ───────────────────────────────────────────

function OverviewTab({
  connection,
  myOrgId,
  otherOrg,
}: {
  readonly connection: BusinessConnection;
  readonly myOrgId: string;
  readonly otherOrg: OtherOrgInfo;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Determine which grants array is "mine"
  const isRequester = connection.requesterOrganizationId === myOrgId;
  const myGrants = isRequester
    ? connection.requesterGrants
    : connection.recipientGrants;

  const [selectedGrants, setSelectedGrants] = useState<string[]>([...myGrants]);

  const handleToggle = (id: string): void => {
    setSelectedGrants((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
    );
    setSaved(false);
  };

  const handleSave = (): void => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updateConnectionPermissions(
        connection.id,
        myOrgId,
        selectedGrants
      );
      if (!result.success) {
        setError(result.error.message);
        return;
      }
      setSaved(true);
    });
  };

  const [disconnecting, startDisconnect] = useTransition();
  const [disconnectError, setDisconnectError] = useState<string | null>(null);

  const handleDisconnect = (): void => {
    if (!window.confirm(`Disconnect from ${otherOrg.name}? This will stop all document syncing.`)) {return;}
    setDisconnectError(null);
    startDisconnect(async () => {
      const result = await disconnectBusiness(connection.id, myOrgId);
      if (!result.success) {
        setDisconnectError(result.error.message);
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Other org info */}
      <div className="flex items-start gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-teal-100 text-base font-bold text-teal-700 dark:bg-teal-500/20 dark:text-teal-300">
          {otherOrg.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-900 dark:text-slate-100">{otherOrg.name}</h3>
          {otherOrg.businessId && (
            <p className="font-mono text-xs text-slate-400 dark:text-slate-500">{otherOrg.businessId}</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {otherOrg.verificationLevel !== undefined && (
              <VerificationBadge level={otherOrg.verificationLevel} />
            )}
          </div>
        </div>
        {otherOrg.trustScore !== undefined && (
          <TrustScoreBadge score={otherOrg.trustScore} size="sm" />
        )}
      </div>

      {/* Connection meta */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Status</p>
          <Badge variant={STATUS_VARIANT[connection.status]} className="mt-1">
            {connection.status}
          </Badge>
        </div>
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Requested</p>
          <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">
            {formatDate(connection.requestedAt)}
          </p>
        </div>
        {connection.acceptedAt && (
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Connected since</p>
            <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">
              {formatDate(connection.acceptedAt)}
            </p>
          </div>
        )}
        {connection.connectionMessage && (
          <div className="col-span-2 sm:col-span-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">Connection message</p>
            <p className="mt-1 text-sm text-slate-700 italic dark:text-slate-300">
              &ldquo;{connection.connectionMessage}&rdquo;
            </p>
          </div>
        )}
      </div>

      {/* Permissions */}
      {connection.status === "accepted" && (
        <div>
          <h4 className="mb-3 font-medium text-slate-900 dark:text-slate-100">
            Permissions you grant to {otherOrg.name}
          </h4>
          <div className="space-y-2">
            {CONNECTION_PERMISSIONS.map((perm) => (
              <label
                key={perm.id}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800/50"
              >
                <input
                  type="checkbox"
                  checked={selectedGrants.includes(perm.id)}
                  onChange={() => handleToggle(perm.id)}
                  className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 dark:border-slate-700"
                />
                <span className="text-sm text-slate-700 dark:text-slate-300">{perm.label}</span>
              </label>
            ))}
          </div>

          {error && (
            <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
          {saved && (
            <p className="mt-3 text-sm text-green-600 dark:text-green-400">Permissions saved.</p>
          )}

          <div className="mt-4 flex gap-2">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isPending}
              className="bg-teal-600 hover:bg-teal-700"
            >
              {isPending ? "Saving…" : "Save Permissions"}
            </Button>
          </div>
        </div>
      )}

      {/* Danger zone */}
      {connection.status === "accepted" && (
        <div className="rounded-xl border border-red-100 bg-red-50 p-4 dark:border-red-500/20 dark:bg-red-500/10">
          <h4 className="text-sm font-semibold text-red-900 dark:text-red-200">Danger Zone</h4>
          <p className="mt-1 text-sm text-red-700 dark:text-red-300">
            Disconnecting will stop all document syncing. This action can be reversed
            by sending a new connection request.
          </p>
          {disconnectError && (
            <p role="alert" className="mt-2 text-sm text-red-800 dark:text-red-300">
              {disconnectError}
            </p>
          )}
          <Button
            size="sm"
            variant="outline"
            className="mt-3 border-red-200 text-red-700 hover:bg-red-100 dark:border-red-500/30 dark:text-red-300 dark:hover:bg-red-500/20"
            onClick={handleDisconnect}
            disabled={disconnecting}
          >
            <Unplug className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            {disconnecting ? "Disconnecting…" : "Disconnect"}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Shared Documents ───────────────────────────────────

function DocumentsTab({
  documents,
}: {
  readonly documents: readonly CbnSharedDocument[];
}) {
  if (documents.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
        No shared documents yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" aria-label="Shared documents">
        <thead>
          <tr className="border-b border-slate-200 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <th className="py-2 pr-4 text-left font-medium">Type</th>
            <th className="py-2 pr-4 text-left font-medium">Number</th>
            <th className="py-2 pr-4 text-left font-medium">Date</th>
            <th className="py-2 pr-4 text-right font-medium">Amount</th>
            <th className="py-2 text-left font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {documents.map((doc) => (
            <tr key={doc.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
              <td className="py-2 pr-4 capitalize">
                {doc.documentType.replace(/_/g, " ")}
              </td>
              <td className="py-2 pr-4 font-mono text-xs">
                {doc.documentNumber ?? "—"}
              </td>
              <td className="py-2 pr-4 text-slate-500 dark:text-slate-400">
                {doc.documentDate ?? "—"}
              </td>
              <td className="py-2 pr-4 text-right">
                {doc.amount !== null
                  ? new Intl.NumberFormat("en-IN", {
                      style: "currency",
                      currency: doc.currency,
                      maximumFractionDigits: 0,
                    }).format(doc.amount)
                  : "—"}
              </td>
              <td className="py-2">
                <Badge
                  variant={
                    doc.status === "active"
                      ? "success"
                      : doc.status === "revoked"
                        ? "destructive"
                        : "muted"
                  }
                >
                  {doc.status}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Tab: Events ─────────────────────────────────────────────

function EventsTab({
  events,
}: {
  readonly events: readonly CbnEvent[];
}) {
  if (events.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
        No events recorded yet.
      </p>
    );
  }

  return (
    <ol className="relative space-y-4 border-l border-slate-200 pl-4 dark:border-slate-800" aria-label="Connection events">
      {events.map((event) => {
        const Icon = getEventIcon(event.eventType);
        const isSuccess = event.status === "success";
        const isFailed = event.status === "failed";

        return (
          <li key={event.id} className="relative">
            <div
              className={`absolute -left-[21px] flex h-5 w-5 items-center justify-center rounded-full border-2 border-white dark:border-slate-900 ${
                isSuccess
                  ? "bg-green-100 dark:bg-green-500/20"
                  : isFailed
                    ? "bg-red-100 dark:bg-red-500/20"
                    : "bg-yellow-100 dark:bg-yellow-500/20"
              }`}
              aria-hidden="true"
            >
              <Icon
                className={`h-3 w-3 ${
                  isSuccess
                    ? "text-green-600 dark:text-green-400"
                    : isFailed
                      ? "text-red-600 dark:text-red-400"
                      : "text-yellow-600 dark:text-yellow-400"
                }`}
              />
            </div>

            <div className="rounded-lg border border-slate-100 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-slate-900 capitalize dark:text-slate-100">
                  {event.eventType.replace(/_/g, " ")}
                </p>
                <time
                  dateTime={event.createdAt.toISOString()}
                  className="shrink-0 text-xs text-slate-400 dark:text-slate-500"
                >
                  {new Date(event.createdAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
              </div>
              {event.errorMessage && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">{event.errorMessage}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// ─── Main component ──────────────────────────────────────────

const TABS: { value: DetailTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "overview", label: "Overview", icon: Settings2 },
  { value: "documents", label: "Documents", icon: FileText },
  { value: "events", label: "Events", icon: Activity },
];

/**
 * Full connection detail view with tabbed navigation.
 */
export function ConnectionDetail({
  connection,
  myOrgId,
  otherOrg,
  sharedDocuments,
  events,
}: ConnectionDetailProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div
        className="flex gap-1 border-b border-slate-200 dark:border-slate-800"
        role="tablist"
        aria-label="Connection detail tabs"
      >
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.value}
              role="tab"
              aria-selected={activeTab === tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === tab.value
                  ? "border-teal-600 text-teal-700 dark:text-teal-300"
                  : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab panel */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.15 }}
        role="tabpanel"
      >
        {activeTab === "overview" && (
          <OverviewTab
            connection={connection}
            myOrgId={myOrgId}
            otherOrg={otherOrg}
          />
        )}
        {activeTab === "documents" && (
          <DocumentsTab documents={sharedDocuments} />
        )}
        {activeTab === "events" && <EventsTab events={events} />}
      </motion.div>
    </div>
  );
}
