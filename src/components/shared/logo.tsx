import Image from "next/image";
import { cn } from "@/utils/cn";

/**
 * Syncrate brand assets.
 *
 * - `BrandMark` — the standalone "S" icon (transparent, theme-safe).
 * - `BrandLockup` — icon + "Syncrate" wordmark rendered as theme-aware text
 *   (adapts to light/dark). Use in app chrome.
 * - `BrandLogo` — the full lockup PNG (mark + wordmark + tagline). Use only on
 *   light backgrounds (e.g. the auth/onboarding gradient).
 */

export function BrandMark({
  size = 28,
  className,
  priority = false,
}: {
  readonly size?: number;
  readonly className?: string;
  readonly priority?: boolean;
}) {
  return (
    <Image
      src="/brand/icon.png"
      alt="Syncrate"
      width={size}
      height={size}
      priority={priority}
      className={cn("shrink-0 object-contain", className)}
    />
  );
}

BrandMark.displayName = "BrandMark";

export function BrandLockup({
  iconSize = 28,
  className,
  textClassName,
  priority = false,
}: {
  readonly iconSize?: number;
  readonly className?: string;
  readonly textClassName?: string;
  readonly priority?: boolean;
}) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <BrandMark size={iconSize} priority={priority} />
      <span
        className={cn(
          "text-base font-semibold tracking-tight text-slate-900 dark:text-slate-100",
          textClassName
        )}
      >
        Syncrate
      </span>
    </span>
  );
}

BrandLockup.displayName = "BrandLockup";

export function BrandLogo({
  size = 160,
  className,
  priority = true,
}: {
  readonly size?: number;
  readonly className?: string;
  readonly priority?: boolean;
}) {
  return (
    <Image
      src="/brand/logo.png"
      alt="Syncrate — Sync. Connect. Grow."
      width={size}
      height={size}
      priority={priority}
      className={cn("object-contain", className)}
    />
  );
}

BrandLogo.displayName = "BrandLogo";
