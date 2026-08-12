"use client";

import { useState, useTransition } from "react";
import { sendConnectionRequest } from "@/features/cbn/actions/connection.actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type {
  CbnActionResult,
  ConnectionPartyRole,
  LinkableParty,
} from "@/features/cbn/types/cbn.types";

/** Segmented-control style button for the relationship choice. */
function roleClass(active: boolean): string {
  return active
    ? "rounded-lg border border-primary-500 bg-primary-50 px-3 py-2 text-sm font-medium text-primary-700 dark:border-primary-500/60 dark:bg-primary-500/15 dark:text-primary-300"
    : "rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800";
}

// Simple dialog built with a native dialog element pattern to avoid extra deps.
// Matches shadcn/ui visual style.

interface ConnectionRequestDialogProps {
  readonly recipientOrgId: string;
  readonly recipientName: string;
  readonly requesterOrgId: string;
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onSuccess?: (connectionId: string) => void;
  /** Your unlinked customers — selectable when they are your customer. */
  readonly customers: readonly LinkableParty[];
  /** Your unlinked suppliers — selectable when they are your supplier. */
  readonly suppliers: readonly LinkableParty[];
}

/**
 * Modal dialog for sending a CBN connection request.
 * Calls sendConnectionRequest server action on submit.
 */
export function ConnectionRequestDialog({
  recipientOrgId,
  recipientName,
  requesterOrgId,
  open,
  onClose,
  onSuccess,
  customers,
  suppliers,
}: ConnectionRequestDialogProps) {
  const [message, setMessage] = useState("");
  const [role, setRole] = useState<ConnectionPartyRole | "">("");
  const [linkEntityId, setLinkEntityId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!open) {return null;}

  const candidates = role === "customer" ? customers : suppliers;

  const handleRoleChange = (next: ConnectionPartyRole): void => {
    setRole(next);
    // The previous pick belongs to the other book, so it can't carry over.
    setLinkEntityId("");
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    setError(null);

    if (!role) {
      setError("Choose whether they are your customer or supplier.");
      return;
    }
    if (!linkEntityId) {
      setError(`Select which of your ${role}s this business is.`);
      return;
    }

    const formData = new FormData();
    formData.set("requesterOrgId", requesterOrgId);
    formData.set("recipientOrgId", recipientOrgId);
    formData.set("counterpartyRole", role);
    formData.set("linkEntityId", linkEntityId);
    if (message.trim()) {
      formData.set("message", message.trim());
    }

    startTransition(async () => {
      const result: CbnActionResult<string> = await sendConnectionRequest(formData);
      if (!result.success) {
        setError(result.error.message);
        return;
      }
      setMessage("");
      setRole("");
      setLinkEntityId("");
      onSuccess?.(result.data);
      onClose();
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="conn-dialog-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <h2
            id="conn-dialog-title"
            className="text-base font-semibold text-slate-900 dark:text-slate-100"
          >
            Connect with {recipientName}
          </h2>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Send a connection request to start exchanging documents digitally.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4">
          {/* Relationship — drives which of your records can be linked, and
              which type the other side must pick when they accept. */}
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">
              {recipientName} is my…
            </legend>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                aria-pressed={role === "customer"}
                onClick={() => handleRoleChange("customer")}
                className={roleClass(role === "customer")}
              >
                Customer
                <span className="block text-[11px] font-normal opacity-70">
                  I sell to them
                </span>
              </button>
              <button
                type="button"
                aria-pressed={role === "supplier"}
                onClick={() => handleRoleChange("supplier")}
                className={roleClass(role === "supplier")}
              >
                Supplier
                <span className="block text-[11px] font-normal opacity-70">
                  I buy from them
                </span>
              </button>
            </div>
          </fieldset>

          {role && (
            <div className="mt-4">
              <label
                htmlFor="conn-link-entity"
                className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Which of your {role}s are they?
              </label>
              {candidates.length === 0 ? (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                  You have no unlinked {role}s. Add {recipientName} as a {role}{" "}
                  first, then send the request.
                </p>
              ) : (
                <>
                  <select
                    id="conn-link-entity"
                    value={linkEntityId}
                    onChange={(e) => setLinkEntityId(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  >
                    <option value="">Select a {role}…</option>
                    {candidates.map((party) => (
                      <option key={party.id} value={party.id}>
                        {party.name} ({party.code})
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    Their invoices and orders will be recorded against this{" "}
                    {role}.
                  </p>
                </>
              )}
            </div>
          )}

          <label
            htmlFor="conn-message"
            className="mt-4 mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            Message{" "}
            <span className="font-normal text-slate-400 dark:text-slate-500">(optional)</span>
          </label>
          <Textarea
            id="conn-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder={`Hi ${recipientName}, I'd like to connect on Syncrate CBN…`}
            className="resize-none"
          />
          <p className="mt-1 text-right text-[11px] text-slate-400 dark:text-slate-500">
            {message.length}/500
          </p>

          {error && (
            <p
              role="alert"
              className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300"
            >
              {error}
            </p>
          )}

          <div className="mt-4 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="gradient"
              disabled={isPending}
            >
              {isPending ? "Sending…" : "Send Request"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
