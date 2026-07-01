import type { BadgeProps } from "@/components/ui/badge";
import type {
  ProductStatus,
  ProductType,
} from "@/features/product/types/product.types";

/** Badge variant used to render each product status consistently. */
export const STATUS_VARIANT: Record<ProductStatus, BadgeProps["variant"]> = {
  draft: "muted",
  active: "success",
  discontinued: "warning",
  archived: "secondary",
};

/** Human-readable label for each product status. */
export const STATUS_LABEL: Record<ProductStatus, string> = {
  draft: "Draft",
  active: "Active",
  discontinued: "Discontinued",
  archived: "Archived",
};

/** Human-readable label for each product type. */
export const TYPE_LABEL: Record<ProductType, string> = {
  inventory: "Inventory",
  service: "Service",
};
