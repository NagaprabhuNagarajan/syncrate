"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  createListingAction,
  updateListingAction,
} from "@/features/marketplace/actions/marketplace.actions";
import type { MarketplaceListing } from "@/features/marketplace/types/marketplace.types";

interface ListingFormProps {
  readonly organizationId: string;
  readonly listing?: MarketplaceListing;
  readonly onSaved: () => void;
  readonly onCancel: () => void;
}

const inputClass =
  "block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition-colors hover:border-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500";

const labelClass = "mb-1 block text-sm font-medium text-slate-700";

export function ListingForm({
  organizationId,
  listing,
  onSaved,
  onCancel,
}: ListingFormProps) {
  const isEdit = Boolean(listing);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const response = listing
        ? await updateListingAction(organizationId, listing.id, formData)
        : await createListingAction(organizationId, formData);

      if (!response.success) {
        setError(response.error.message);
        return;
      }
      onSaved();
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      aria-label={isEdit ? "Edit listing" : "Create listing"}
      className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="listingType" className={labelClass}>
            Listing type
          </label>
          <select
            id="listingType"
            name="listingType"
            defaultValue={listing?.listingType ?? "product"}
            className={inputClass}
          >
            <option value="product">Product</option>
            <option value="supplier">Supplier</option>
          </select>
        </div>
        <div>
          <label htmlFor="category" className={labelClass}>
            Category
          </label>
          <input
            id="category"
            name="category"
            type="text"
            defaultValue={listing?.category ?? ""}
            placeholder="e.g. Electronics"
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label htmlFor="title" className={labelClass}>
          Title
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          defaultValue={listing?.title ?? ""}
          placeholder="Listing title"
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="description" className={labelClass}>
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={listing?.description ?? ""}
          placeholder="Describe what you offer"
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="price" className={labelClass}>
            Price <span className="text-slate-400">(blank = on request)</span>
          </label>
          <input
            id="price"
            name="price"
            type="number"
            min="0"
            step="0.01"
            defaultValue={listing?.price ?? ""}
            placeholder="Quote on request"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="currency" className={labelClass}>
            Currency
          </label>
          <input
            id="currency"
            name="currency"
            type="text"
            maxLength={3}
            defaultValue={listing?.currency ?? "INR"}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="unit" className={labelClass}>
            Unit
          </label>
          <input
            id="unit"
            name="unit"
            type="text"
            defaultValue={listing?.unit ?? ""}
            placeholder="e.g. piece, kg"
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="minOrderQty" className={labelClass}>
            Minimum order quantity
          </label>
          <input
            id="minOrderQty"
            name="minOrderQty"
            type="number"
            min="1"
            step="1"
            defaultValue={listing?.minOrderQty ?? ""}
            placeholder="Optional"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="productId" className={labelClass}>
            Linked product ID
          </label>
          <input
            id="productId"
            name="productId"
            type="text"
            defaultValue={listing?.productId ?? ""}
            placeholder="Optional product UUID"
            className={inputClass}
          />
        </div>
      </div>

      {listing && (
        <input type="hidden" name="version" value={listing.version} />
      )}

      {error && (
        <p
          role="alert"
          className="text-error-700 bg-error-50 border-error-200 rounded-lg border px-3 py-2.5 text-sm"
        >
          {error}
        </p>
      )}

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={isPending}>
          {isEdit ? "Save changes" : "Create listing"}
        </Button>
      </div>
    </form>
  );
}
