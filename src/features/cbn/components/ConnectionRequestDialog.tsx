"use client";

import { useState, useTransition } from "react";
import { sendConnectionRequest } from "@/features/cbn/actions/connection.actions";
import { Button } from "@/components/ui/button";
import type { CbnActionResult } from "@/features/cbn/types/cbn.types";

// Simple dialog built with a native dialog element pattern to avoid extra deps.
// Matches shadcn/ui visual style.

interface ConnectionRequestDialogProps {
  readonly recipientOrgId: string;
  readonly recipientName: string;
  readonly requesterOrgId: string;
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onSuccess?: (connectionId: string) => void;
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
}: ConnectionRequestDialogProps) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!open) {return null;}

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    setError(null);

    const formData = new FormData();
    formData.set("requesterOrgId", requesterOrgId);
    formData.set("recipientOrgId", recipientOrgId);
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
          <label
            htmlFor="conn-message"
            className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            Message{" "}
            <span className="font-normal text-slate-400 dark:text-slate-500">(optional)</span>
          </label>
          <textarea
            id="conn-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder={`Hi ${recipientName}, I'd like to connect on Syncrate CBN…`}
            className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
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
              disabled={isPending}
              className="bg-teal-600 hover:bg-teal-700 focus-visible:ring-teal-500"
            >
              {isPending ? "Sending…" : "Send Request"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
