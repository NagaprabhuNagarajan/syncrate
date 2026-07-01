import type { BadgeProps } from "@/components/ui/badge";
import type { SupplierStatus } from "@/features/supplier/types/supplier.types";

/** Badge variant used to render each supplier status consistently. */
export const STATUS_VARIANT: Record<SupplierStatus, BadgeProps["variant"]> = {
  active: "success",
  inactive: "muted",
  archived: "secondary",
};

/** Human-readable label for each supplier status. */
export const STATUS_LABEL: Record<SupplierStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  archived: "Archived",
};
