"use client";

import { useState, useTransition } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { FolderTree, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  createCategorySchema,
  updateCategorySchema,
} from "@/features/category/schemas/category.schemas";
import {
  createCategoryAction,
  updateCategoryAction,
} from "@/features/category/actions/category.actions";
import type {
  Category,
  CategoryStatus,
} from "@/features/category/types/category.types";
import { cn } from "@/utils/cn";

// ─────────────────────────────────────────────────────────────
// Form value shape
// ─────────────────────────────────────────────────────────────

interface CategoryFormValues {
  name: string;
  parentId: string;
  description: string;
  status?: CategoryStatus;
}

const CATEGORY_STATUSES: { value: CategoryStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
];

// ─────────────────────────────────────────────────────────────
// Field helpers (mirror customer-form / create-organization-form)
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
        className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
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

const inputClass = (hasError: boolean) =>
  cn(
    "block w-full rounded-lg border px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-muted-foreground shadow-sm transition-[border-color,box-shadow] duration-150 ease-out",
    "focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary",
    hasError
      ? "border-destructive bg-destructive/5"
      : "border-input bg-background hover:border-slate-400 dark:hover:border-slate-600"
  );

// ─────────────────────────────────────────────────────────────
// Category form (create + edit)
// ─────────────────────────────────────────────────────────────

interface CategoryFormProps {
  readonly organizationId: string;
  readonly category?: Category;
  readonly allCategories: readonly Category[];
  readonly onSuccess?: () => void;
  readonly onCancel?: () => void;
}

export function CategoryForm({
  organizationId,
  category,
  allCategories,
  onSuccess,
  onCancel,
}: CategoryFormProps) {
  const isEdit = Boolean(category);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Exclude the category being edited from its own parent options.
  const parentOptions = allCategories.filter((c) => c.id !== category?.id);

  const resolver = (
    isEdit
      ? zodResolver(updateCategorySchema)
      : zodResolver(createCategorySchema)
  ) as unknown as Resolver<CategoryFormValues>;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CategoryFormValues>({
    resolver,
    defaultValues: {
      name: category?.name ?? "",
      parentId: category?.parentId ?? "",
      description: category?.description ?? "",
      status: category?.status ?? "active",
    },
  });

  const onSubmit = handleSubmit((values) => {
    setServerError(null);

    const fd = new FormData();
    fd.append("name", values.name);
    if (values.parentId && values.parentId.trim() !== "") {
      fd.append("parentId", values.parentId);
    } else if (isEdit) {
      // Send an empty value so an existing parent can be cleared on edit.
      fd.append("parentId", "");
    }
    if (values.description && values.description.trim() !== "") {
      fd.append("description", values.description.trim());
    }
    if (isEdit && values.status) {
      fd.append("status", values.status);
    }

    startTransition(async () => {
      const result =
        isEdit && category
          ? await updateCategoryAction(organizationId, category.id, fd)
          : await createCategoryAction(organizationId, fd);

      if (result && !result.success) {
        setServerError(result.error.message);
        return;
      }

      onSuccess?.();
    });
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-lg shadow-slate-200/50 dark:shadow-none sm:p-6"
    >
      {/* Header */}
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-brand shadow-glow-primary">
          <FolderTree className="h-5 w-5 text-white" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            {isEdit ? "Edit category" : "Add category"}
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {isEdit
              ? "Update the details for this category"
              : "Create a new category to organize your products"}
          </p>
        </div>
      </div>

      {serverError && (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="border-error-200 dark:border-error-500/30 bg-error-50 dark:bg-error-500/10 text-error-800 dark:text-error-300 mb-5 flex items-start gap-3 rounded-lg border px-4 py-3 text-sm"
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
        <FormField
          label="Category name"
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
            placeholder="Electronics"
            {...register("name")}
          />
        </FormField>

        <FormField
          label="Parent category"
          htmlFor="parentId"
          error={errors.parentId?.message}
          hint="Leave as none for a top-level category"
        >
          <select
            id="parentId"
            className={inputClass(!!errors.parentId)}
            {...register("parentId")}
          >
            <option value="">— None —</option>
            {parentOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
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
            placeholder="Optional description for this category"
            {...register("description")}
          />
        </FormField>

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
              {CATEGORY_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </FormField>
        )}

        {/* Actions */}
        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
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
            {isEdit ? "Save changes" : "Create category"}
          </Button>
        </div>
      </form>
    </motion.div>
  );
}
