"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

const selectClass =
  "h-9 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm transition-[border-color,box-shadow] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40";

const labelClass = "mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300";

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
      className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
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
            className={selectClass}
          >
            <option value="product">Product</option>
            <option value="supplier">Supplier</option>
          </select>
        </div>
        <div>
          <label htmlFor="category" className={labelClass}>
            Category
          </label>
          <Input
            id="category"
            name="category"
            type="text"
            defaultValue={listing?.category ?? ""}
            placeholder="e.g. Electronics"
          />
        </div>
      </div>

      <div>
        <label htmlFor="title" className={labelClass}>
          Title
        </label>
        <Input
          id="title"
          name="title"
          type="text"
          required
          defaultValue={listing?.title ?? ""}
          placeholder="Listing title"
        />
      </div>

      <div>
        <label htmlFor="description" className={labelClass}>
          Description
        </label>
        <Textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={listing?.description ?? ""}
          placeholder="Describe what you offer"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="price" className={labelClass}>
            Price <span className="text-slate-400 dark:text-slate-500">(blank = on request)</span>
          </label>
          <Input
            id="price"
            name="price"
            type="number"
            min="0"
            step="0.01"
            defaultValue={listing?.price ?? ""}
            placeholder="Quote on request"
            className="nums"
          />
        </div>
        <div>
          <label htmlFor="currency" className={labelClass}>
            Currency
          </label>
          <Input
            id="currency"
            name="currency"
            type="text"
            maxLength={3}
            defaultValue={listing?.currency ?? "INR"}
          />
        </div>
        <div>
          <label htmlFor="unit" className={labelClass}>
            Unit
          </label>
          <Input
            id="unit"
            name="unit"
            type="text"
            defaultValue={listing?.unit ?? ""}
            placeholder="e.g. piece, kg"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="minOrderQty" className={labelClass}>
            Minimum order quantity
          </label>
          <Input
            id="minOrderQty"
            name="minOrderQty"
            type="number"
            min="1"
            step="1"
            defaultValue={listing?.minOrderQty ?? ""}
            placeholder="Optional"
            className="nums"
          />
        </div>
        <div>
          <label htmlFor="productId" className={labelClass}>
            Linked product ID
          </label>
          <Input
            id="productId"
            name="productId"
            type="text"
            defaultValue={listing?.productId ?? ""}
            placeholder="Optional product UUID"
          />
        </div>
      </div>

      {listing && (
        <input type="hidden" name="version" value={listing.version} />
      )}

      {error && (
        <p
          role="alert"
          className="text-error-700 bg-error-50 border-error-200 dark:text-error-300 dark:bg-error-500/10 dark:border-error-500/30 rounded-lg border px-3 py-2.5 text-sm"
        >
          {error}
        </p>
      )}

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="gradient" loading={isPending}>
          {isEdit ? "Save changes" : "Create listing"}
        </Button>
      </div>
    </form>
  );
}
