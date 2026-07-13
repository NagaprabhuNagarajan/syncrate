import { AlertCircle } from "lucide-react";
import { cn } from "@/utils/cn";

interface ErrorBannerProps {
  /** The error message to display. */
  readonly message: string;
  /** Extra classes (e.g. spacing) for the wrapper. */
  readonly className?: string;
}

/**
 * The canonical inline error alert — a red banner with an icon, used for
 * surfacing action/form/server errors consistently across the app. For
 * full-page error states use `<ErrorState>` instead.
 */
export function ErrorBanner({ message, className }: ErrorBannerProps) {
  return (
    <div
      role="alert"
      className={cn(
        "border-error-300 bg-error-50 text-error-800 dark:border-error-500/40 dark:bg-error-500/10 dark:text-error-300 flex items-start gap-2.5 rounded-lg border px-4 py-3 text-sm font-medium",
        className
      )}
    >
      <AlertCircle
        className="text-error-600 dark:text-error-400 mt-0.5 h-4 w-4 shrink-0"
        aria-hidden="true"
      />
      <span>{message}</span>
    </div>
  );
}

ErrorBanner.displayName = "ErrorBanner";
