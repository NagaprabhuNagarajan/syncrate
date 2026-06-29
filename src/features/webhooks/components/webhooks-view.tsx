"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Webhook,
  Plus,
  Copy,
  Check,
  ShieldAlert,
  Trash2,
  X,
  Pencil,
  Send,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import {
  createWebhookEndpointAction,
  updateWebhookEndpointAction,
  deleteWebhookEndpointAction,
  sendTestWebhookAction,
} from "@/features/webhooks/actions/webhook.actions";
import {
  WEBHOOK_EVENT_TYPES,
  type WebhookDelivery,
  type WebhookDeliveryStatus,
  type WebhookEndpoint,
} from "@/features/webhooks/types/webhook.types";

// ─────────────────────────────────────────────────────────────
// Presentation helpers
// ─────────────────────────────────────────────────────────────

const EVENT_LABELS: Record<string, string> = Object.fromEntries(
  WEBHOOK_EVENT_TYPES.map((e) => [e.value, e.label])
);

const STATUS_VARIANT: Record<WebhookDeliveryStatus, BadgeProps["variant"]> = {
  pending: "muted",
  success: "success",
  failed: "destructive",
};

const STATUS_LABEL: Record<WebhookDeliveryStatus, string> = {
  pending: "Pending",
  success: "Success",
  failed: "Failed",
};

const dateTimeFormatter = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatDateTime(value: Date | null): string {
  return value ? dateTimeFormatter.format(value) : "—";
}

function eventLabel(value: string): string {
  return EVENT_LABELS[value] ?? value;
}

// ─────────────────────────────────────────────────────────────
// One-time secret reveal panel
// ─────────────────────────────────────────────────────────────

interface SecretRevealPanelProps {
  readonly secret: string;
  readonly onDismiss: () => void;
}

