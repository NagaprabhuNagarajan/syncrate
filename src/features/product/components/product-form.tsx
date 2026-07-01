"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import {
  Package,
  AlertCircle,
  Boxes,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
  taxInclusive: boolean;
  purchasePrice: string;
  sellingPrice: string;
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
] as const;

const NUMBER_FIELDS = [
  "purchasePrice",
  "sellingPrice",
  "retailPrice",
  "minSellingPrice",
  "reorderLevel",
  "maxStock",
  "openingStock",
] as const;

const PRODUCT_TYPES: {
  value: ProductType;
  label: string;
  description: string;
  icon: LucideIcon;
}[] = [
  {
    value: "inventory",
    label: "Inventory",
    description: "Physical item you stock and track",
    icon: Boxes,
  },
  {
    value: "service",
    label: "Service",
    description: "Non-stock offering, e.g. labour",
    icon: Wrench,
  },
];

const PRODUCT_STATUSES: { value: ProductStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "discontinued", label: "Discontinued" },
  { value: "archived", label: "Archived" },
];

/** Dot color per status, mirroring the badge palette used elsewhere. */
const STATUS_DOT: Record<ProductStatus, string> = {
  draft: "bg-slate-400 dark:bg-slate-500",
  active: "bg-success",
  discontinued: "bg-warning",
  archived: "bg-slate-500 dark:bg-slate-600",
};

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
      {hint && !error && (
        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
          {hint}
        </p>
      )}
      <FieldError message={error} />
    </div>
  );
}

