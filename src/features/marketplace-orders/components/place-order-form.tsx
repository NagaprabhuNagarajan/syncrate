"use client";

import { useCallback, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { placeOrderAction } from "@/features/marketplace-orders/actions/marketplace-orders.actions";

interface PlaceOrderFormProps {
  readonly organizationId: string;
  readonly onPlaced: () => void;
  readonly onCancel: () => void;
}

const LABEL_CLASS = "mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300";

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
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <h2 className="mb-4 text-base font-semibold text-slate-900 dark:text-slate-100">
        Place a new order
      </h2>

      <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
        Paste a listing reference from the marketplace. The seller and price are
        taken from the listing itself.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="po-listing" className={LABEL_CLASS}>
            Listing ID
          </label>
          <Input
            id="po-listing"
            name="listingId"
            required
            placeholder="Listing reference from the marketplace"
          />
        </div>

        <div>
          <label htmlFor="po-qty" className={LABEL_CLASS}>
            Quantity
          </label>
          <Input
            id="po-qty"
            name="quantity"
            type="number"
            min={1}
            defaultValue={1}
            required
            className="nums"
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="po-notes" className={LABEL_CLASS}>
            Notes <span className="text-slate-400 dark:text-slate-500">(optional)</span>
          </label>
          <Textarea id="po-notes" name="notes" rows={2} />
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
        <Button type="submit" variant="gradient" loading={isPending}>
          Place order
        </Button>
      </div>
    </form>
  );
}
