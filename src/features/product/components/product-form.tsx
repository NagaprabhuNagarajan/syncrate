"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { Package, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  createProductSchema,
  updateProductSchema,
} from "@/features/product/schemas/product.schemas";
import {
  createProductAction,
  updateProductAction,
} from "@/features/product/actions/product.actions";
import type {
  Product,
  ProductStatus,
  ProductType,
} from "@/features/product/types/product.types";
import { cn } from "@/utils/cn";

// ─────────────────────────────────────────────────────────────
// Option / form value shapes
// ─────────────────────────────────────────────────────────────

export interface ProductOption {
  readonly id: string;
  readonly name: string;
}

interface ProductFormValues {
  code: string;
  name: string;
  description: string;
  type: ProductType;
  categoryId: string;
  brandId: string;
  unitId: string;
  manufacturer: string;
  hsnCode: string;
  gstRate: string;
  taxInclusive: boolean;
  purchasePrice: string;
  sellingPrice: string;
  dealerPrice: string;
  wholesalePrice: string;
  retailPrice: string;
  minSellingPrice: string;
  sku: string;
  barcode: string;
  trackInventory: boolean;
  reorderLevel: string;
  maxStock: string;
  openingStock: string;
  preferredSupplierId: string;
  status?: ProductStatus;
}

const OPTIONAL_TEXT_FIELDS = [
  "code",
  "description",
  "manufacturer",
  "hsnCode",
  "sku",
  "barcode",
] as const;

const SELECT_FIELDS = [
  "type",
  "categoryId",
  "brandId",
  "unitId",
  "preferredSupplierId",
  "gstRate",
] as const;

const NUMBER_FIELDS = [
  "purchasePrice",
  "sellingPrice",
  "dealerPrice",
  "wholesalePrice",
  "retailPrice",
  "minSellingPrice",
  "reorderLevel",
  "maxStock",
  "openingStock",
] as const;

const PRODUCT_TYPES: { value: ProductType; label: string }[] = [
  { value: "inventory", label: "Inventory" },
  { value: "service", label: "Service" },
];

const PRODUCT_STATUSES: { value: ProductStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "discontinued", label: "Discontinued" },
  { value: "archived", label: "Archived" },
];

const GST_RATES: { value: string; label: string }[] = [
  { value: "0", label: "0%" },
  { value: "5", label: "5%" },
  { value: "12", label: "12%" },
  { value: "18", label: "18%" },
  { value: "28", label: "28%" },
];

// ─────────────────────────────────────────────────────────────
// Field helpers (mirror customer-form)
// ─────────────────────────────────────────────────────────────

function FieldError({ message }: { readonly message?: string }) {
  if (!message) {
    return null;
  }
  return (
    <motion.p
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-error-600 dark:text-error-400 mt-1.5 flex items-center gap-1.5 text-xs"
      role="alert"
    >
      <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {message}
    </motion.p>
  );
}

