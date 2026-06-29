"use client";

import { useCallback, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createShipmentAction } from "@/features/marketplace-logistics/actions/shipment.actions";

interface ShipmentFormProps {
  readonly organizationId: string;
  /** Optional pre-filled order id (e.g. arriving from an order page). */
  readonly defaultOrderId?: string;
  readonly onSaved: () => void;
  readonly onCancel: () => void;
}

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
        <Input
          id="orderId"
          name="orderId"
          type="text"
          required
          defaultValue={defaultOrderId ?? ""}
          placeholder="Paste the marketplace order ID you are shipping"
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
          <Input
            id="carrier"
            name="carrier"
            type="text"
            placeholder="e.g. Blue Dart, DHL"
          />
        </div>
        <div>
          <label htmlFor="trackingNumber" className={labelClass}>
            Tracking number
          </label>
          <Input
            id="trackingNumber"
            name="trackingNumber"
            type="text"
            placeholder="Carrier-issued tracking number"
          />
        </div>
      </div>

      <div>
        <label htmlFor="notes" className={labelClass}>
          Notes
        </label>
        <Textarea
          id="notes"
          name="notes"
          rows={3}
          placeholder="Optional dispatch notes"
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
        <Button type="submit" variant="gradient" loading={isPending}>
          Create shipment
        </Button>
      </div>
    </form>
  );
}
