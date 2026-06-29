"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Network, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { ConnectionCard } from "@/features/cbn/components/ConnectionCard";
import type { BusinessConnection, ConnectionStatus } from "@/features/cbn/types/cbn.types";

type Tab = "all" | "accepted" | "pending" | "rejected" | "disconnected";

const TAB_OPTIONS: { value: Tab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "accepted", label: "Connected" },
  { value: "pending", label: "Pending" },
  { value: "rejected", label: "Rejected" },
  { value: "disconnected", label: "Disconnected" },
];

interface OrgNameMap {
  [orgId: string]: { name: string; businessId?: string | null };
}

interface ConnectionListProps {
  readonly connections: readonly BusinessConnection[];
  readonly myOrgId: string;
  readonly orgNames: OrgNameMap;
}

function filterByTab(
  connections: readonly BusinessConnection[],
  tab: Tab
): BusinessConnection[] {
  if (tab === "all") {return [...connections];}
  return connections.filter((c) => c.status === (tab as ConnectionStatus));
}

/**
 * Filterable list of business connections with tab navigation.
 */
export function ConnectionList({
  connections,
  myOrgId,
  orgNames,
}: ConnectionListProps) {
  const [activeTab, setActiveTab] = useState<Tab>("all");
  const router = useRouter();

  const filtered = filterByTab(connections, activeTab);

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div
        className="flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1"
        role="tablist"
        aria-label="Filter connections"
      >
        {TAB_OPTIONS.map((tab) => {
          const count =
            tab.value === "all"
              ? connections.length
              : connections.filter((c) => c.status === tab.value).length;

          return (
            <button
              key={tab.value}
              role="tab"
              aria-selected={activeTab === tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                activeTab === tab.value
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab.label}
              {count > 0 && (
                <span
                  className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                    activeTab === tab.value
                      ? "bg-teal-100 text-teal-700"
                      : "bg-slate-200 text-slate-500"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* List */}
      <AnimatePresence mode="wait">
        {filtered.length === 0 ? (
          <EmptyState
            icon={Network}
            title={
              activeTab === "all"
                ? "No connections yet"
                : `No ${activeTab} connections`
            }
            description={
              activeTab === "all"
                ? "Discover businesses on the CBN network and send connection requests to start exchanging digital documents."
                : undefined
            }
            action={
              activeTab === "all"
                ? {
                    label: "Discover Businesses",
                    onClick: () => router.push("/cbn/discover"),
                    icon: Plus,
                  }
                : undefined
            }
          />
        ) : (
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="space-y-2"
            role="tabpanel"
          >
            {filtered.map((connection) => {
              const otherOrgId =
                connection.requesterOrganizationId === myOrgId
                  ? connection.recipientOrganizationId
                  : connection.requesterOrganizationId;
              const orgInfo = orgNames[otherOrgId];

              return (
                <ConnectionCard
                  key={connection.id}
                  connection={connection}
                  myOrgId={myOrgId}
                  otherOrgName={orgInfo?.name ?? otherOrgId}
                  otherBusinessId={orgInfo?.businessId}
                />
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Discover CTA when there are connections */}
      {filtered.length > 0 && (
        <Button
          variant="outline"
          size="sm"
          className="border-teal-200 text-teal-700 hover:bg-teal-50"
          onClick={() => router.push("/cbn/discover")}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
          Discover More Businesses
        </Button>
      )}
    </div>
  );
}
