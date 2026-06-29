"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  KeyRound,
  Plus,
  Copy,
  Check,
  ShieldAlert,
  Trash2,
  X,
} from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import {
  createApiKeyAction,
  revokeApiKeyAction,
} from "@/features/api-keys/actions/api-key.actions";
import { getApiKeyStatus } from "@/features/api-keys/utils/api-key-status";
import {
  API_KEY_SCOPES,
  type ApiKey,
  type ApiKeyStatus,
} from "@/features/api-keys/types/api-key.types";

// ─────────────────────────────────────────────────────────────
// Status presentation
// ─────────────────────────────────────────────────────────────

const STATUS_VARIANT: Record<ApiKeyStatus, BadgeProps["variant"]> = {
  active: "success",
  expired: "warning",
  revoked: "muted",
};

const STATUS_LABEL: Record<ApiKeyStatus, string> = {
  active: "Active",
  expired: "Expired",
  revoked: "Revoked",
};

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

function formatDate(value: Date | null): string {
  return value ? dateFormatter.format(value) : "—";
}

// ─────────────────────────────────────────────────────────────
// Row
// ─────────────────────────────────────────────────────────────

interface ApiKeyRowProps {
  readonly apiKey: ApiKey;
  readonly canManage: boolean;
  readonly onRevoke: (apiKey: ApiKey) => void;
}

function ApiKeyRow({ apiKey, canManage, onRevoke }: ApiKeyRowProps) {
  const status = getApiKeyStatus(apiKey);
  const handleRevoke = useCallback(() => {
    onRevoke(apiKey);
  }, [apiKey, onRevoke]);

  return (
    <tr className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
      <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{apiKey.name}</td>
      <td className="px-4 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">
        {apiKey.keyPrefix}…
      </td>
      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
        {apiKey.scopes.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {apiKey.scopes.map((scope) => (
              <Badge key={scope} variant="secondary">
                {scope}
              </Badge>
            ))}
          </div>
        ) : (
          "—"
        )}
      </td>
      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{formatDate(apiKey.createdAt)}</td>
      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
        {formatDate(apiKey.lastUsedAt)}
      </td>
      <td className="px-4 py-3">
        <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>
      </td>
      <td className="px-4 py-3 text-right">
        {canManage && status === "active" && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleRevoke}
            aria-label={`Revoke ${apiKey.name}`}
          >
            <Trash2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Revoke
          </Button>
        )}
      </td>
    </tr>
  );
}

// ─────────────────────────────────────────────────────────────
// One-time reveal panel
// ─────────────────────────────────────────────────────────────

interface RevealPanelProps {
  readonly plaintextKey: string;
  readonly onDismiss: () => void;
}

function RevealPanel({ plaintextKey, onDismiss }: RevealPanelProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(plaintextKey);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [plaintextKey]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      role="alert"
      className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10"
    >
      <div className="flex items-start gap-3">
        <ShieldAlert
          className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400"
          aria-hidden="true"
        />
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            Copy your API key now
          </h3>
          <p className="mt-0.5 text-sm text-amber-800 dark:text-amber-300">
            This is the only time the full key will be shown. Store it securely —
            you won&apos;t be able to see it again.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <code className="flex-1 break-all rounded-lg border border-amber-200 bg-white px-3 py-2 font-mono text-xs text-slate-800 dark:border-amber-500/30 dark:bg-slate-900 dark:text-slate-100">
              {plaintextKey}
            </code>
            <Button type="button" variant="outline" onClick={handleCopy}>
              {copied ? (
                <Check className="mr-1.5 h-4 w-4" aria-hidden="true" />
              ) : (
                <Copy className="mr-1.5 h-4 w-4" aria-hidden="true" />
              )}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onDismiss}
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────
// View
// ─────────────────────────────────────────────────────────────

interface ApiKeysViewProps {
  readonly organizationId: string;
  readonly apiKeys: readonly ApiKey[];
  readonly canManage: boolean;
}

