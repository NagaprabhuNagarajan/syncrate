import { Badge, type BadgeProps } from "@/components/ui/badge";

/**
 * A single status's presentation: its badge color variant and human-readable
 * label — the two things every status chip needs. Replaces the old pattern of
 * two parallel `Record<Status, ...>` maps (a `_VARIANT` and a `_LABEL`).
 */
export interface StatusDescriptor {
  readonly label: string;
  readonly variant: BadgeProps["variant"];
}

/** Maps each value of a status enum to its {@link StatusDescriptor}. */
export type StatusConfig<S extends string> = Record<S, StatusDescriptor>;

interface StatusBadgeProps {
  /** Badge color variant, typically resolved from a domain STATUS_VARIANT map. */
  readonly variant: BadgeProps["variant"];
  /** Human-readable status label, typically from a domain STATUS_LABEL map. */
  readonly label: string;
  /** Show the leading status dot. Defaults to true. */
  readonly dot?: boolean;
  readonly className?: string;
}

/**
 * The standard status pill used across transaction pages: a dot Badge whose
 * color comes from the domain's status→variant map and whose text comes from
 * its status→label map. Centralizes the `<Badge dot variant>{label}</Badge>`
 * pattern so status chips stay visually consistent everywhere.
 */
export function StatusBadge({
  variant,
  label,
  dot = true,
  className,
}: StatusBadgeProps) {
  return (
    <Badge dot={dot} variant={variant} className={className}>
      {label}
    </Badge>
  );
}