function FormField({
  label,
  htmlFor,
  required,
  children,
  error,
  hint,
}: {
  readonly label: string;
  readonly htmlFor: string;
  readonly required?: boolean;
  readonly children: React.ReactNode;
  readonly error?: string;
  readonly hint?: string;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
      >
        {label}
        {required && (
          <span className="text-error-500 ml-0.5" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{hint}</p>}
      <FieldError message={error} />
    </div>
  );
}

function SectionTitle({ children }: { readonly children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="flex-1 border-t border-slate-100 dark:border-slate-800" />
      <span className="text-xs font-medium tracking-wide text-slate-400 dark:text-slate-500">
        {children}
      </span>
      <div className="flex-1 border-t border-slate-100 dark:border-slate-800" />
    </div>
  );
}

const inputClass = (hasError: boolean) =>
  cn(
    "block w-full rounded-lg border px-3 py-1.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-muted-foreground shadow-sm transition-[border-color,box-shadow] duration-150 ease-out",
    "focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary",
    hasError
      ? "border-destructive bg-destructive/5"
      : "border-input bg-background hover:border-slate-400 dark:hover:border-slate-600"
  );

// ─────────────────────────────────────────────────────────────
// Product form (create + edit)
// ─────────────────────────────────────────────────────────────

interface ProductFormProps {
  readonly organizationId: string;
  readonly product?: Product;
  readonly categories?: readonly ProductOption[];
  readonly brands?: readonly ProductOption[];
  readonly units?: readonly ProductOption[];
  readonly suppliers?: readonly ProductOption[];
  readonly onSuccess?: () => void;
  readonly onCancel?: () => void;
}

export function ProductForm({
  organizationId,
  product,
  categories = [],
  units = [],
  suppliers = [],
  onSuccess,
  onCancel,
}: ProductFormProps) {
  const router = useRouter();
  const isEdit = Boolean(product);
  const [serverError, setServerError] = useState<string | null>(null);
  const [tags, setTags] = useState<string>(product?.tags.join(", ") ?? "");
  const [isPending, startTransition] = useTransition();

  const resolver = (
    isEdit
      ? zodResolver(updateProductSchema)
      : zodResolver(createProductSchema)
  ) as unknown as Resolver<ProductFormValues>;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProductFormValues>({
    resolver,
    defaultValues: {
      code: product?.code ?? "",
      name: product?.name ?? "",
      description: product?.description ?? "",
      type: product?.type ?? "inventory",
      categoryId: product?.categoryId ?? "",
      brandId: product?.brandId ?? "",
      unitId: product?.unitId ?? "",
      manufacturer: product?.manufacturer ?? "",
      hsnCode: product?.hsnCode ?? "",
      gstRate: product ? String(product.gstRate) : "0",
      taxInclusive: product?.taxInclusive ?? false,
      purchasePrice: product ? String(product.purchasePrice) : "",
      sellingPrice: product ? String(product.sellingPrice) : "",
      dealerPrice: product ? String(product.dealerPrice) : "",
      wholesalePrice: product ? String(product.wholesalePrice) : "",
      retailPrice: product ? String(product.retailPrice) : "",
      minSellingPrice: product ? String(product.minSellingPrice) : "",
      sku: product?.sku ?? "",
      barcode: product?.barcode ?? "",
      trackInventory: product?.trackInventory ?? true,
      reorderLevel: product ? String(product.reorderLevel) : "",
      maxStock: product ? String(product.maxStock) : "",
      openingStock: product ? String(product.openingStock) : "",
      preferredSupplierId: product?.preferredSupplierId ?? "",
      status: product?.status ?? "active",
    },
  });

  const onSubmit = handleSubmit((values) => {
    setServerError(null);

    const fd = new FormData();
    fd.append("name", values.name);

    OPTIONAL_TEXT_FIELDS.forEach((key) => {
      const value = values[key];
      if (typeof value === "string" && value.trim() !== "") {
        fd.append(key, value.trim());
      }
    });

    SELECT_FIELDS.forEach((key) => {
      const value = values[key];
      if (typeof value === "string" && value !== "") {
        fd.append(key, value);
      }
    });

    NUMBER_FIELDS.forEach((key) => {
      const value = values[key];
      if (value !== undefined && String(value) !== "") {
        fd.append(key, String(value));
      }
    });

    if (values.taxInclusive) {
      fd.append("taxInclusive", "on");
    }
    if (values.trackInventory) {
      fd.append("trackInventory", "on");
    }

    // Tags are entered as a comma-separated string; the action splits them.
    fd.append("tags", tags);

    if (isEdit && values.status) {
      fd.append("status", values.status);
    }

    startTransition(async () => {
      const result =
        isEdit && product
          ? await updateProductAction(organizationId, product.id, fd)
          : await createProductAction(organizationId, fd);

      if (result && !result.success) {
        setServerError(result.error.message);
        return;
      }

      if (onSuccess) {
        onSuccess();
      } else {
        router.push("/products");
      }
    });
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-lg shadow-slate-200/50 dark:shadow-none sm:p-5"
    >
      {/* Header */}
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-brand shadow-glow-primary">
          <Package className="h-5 w-5 text-white" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            {isEdit ? "Edit product" : "Add product"}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {isEdit
              ? "Update the details for this product"
              : "Create a new product in your catalog"}
          </p>
        </div>
      </div>

      {serverError && (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="border-error-200 dark:border-error-500/30 bg-error-50 dark:bg-error-500/10 text-error-800 dark:text-error-300 mb-4 flex items-start gap-3 rounded-lg border px-4 py-3 text-sm"
          role="alert"
        >
          <AlertCircle
            className="text-error-500 mt-0.5 h-4 w-4 shrink-0"
            aria-hidden="true"
          />
          <span>{serverError}</span>
        </motion.div>
      )}

      <form onSubmit={onSubmit} noValidate className="space-y-3">
        {/* Basic */}
        <SectionTitle>Basic</SectionTitle>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField
            label="Product name"
            htmlFor="name"
            required
            error={errors.name?.message}
          >
            <input
              id="name"
              type="text"
              autoFocus
              aria-invalid={errors.name ? "true" : "false"}
              className={inputClass(!!errors.name)}
              placeholder="Premium Widget"
              {...register("name")}
            />
          </FormField>
          <FormField
            label="Product code"
            htmlFor="code"
            error={errors.code?.message}
            hint="Leave blank to auto-generate"
          >
            <input
              id="code"
              type="text"
              autoComplete="off"
              aria-invalid={errors.code ? "true" : "false"}
              className={cn(inputClass(!!errors.code), "uppercase")}
              placeholder="PROD-00001"
              {...register("code")}
            />
          </FormField>
        </div>
        <FormField label="Type" htmlFor="type" error={errors.type?.message}>
          <select
            id="type"
            className={inputClass(!!errors.type)}
            {...register("type")}
          >
            {PRODUCT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </FormField>
        <FormField
          label="Description"
          htmlFor="description"
          error={errors.description?.message}
        >
          <textarea
            id="description"
            rows={3}
            className={inputClass(!!errors.description)}
            placeholder="Describe this product"
            {...register("description")}
          />
        </FormField>

        {/* Classification */}
        <SectionTitle>Classification</SectionTitle>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField
            label="Category"
            htmlFor="categoryId"
            error={errors.categoryId?.message}
          >
            <select
              id="categoryId"
              className={inputClass(!!errors.categoryId)}
              {...register("categoryId")}
            >
              <option value="">— None —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField
            label="Unit"
            htmlFor="unitId"
            error={errors.unitId?.message}
          >
            <select
              id="unitId"
              className={inputClass(!!errors.unitId)}
              {...register("unitId")}
            >
              <option value="">— None —</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </FormField>
        </div>

        {/* Tax */}
        <SectionTitle>Tax</SectionTitle>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField
            label="HSN code"
            htmlFor="hsnCode"
            error={errors.hsnCode?.message}
            hint="4–8 digit HSN/SAC code"
          >
            <input
              id="hsnCode"
              type="text"
              inputMode="numeric"
              className={inputClass(!!errors.hsnCode)}
              placeholder="3402"
              {...register("hsnCode")}
            />
          </FormField>
          <FormField
            label="GST rate"
            htmlFor="gstRate"
            error={errors.gstRate?.message}
          >
            <select
              id="gstRate"
              className={inputClass(!!errors.gstRate)}
              {...register("gstRate")}
            >
              {GST_RATES.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
          </FormField>
        </div>
        <label className="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-300">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 dark:border-slate-700 text-primary-600 focus:ring-primary-500"
            {...register("taxInclusive")}
          />
          Prices are tax-inclusive
        </label>

        {/* Pricing */}
        <SectionTitle>Pricing</SectionTitle>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <FormField
            label="Purchase price (₹)"
            htmlFor="purchasePrice"
            error={errors.purchasePrice?.message}
          >
            <input
              id="purchasePrice"
              type="number"
              min={0}
              step="0.01"
              className={inputClass(!!errors.purchasePrice)}
              placeholder="0"
              {...register("purchasePrice")}
            />
          </FormField>
          <FormField
            label="Selling price (₹)"
            htmlFor="sellingPrice"
            error={errors.sellingPrice?.message}
          >
            <input
              id="sellingPrice"
              type="number"
              min={0}
              step="0.01"
              className={inputClass(!!errors.sellingPrice)}
              placeholder="0"
              {...register("sellingPrice")}
            />
          </FormField>
          <FormField
            label="Retail price / MRP (₹)"
            htmlFor="retailPrice"
            error={errors.retailPrice?.message}
          >
            <input
              id="retailPrice"
              type="number"
              min={0}
              step="0.01"
              className={inputClass(!!errors.retailPrice)}
              placeholder="0"
              {...register("retailPrice")}
            />
          </FormField>
          <FormField
            label="Min. selling price (₹)"
            htmlFor="minSellingPrice"
            error={errors.minSellingPrice?.message}
          >
            <input
              id="minSellingPrice"
              type="number"
              min={0}
              step="0.01"
              className={inputClass(!!errors.minSellingPrice)}
              placeholder="0"
              {...register("minSellingPrice")}
            />
          </FormField>
        </div>

        {/* Inventory */}
        <SectionTitle>Inventory</SectionTitle>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField label="SKU" htmlFor="sku" error={errors.sku?.message}>
            <input
              id="sku"
              type="text"
              autoComplete="off"
              className={inputClass(!!errors.sku)}
              placeholder="SKU-001"
              {...register("sku")}
            />
          </FormField>
          <FormField
            label="Barcode"
            htmlFor="barcode"
            error={errors.barcode?.message}
          >
            <input
              id="barcode"
              type="text"
              autoComplete="off"
              className={inputClass(!!errors.barcode)}
              placeholder="8901234567890"
              {...register("barcode")}
            />
          </FormField>
        </div>
        <label className="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-300">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 dark:border-slate-700 text-primary-600 focus:ring-primary-500"
            {...register("trackInventory")}
          />
          Track inventory for this product
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <FormField
            label="Reorder level"
            htmlFor="reorderLevel"
            error={errors.reorderLevel?.message}
          >
            <input
              id="reorderLevel"
              type="number"
              min={0}
              className={inputClass(!!errors.reorderLevel)}
              placeholder="0"
              {...register("reorderLevel")}
            />
          </FormField>
          <FormField
            label="Max stock"
            htmlFor="maxStock"
            error={errors.maxStock?.message}
          >
            <input
              id="maxStock"
              type="number"
              min={0}
              className={inputClass(!!errors.maxStock)}
              placeholder="0"
              {...register("maxStock")}
            />
          </FormField>
          <FormField
            label="Opening stock"
            htmlFor="openingStock"
            error={errors.openingStock?.message}
          >
            <input
              id="openingStock"
              type="number"
              min={0}
              className={inputClass(!!errors.openingStock)}
              placeholder="0"
              {...register("openingStock")}
            />
          </FormField>
        </div>
        <FormField
          label="Preferred supplier"
          htmlFor="preferredSupplierId"
          error={errors.preferredSupplierId?.message}
        >
          <select
            id="preferredSupplierId"
            className={inputClass(!!errors.preferredSupplierId)}
            {...register("preferredSupplierId")}
          >
            <option value="">— None —</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </FormField>

        {/* Classification extras */}
        <SectionTitle>Tags</SectionTitle>
        {isEdit && (
          <FormField
            label="Status"
            htmlFor="status"
            error={errors.status?.message}
          >
            <select
              id="status"
              className={inputClass(!!errors.status)}
              {...register("status")}
            >
              {PRODUCT_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </FormField>
        )}
        <FormField label="Tags" htmlFor="tags" hint="Separate tags with commas">
          <input
            id="tags"
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className={inputClass(false)}
            placeholder="featured, seasonal, bestseller"
          />
        </FormField>

        {/* Actions */}
        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel ?? (() => router.push("/products"))}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="gradient"
            loading={isPending}
            disabled={isPending}
          >
            {isEdit ? "Save changes" : "Create product"}
          </Button>
        </div>
      </form>
    </motion.div>
  );
}