export function ApiKeysView({
  organizationId,
  apiKeys,
  canManage,
}: ApiKeysViewProps) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<readonly string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [revealKey, setRevealKey] = useState<string | null>(null);
  const [pendingRevoke, setPendingRevoke] = useState<ApiKey | null>(null);
  const [isCreating, startCreate] = useTransition();
  const [isRevoking, startRevoke] = useTransition();

  const resetForm = useCallback(() => {
    setName("");
    setExpiresAt("");
    setSelectedScopes([]);
    setFormError(null);
  }, []);

  const handleToggleForm = useCallback(() => {
    setShowForm((open) => !open);
    setFormError(null);
  }, []);

  const handleScopeChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const { value, checked } = event.target;
      setSelectedScopes((current) =>
        checked
          ? [...current, value]
          : current.filter((scope) => scope !== value)
      );
    },
    []
  );

  const handleCreate = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setFormError(null);

      const formData = new FormData();
      formData.set("name", name.trim());
      if (expiresAt) {
        formData.set("expiresAt", expiresAt);
      }
      selectedScopes.forEach((scope) => formData.append("scopes", scope));

      startCreate(async () => {
        const result = await createApiKeyAction(organizationId, formData);
        if (!result.success) {
          setFormError(result.error.message);
          return;
        }
        setRevealKey(result.data.plaintextKey);
        setShowForm(false);
        resetForm();
        router.refresh();
      });
    },
    [name, expiresAt, selectedScopes, organizationId, resetForm, router]
  );

  const handleRequestRevoke = useCallback((apiKey: ApiKey) => {
    setPendingRevoke(apiKey);
  }, []);

  const handleCancelRevoke = useCallback(() => {
    setPendingRevoke(null);
  }, []);

  const handleConfirmRevoke = useCallback(() => {
    if (!pendingRevoke) {
      return;
    }
    const target = pendingRevoke;
    startRevoke(async () => {
      const result = await revokeApiKeyAction(organizationId, target.id);
      if (result.success) {
        setPendingRevoke(null);
        router.refresh();
      }
    });
  }, [pendingRevoke, organizationId, router]);

  const handleDismissReveal = useCallback(() => {
    setRevealKey(null);
  }, []);

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title="API keys"
        description="Generate and manage keys for programmatic access to your organization"
        icon={KeyRound}
      >
        {canManage && (
          <Button type="button" onClick={handleToggleForm}>
            <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Create key
          </Button>
        )}
      </PageHeader>

      {revealKey && (
        <RevealPanel plaintextKey={revealKey} onDismiss={handleDismissReveal} />
      )}

      {/* Create form */}
      {canManage && showForm && (
        <motion.form
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          onSubmit={handleCreate}
          className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          aria-label="Create API key"
        >
          {formError && (
            <p
              role="alert"
              className="mb-4 rounded-lg border border-error-200 bg-error-50 px-3 py-2.5 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300"
            >
              {formError}
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="api-key-name"
                className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Name
              </label>
              <input
                id="api-key-name"
                name="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Production server"
                required
                className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition-colors hover:border-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder-slate-500 dark:hover:border-slate-600"
              />
            </div>
            <div>
              <label
                htmlFor="api-key-expiry"
                className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Expiry (optional)
              </label>
              <input
                id="api-key-expiry"
                name="expiresAt"
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm transition-colors hover:border-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-slate-600"
              />
            </div>
          </div>

          <fieldset className="mt-4">
            <legend className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              Scopes
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {API_KEY_SCOPES.map((scope) => (
                <label
                  key={scope.value}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:border-slate-300 dark:border-slate-800 dark:text-slate-300 dark:hover:border-slate-700"
                >
                  <input
                    type="checkbox"
                    name="scopes"
                    value={scope.value}
                    checked={selectedScopes.includes(scope.value)}
                    onChange={handleScopeChange}
                    className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500 dark:border-slate-700"
                  />
                  {scope.label}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="mt-5 flex items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={handleToggleForm}>
              Cancel
            </Button>
            <Button type="submit" loading={isCreating}>
              Generate key
            </Button>
          </div>
        </motion.form>
      )}

      {/* Revoke confirmation */}
      {pendingRevoke && (
        <div
          role="alertdialog"
          aria-label="Revoke API key"
          className="mt-6 rounded-xl border border-error-200 bg-error-50 p-4 dark:border-error-500/30 dark:bg-error-500/10"
        >
          <p className="text-sm text-error-800 dark:text-error-300">
            Revoke <span className="font-semibold">{pendingRevoke.name}</span>?
            Any integration using this key will immediately stop working. This
            cannot be undone.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmRevoke}
              loading={isRevoking}
            >
              Revoke key
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleCancelRevoke}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Table / empty state */}
      <div className="mt-6">
        {apiKeys.length === 0 ? (
          <EmptyState
            icon={KeyRound}
            title="No API keys yet"
            description={
              canManage
                ? "Create an API key to give external systems secure, scoped access to your organization."
                : "No API keys have been created for this organization yet."
            }
            action={
              canManage
                ? {
                    label: "Create your first key",
                    icon: Plus,
                    onClick: handleToggleForm,
                  }
                : undefined
            }
          />
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Name
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Key
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Scopes
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Created
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Last used
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Status
                    </th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {apiKeys.map((apiKey) => (
                    <ApiKeyRow
                      key={apiKey.id}
                      apiKey={apiKey}
                      canManage={canManage}
                      onRevoke={handleRequestRevoke}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
