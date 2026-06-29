"use client";

import { useCallback, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { createShipmentAction } from "@/features/marketplace-logistics/actions/shipment.actions";

interface ShipmentFormProps {
  readonly organizationId: string;
  /** Optional pre-filled order id (e.g. arriving from an order page). */
  readonly defaultOrderId?: string;
  readonly onSaved: () => void;
  readonly onCancel: () => void;
}

const inputClass =
  "block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition-colors hover:border-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder-slate-500 dark:hover:border-slate-600";

const labelClass = "mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300";

export function ShipmentForm({
  organizationId,
  defaultOrderId,
  onSaved,
  onCancel,
}: ShipmentFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>): void => {
      event.preventDefault();
      setError(null);
      const formData = new FormData(event.currentTarget);

      startTransition(async () => {
        const response = await createShipmentAction(organizationId, formData);
        if (!response.success) {
          setError(response.error.message);
          return;
        }
        onSaved();
      });
    },
    [organizationId, onSaved]
  );

  return (
    <form
      onSubmit={handleSubmit}
      aria-label="Create shipment"
      className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      {/* The manual provider is the honest default; no external carrier calls. */}
      <input type="hidden" name="provider" value="manual" />

      <div>
        <label htmlFor="orderId" className={labelClass}>
          Order ID
        </label>
        <input
          id="orderId"
          name="orderId"
          type="text"
          required
          defaultValue={defaultOrderId ?? ""}
          placeholder="Paste the marketplace order ID you are shipping"
          className={inputClass}
        />
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          You must be the seller on this order to create its shipment.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="carrier" className={labelClass}>
            Carrier
          </label>
          <input
            id="carrier"
            name="carrier"
            type="text"
            placeholder="e.g. Blue Dart, DHL"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="trackingNumber" className={labelClass}>
            Tracking number
          </label>
          <input
            id="trackingNumber"
            name="trackingNumber"
            type="text"
            placeholder="Carrier-issued tracking number"
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label htmlFor="notes" className={labelClass}>
          Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          placeholder="Optional dispatch notes"
          className={inputClass}
        />
      </div>

      {error && (
        <div role="alert" className="text-sm text-error">
          {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button type="submit" loading={isPending}>
          Create shipment
        </Button>
      </div>
    </form>
  );
}