function Section({
  title,
  description,
  children,
  delay,
}: {
  readonly title: string;
  readonly description?: string;
  readonly children: React.ReactNode;
  readonly delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay }}
    >
      <Card className="p-5">
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {title}
          </h2>
          {description && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {children}
      </Card>
    </motion.div>
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
  brands = [],
  units = [],
  suppliers = [],
  onSuccess,
  onCancel,
}: ProductFormProps) {
  const router = useRouter();
  const isEdit = Boolean(product);
  const [serverError, setServerError] = useState<string | null>(null);
  const [tags, setTags] = useState<string>(product?.tags.join(", ") ?? "");
  const [gstRates, setGstRates] = useState<number[]>(
    product?.gstRates && product.gstRates.length > 0
      ? [...product.gstRates]
      : product
        ? [product.gstRate]
        : []
  );
  const [isPending, startTransition] = useTransition();

  const toggleGstRate = (rate: number): void => {
    setGstRates((prev) =>
      prev.includes(rate)
        ? prev.filter((r) => r !== rate)
        : [...prev, rate].sort((a, b) => a - b)
    );
  };

  const resolver = (isEdit
    ? zodResolver(updateProductSchema)
    : zodResolver(
        createProductSchema
      )) as unknown as Resolver<ProductFormValues>;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
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
      taxInclusive: product?.taxInclusive ?? false,
      purchasePrice: product ? String(product.purchasePrice) : "",
      sellingPrice: product ? String(product.sellingPrice) : "",
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

  const currentStatus = watch("status");
  const currentType = watch("type");

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

    // GST rates are multi-select; each selected slab is appended separately.
    gstRates.forEach((rate) => fd.append("gstRates", String(rate)));

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
    <div>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="mb-5 flex items-start gap-3"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-brand shadow-glow-primary">
          <Package className="h-5 w-5 text-white" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            {isEdit ? "Edit product" : "Add product"}
          </h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            {isEdit
              ? "Update the details for this product"
              : "Create a new product in your catalog"}
          </p>
        </div>
      </motion.div>

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

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {/* Basic */}
        <Section
          title="Basic information"
          description="The product's name, code and type."
          delay={0.05}
        >
          <div className="space-y-3">
            <FormField
              label="Type"
              htmlFor="type"
              required
              error={errors.type?.message}
            >
              <div
                id="type"
                role="radiogroup"
                aria-label="Type"
                className="grid grid-cols-1 gap-2 sm:grid-cols-2"
              >
                {PRODUCT_TYPES.map((t) => {
                  const selected = currentType === t.value;
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() =>
                        setValue("type", t.value, { shouldDirty: true })
                      }
                      className={cn(
                        "flex items-start gap-3 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                        selected
                          ? "border-primary bg-primary/5 ring-1 ring-primary/40"
                          : "border-input bg-background hover:border-slate-400 dark:hover:border-slate-600"
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors",
                          selected
                            ? "bg-gradient-brand text-white shadow-glow-primary"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">
                          {t.label}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {t.description}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </FormField>
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
          </div>
        </Section>

        {/* Classification */}
        <Section
          title="Classification"
          description="Organize this product for search and reporting."
          delay={0.08}
        >
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
              label="Brand"
              htmlFor="brandId"
              error={errors.brandId?.message}
            >
              <select
                id="brandId"
                className={inputClass(!!errors.brandId)}
                {...register("brandId")}
              >
                <option value="">— None —</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
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
            <FormField
              label="Manufacturer"
              htmlFor="manufacturer"
              error={errors.manufacturer?.message}
            >
              <input
                id="manufacturer"
                type="text"
                className={inputClass(!!errors.manufacturer)}
                placeholder="Acme Corp"
                {...register("manufacturer")}
              />
            </FormField>
          </div>
        </Section>

        {/* Tax */}
        <Section
          title="Tax"
          description="HSN classification and GST treatment."
          delay={0.11}
        >
          <div className="space-y-3">
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
                label="GST rates"
                htmlFor="gstRates"
                hint="Select all applicable slabs"
              >
                <div
                  id="gstRates"
                  role="group"
                  aria-label="GST rates"
                  className="flex flex-wrap gap-1.5 pt-0.5"
                >
                  {GST_RATES.map((g) => {
                    const rate = Number(g.value);
                    const selected = gstRates.includes(rate);
                    return (
                      <button
                        key={g.value}
                        type="button"
                        role="checkbox"
                        aria-checked={selected}
                        onClick={() => toggleGstRate(rate)}
                        className={cn(
                          "rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                          selected
                            ? "border-transparent bg-gradient-brand text-white shadow-glow-primary"
                            : "border-input bg-background text-slate-600 hover:border-slate-400 dark:text-slate-300 dark:hover:border-slate-600"
                        )}
                      >
                        {g.label}
                      </button>
                    );
                  })}
                </div>
              </FormField>
            </div>
            <label className="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500 dark:border-slate-700"
                {...register("taxInclusive")}
              />
              Prices are tax-inclusive
            </label>
          </div>
        </Section>

        {/* Pricing */}
        <Section
          title="Pricing"
          description="Purchase cost and the price tiers offered to customers."
          delay={0.14}
        >
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
        </Section>

        {/* Inventory */}
        <Section
          title="Inventory"
          description="Stock tracking, identifiers and reorder thresholds."
          delay={0.17}
        >
          <div className="space-y-3">
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
                className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500 dark:border-slate-700"
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
          </div>
        </Section>

        {/* Classification / tags */}
        <Section
          title="Status & tags"
          description="Lifecycle status and freeform tags."
          delay={0.2}
        >
          <div className="space-y-3">
            {isEdit && (
              <FormField
                label="Status"
                htmlFor="status"
                error={errors.status?.message}
                hint="Set to a non-archived status to restore an archived product"
              >
                <div
                  id="status"
                  role="radiogroup"
                  aria-label="Status"
                  className="flex flex-wrap gap-2"
                >
                  {PRODUCT_STATUSES.map((s) => {
                    const selected = currentStatus === s.value;
                    return (
                      <button
                        key={s.value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() =>
                          setValue("status", s.value, { shouldDirty: true })
                        }
                        className={cn(
                          "inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                          selected
                            ? "border-primary bg-primary/5 text-slate-900 ring-1 ring-primary/40 dark:text-slate-100"
                            : "border-input bg-background text-slate-600 hover:border-slate-400 dark:text-slate-300 dark:hover:border-slate-600"
                        )}
                      >
                        <span
                          className={cn(
                            "h-2 w-2 rounded-full",
                            STATUS_DOT[s.value]
                          )}
                          aria-hidden="true"
                        />
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </FormField>
            )}
            <FormField
              label="Tags"
              htmlFor="tags"
              hint="Separate tags with commas"
            >
              <input
                id="tags"
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className={inputClass(false)}
                placeholder="featured, seasonal, bestseller"
              />
            </FormField>
          </div>
        </Section>

        {/* Sticky action bar */}
        <div className="sticky bottom-4 z-10 flex flex-col-reverse gap-3 rounded-xl border border-slate-200 bg-white/90 px-4 py-3 shadow-lg backdrop-blur dark:border-slate-800 dark:bg-slate-900/90 sm:flex-row sm:items-center sm:justify-between">
          <p className="hidden text-xs text-muted-foreground sm:block">
            {isEdit
              ? "Changes are saved when you submit."
              : "Only the name is required to create a product."}
          </p>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
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
        </div>
      </form>
    </div>
  );
}