function SecretRevealPanel({ secret, onDismiss }: SecretRevealPanelProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [secret]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      role="alert"
      className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4"
    >
      <div className="flex items-start gap-3">
        <ShieldAlert
          className="mt-0.5 h-5 w-5 shrink-0 text-amber-600"
          aria-hidden="true"
        />
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-amber-900">
            Copy your signing secret now
          </h3>
          <p className="mt-0.5 text-sm text-amber-800">
            This is the only time the signing secret will be shown. Store it
            securely — you won&apos;t be able to see it again. Use it to verify
            the signature on every delivery.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <code className="flex-1 break-all rounded-lg border border-amber-200 bg-white px-3 py-2 font-mono text-xs text-slate-800">
              {secret}
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
// Endpoint form (create + edit)
// ─────────────────────────────────────────────────────────────

interface EndpointFormProps {
  readonly organizationId: string;
  readonly endpoint?: WebhookEndpoint;
  readonly onCancel: () => void;
  readonly onCreated: (secret: string) => void;
  readonly onSaved: () => void;
}

function EndpointForm({
  organizationId,
  endpoint,
  onCancel,
  onCreated,
  onSaved,
}: EndpointFormProps) {
  const isEdit = endpoint !== undefined;
  const [url, setUrl] = useState(endpoint?.url ?? "");
  const [description, setDescription] = useState(endpoint?.description ?? "");
  const [eventTypes, setEventTypes] = useState<readonly string[]>(
    endpoint?.eventTypes ?? []
  );
  const [isActive, setIsActive] = useState(endpoint?.isActive ?? true);
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleUrlChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setUrl(event.target.value);
    },
    []
  );

  const handleDescriptionChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setDescription(event.target.value);
    },
    []
  );

  const handleActiveChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setIsActive(event.target.checked);
    },
    []
  );

  const handleEventToggle = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const { value, checked } = event.target;
      setEventTypes((current) =>
        checked
          ? [...current, value]
          : current.filter((type) => type !== value)
      );
    },
    []
  );

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setFormError(null);

      const formData = new FormData();
      formData.set("url", url.trim());
      formData.set("description", description.trim());
      eventTypes.forEach((type) => formData.append("eventTypes", type));
      formData.set("isActive", isActive ? "true" : "false");

      startTransition(async () => {
        if (isEdit && endpoint) {
          formData.set("version", String(endpoint.version));
          const result = await updateWebhookEndpointAction(
            organizationId,
            endpoint.id,
            formData
          );
          if (!result.success) {
            setFormError(result.error.message);
            return;
          }
          onSaved();
          return;
        }

        const result = await createWebhookEndpointAction(
          organizationId,
          formData
        );
        if (!result.success) {
          setFormError(result.error.message);
          return;
        }
        onCreated(result.data.secret);
      });
    },
    [
      url,
      description,
      eventTypes,
      isActive,
      isEdit,
      endpoint,
      organizationId,
      onCreated,
      onSaved,
    ]
  );

  return (
    <motion.form
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      onSubmit={handleSubmit}
      className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
      aria-label={isEdit ? "Edit webhook endpoint" : "Create webhook endpoint"}
    >
      {formError && (
        <p
          role="alert"
          className="mb-4 rounded-lg border border-error-200 bg-error-50 px-3 py-2.5 text-sm text-error-700"
        >
          {formError}
        </p>
      )}

      <div className="grid gap-4">
        <div>
          <label
            htmlFor="webhook-url"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Endpoint URL
          </label>
          <input
            id="webhook-url"
            name="url"
            type="url"
            inputMode="url"
            value={url}
            onChange={handleUrlChange}
            placeholder="https://example.com/webhooks/syncrate"
            required
            className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition-colors hover:border-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <p className="mt-1 text-xs text-slate-500">
            Must be an HTTPS URL. We will POST signed JSON payloads here.
          </p>
        </div>

        <div>
          <label
            htmlFor="webhook-description"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Description (optional)
          </label>
          <input
            id="webhook-description"
            name="description"
            type="text"
            value={description}
            onChange={handleDescriptionChange}
            placeholder="e.g. Sync invoices to accounting system"
            className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition-colors hover:border-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      <fieldset className="mt-4">
        <legend className="mb-2 text-sm font-medium text-slate-700">
          Events
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {WEBHOOK_EVENT_TYPES.map((eventType) => (
            <label
              key={eventType.value}
              className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:border-slate-300"
            >
              <input
                type="checkbox"
                name="eventTypes"
                value={eventType.value}
                checked={eventTypes.includes(eventType.value)}
                onChange={handleEventToggle}
                className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
              />
              {eventType.label}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="mt-4 flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          name="isActive"
          checked={isActive}
          onChange={handleActiveChange}
          className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
        />
        Active — deliver events to this endpoint
      </label>

      <div className="mt-5 flex items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={isPending}>
          {isEdit ? "Save changes" : "Create endpoint"}
        </Button>
      </div>
    </motion.form>
  );
}

// ─────────────────────────────────────────────────────────────
// Deliveries log
// ─────────────────────────────────────────────────────────────

interface DeliveriesLogProps {
  readonly deliveries: readonly WebhookDelivery[];
}

function DeliveriesLog({ deliveries }: DeliveriesLogProps) {
  if (deliveries.length === 0) {
    return (
      <p className="px-4 py-4 text-sm text-slate-500">
        No deliveries yet. Send a test event to verify your endpoint.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-y border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th scope="col" className="px-4 py-2.5 font-medium">
              Event
            </th>
            <th scope="col" className="px-4 py-2.5 font-medium">
              Status
            </th>
            <th scope="col" className="px-4 py-2.5 font-medium">
              Response
            </th>
            <th scope="col" className="px-4 py-2.5 font-medium">
              Attempts
            </th>
            <th scope="col" className="px-4 py-2.5 font-medium">
              Time
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {deliveries.map((delivery) => (
            <tr key={delivery.id}>
              <td className="px-4 py-2.5 font-mono text-xs text-slate-700">
                {delivery.eventType}
              </td>
              <td className="px-4 py-2.5">
                <Badge variant={STATUS_VARIANT[delivery.status]}>
                  {STATUS_LABEL[delivery.status]}
                </Badge>
              </td>
              <td className="px-4 py-2.5 text-slate-600">
                {delivery.responseStatus ?? "—"}
              </td>
              <td className="px-4 py-2.5 text-slate-600">
                {delivery.attempts}
              </td>
              <td className="px-4 py-2.5 text-slate-600">
                {formatDateTime(delivery.createdAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Endpoint card
// ─────────────────────────────────────────────────────────────

interface EndpointCardProps {
  readonly endpoint: WebhookEndpoint;
  readonly deliveries: readonly WebhookDelivery[];
  readonly canManage: boolean;
  readonly isExpanded: boolean;
  readonly onToggleExpand: (endpoint: WebhookEndpoint) => void;
  readonly onEdit: (endpoint: WebhookEndpoint) => void;
  readonly onDelete: (endpoint: WebhookEndpoint) => void;
  readonly onSendTest: (endpoint: WebhookEndpoint) => void;
  readonly isTesting: boolean;
}

function EndpointCard({
  endpoint,
  deliveries,
  canManage,
  isExpanded,
  onToggleExpand,
  onEdit,
  onDelete,
  onSendTest,
  isTesting,
}: EndpointCardProps) {
  const lastDelivery = deliveries[0] ?? null;

  const handleToggle = useCallback(() => {
    onToggleExpand(endpoint);
  }, [endpoint, onToggleExpand]);
  const handleEdit = useCallback(() => {
    onEdit(endpoint);
  }, [endpoint, onEdit]);
  const handleDelete = useCallback(() => {
    onDelete(endpoint);
  }, [endpoint, onDelete]);
  const handleSendTest = useCallback(() => {
    onSendTest(endpoint);
  }, [endpoint, onSendTest]);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="break-all font-mono text-sm font-medium text-slate-900">
              {endpoint.url}
            </span>
            <Badge variant={endpoint.isActive ? "success" : "muted"}>
              {endpoint.isActive ? "Active" : "Inactive"}
            </Badge>
          </div>
          {endpoint.description && (
            <p className="mt-1 text-sm text-slate-600">
              {endpoint.description}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-1">
            {endpoint.eventTypes.map((type) => (
              <Badge key={type} variant="secondary">
                {eventLabel(type)}
              </Badge>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Last delivery:{" "}
            {lastDelivery ? (
              <>
                <span className="font-medium text-slate-700">
                  {STATUS_LABEL[lastDelivery.status]}
                </span>{" "}
                · {formatDateTime(lastDelivery.createdAt)}
              </>
            ) : (
              "Never"
            )}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {canManage && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSendTest}
              loading={isTesting}
              aria-label={`Send test event to ${endpoint.url}`}
            >
              <Send className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Send test
            </Button>
          )}
          {canManage && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleEdit}
              aria-label={`Edit ${endpoint.url}`}
            >
              <Pencil className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Edit
            </Button>
          )}
          {canManage && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              aria-label={`Delete ${endpoint.url}`}
            >
              <Trash2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Delete
            </Button>
          )}
        </div>
      </div>

      <div className="border-t border-slate-100">
        <button
          type="button"
          onClick={handleToggle}
          aria-expanded={isExpanded}
          className="flex w-full items-center gap-1.5 px-5 py-2.5 text-left text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          ) : (
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          )}
          Recent deliveries ({deliveries.length})
        </button>
        {isExpanded && <DeliveriesLog deliveries={deliveries} />}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// View
// ─────────────────────────────────────────────────────────────

interface WebhooksViewProps {
  readonly organizationId: string;
  readonly endpoints: readonly WebhookEndpoint[];
  readonly deliveriesByEndpoint: Readonly<
    Record<string, readonly WebhookDelivery[]>
  >;
  readonly canManage: boolean;
}

const EMPTY_DELIVERIES: readonly WebhookDelivery[] = [];

export function WebhooksView({
  organizationId,
  endpoints,
  deliveriesByEndpoint,
  canManage,
}: WebhooksViewProps) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<WebhookEndpoint | null>(null);
  const [revealSecret, setRevealSecret] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<WebhookEndpoint | null>(
    null
  );
  const [testingId, setTestingId] = useState<string | null>(null);
  const [isDeleting, startDelete] = useTransition();
  const [isTesting, startTest] = useTransition();

  const handleShowCreate = useCallback(() => {
    setEditing(null);
    setShowCreate(true);
  }, []);

  const handleCancelForm = useCallback(() => {
    setShowCreate(false);
    setEditing(null);
  }, []);

  const handleCreated = useCallback(
    (secret: string) => {
      setShowCreate(false);
      setRevealSecret(secret);
      router.refresh();
    },
    [router]
  );

  const handleSaved = useCallback(() => {
    setEditing(null);
    setShowCreate(false);
    router.refresh();
  }, [router]);

  const handleEdit = useCallback((endpoint: WebhookEndpoint) => {
    setShowCreate(false);
    setEditing(endpoint);
  }, []);

  const handleToggleExpand = useCallback((endpoint: WebhookEndpoint) => {
    setExpandedId((current) =>
      current === endpoint.id ? null : endpoint.id
    );
  }, []);

  const handleDismissReveal = useCallback(() => {
    setRevealSecret(null);
  }, []);

  const handleRequestDelete = useCallback((endpoint: WebhookEndpoint) => {
    setPendingDelete(endpoint);
  }, []);

  const handleCancelDelete = useCallback(() => {
    setPendingDelete(null);
  }, []);

  const handleConfirmDelete = useCallback(() => {
    if (!pendingDelete) {
      return;
    }
    const target = pendingDelete;
    startDelete(async () => {
      const result = await deleteWebhookEndpointAction(
        organizationId,
        target.id
      );
      if (result.success) {
        setPendingDelete(null);
        router.refresh();
      }
    });
  }, [pendingDelete, organizationId, router]);

  const handleSendTest = useCallback(
    (endpoint: WebhookEndpoint) => {
      setTestingId(endpoint.id);
      startTest(async () => {
        await sendTestWebhookAction(organizationId, endpoint.id);
        setTestingId(null);
        setExpandedId(endpoint.id);
        router.refresh();
      });
    },
    [organizationId, router]
  );

  const editingEndpoint = editing ?? undefined;
  const formKey = useMemo(
    () => (editing ? `edit-${editing.id}` : "create"),
    [editing]
  );

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title="Webhooks"
        description="Register HTTPS endpoints to receive signed event notifications"
        icon={Webhook}
      >
        {canManage && (
          <Button type="button" onClick={handleShowCreate}>
            <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Add endpoint
          </Button>
        )}
      </PageHeader>

      {revealSecret && (
        <SecretRevealPanel
          secret={revealSecret}
          onDismiss={handleDismissReveal}
        />
      )}

      {canManage && (showCreate || editing) && (
        <EndpointForm
          key={formKey}
          organizationId={organizationId}
          endpoint={editingEndpoint}
          onCancel={handleCancelForm}
          onCreated={handleCreated}
          onSaved={handleSaved}
        />
      )}

      {pendingDelete && (
        <div
          role="alertdialog"
          aria-label="Delete webhook endpoint"
          className="mt-6 rounded-xl border border-error-200 bg-error-50 p-4"
        >
          <p className="text-sm text-error-800">
            Delete{" "}
            <span className="font-semibold break-all">{pendingDelete.url}</span>?
            Events will no longer be delivered to this endpoint. This cannot be
            undone.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmDelete}
              loading={isDeleting}
            >
              Delete endpoint
            </Button>
            <Button type="button" variant="outline" onClick={handleCancelDelete}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div className="mt-6">
        {endpoints.length === 0 ? (
          <EmptyState
            icon={Webhook}
            title="No webhook endpoints yet"
            description={
              canManage
                ? "Add an endpoint to start receiving signed event notifications in real time."
                : "No webhook endpoints have been configured for this organization yet."
            }
            action={
              canManage
                ? {
                    label: "Add your first endpoint",
                    icon: Plus,
                    onClick: handleShowCreate,
                  }
                : undefined
            }
          />
        ) : (
          <div className="flex flex-col gap-4">
            {endpoints.map((endpoint) => (
              <EndpointCard
                key={endpoint.id}
                endpoint={endpoint}
                deliveries={
                  deliveriesByEndpoint[endpoint.id] ?? EMPTY_DELIVERIES
                }
                canManage={canManage}
                isExpanded={expandedId === endpoint.id}
                onToggleExpand={handleToggleExpand}
                onEdit={handleEdit}
                onDelete={handleRequestDelete}
                onSendTest={handleSendTest}
                isTesting={isTesting && testingId === endpoint.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
