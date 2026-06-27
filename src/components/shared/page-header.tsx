import type { LucideIcon } from "lucide-react";
import { cn } from "@/utils/cn";

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  children?: React.ReactNode;
  className?: string;
}

/**
 * Standard page header with title, description, and optional action slot.
 * Used at the top of every main content page.
 */
export function PageHeader({
  title,
  description,
  icon: Icon,
  children,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border bg-muted">
            <Icon
              className="h-5 w-5 text-muted-foreground"
              aria-hidden="true"
            />
          </div>
        )}
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {children && (
        <div className="flex flex-wrap items-center gap-2">{children}</div>
      )}
    </div>
  );
}
