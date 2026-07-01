import type { BadgeProps } from "@/components/ui/badge";
import type { CustomerStatus } from "@/features/customer/types/customer.types";

/** Badge variant used to render each customer status consistently. */
export const STATUS_VARIANT: Record<CustomerStatus, BadgeProps["variant"]> = {
  active: "success",
  inactive: "muted",
  blacklisted: "destructive",
  archived: "secondary",
};

/** Human-readable label for each customer status. */
export const STATUS_LABEL: Record<CustomerStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  blacklisted: "Blacklisted",
  archived: "Archived",
};
