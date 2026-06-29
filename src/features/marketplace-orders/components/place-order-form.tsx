"use client";

import { useCallback, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { placeOrderAction } from "@/features/marketplace-orders/actions/marketplace-orders.actions";

interface PlaceOrderFormProps {
  readonly organizationId: string;
  readonly onPlaced: () => void;
  readonly onCancel: () => void;
}

const FIELD_CLASS =
  "focus:border-primary-500 focus:ring-primary-500 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition-colors hover:border-slate-400 focus:outline-none focus:ring-2";

const LABEL_CLASS = "mb-1 block text-sm font-medium text-slate-700";

export function PlaceOrderForm({
  organizationId,
  onPlaced,
  onCancel,
}: PlaceOrderFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>): void => {
      event.preventDefault();
      setError(null);
      const formData = new FormData(event.currentTarget);
      startTransition(async () => {
        const result = await placeOrderAction(organizationId, formData);
        if (!result.success) {
          setError(result.error.message);
          return;
        }
        onPlaced();
      });
    },
    [organizationId, onPlaced]
  );

  return (
    <form
      onSubmit={handleSubmit}
      aria-label="Place order"
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <h2 className="mb-4 text-base font-semibold text-slate-900">
        Place a new order
      </h2>

      <p className="mb-4 text-sm text-slate-500">
        Paste a listing reference from the marketplace. The seller and price are
        taken from the listing itself.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="po-listing" className={LABEL_CLASS}>
            Listing ID
          </label>
          <input
            id="po-listing"
            name="listingId"
            required
            placeholder="Listing reference from the marketplace"
            className={FIELD_CLASS}
          />
        </div>

        <div>
          <label htmlFor="po-qty" className={LABEL_CLASS}>
            Quantity
          </label>
          <input
            id="po-qty"
            name="quantity"
            type="number"
            min={1}
            defaultValue={1}
            required
            className={FIELD_CLASS}
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="po-notes" className={LABEL_CLASS}>
            Notes <span className="text-slate-400">(optional)</span>
          </label>
          <textarea
            id="po-notes"
            name="notes"
            rows={2}
            className={FIELD_CLASS}
          />
        </div>
      </div>

      {error && (
        <div role="alert" className="mt-3 text-sm text-error">
          {error}
        </div>
      )}

      <div className="mt-5 flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button type="submit" loading={isPending}>
          Place order
        </Button>
      </div>
    </form>
  );
}
