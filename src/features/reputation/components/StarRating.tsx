"use client";

import { useCallback } from "react";
import { Star } from "lucide-react";
import { cn } from "@/utils/cn";

const STAR_VALUES = [1, 2, 3, 4, 5] as const;

const SIZE_CLASS = {
  sm: "h-3.5 w-3.5",
  md: "h-5 w-5",
  lg: "h-7 w-7",
} as const;

type StarSize = keyof typeof SIZE_CLASS;

// ─────────────────────────────────────────────────────────────
// Read-only display
// ─────────────────────────────────────────────────────────────

interface StarRatingProps {
  readonly value: number;
  readonly size?: StarSize;
  readonly className?: string;
}

/** Read-only star row. Fills `round(value)` of 5 stars. */
export function StarRating({ value, size = "md", className }: StarRatingProps) {
  const filled = Math.round(Math.max(0, Math.min(5, value)));
  return (
    <div
      className={cn("flex items-center gap-0.5", className)}
      role="img"
      aria-label={`${value.toFixed(1)} out of 5 stars`}
    >
      {STAR_VALUES.map((star) => (
        <Star
          key={star}
          className={cn(
            SIZE_CLASS[size],
            star <= filled
              ? "fill-amber-400 text-amber-400"
              : "fill-slate-100 text-slate-300"
          )}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Interactive selector
// ─────────────────────────────────────────────────────────────

interface StarButtonProps {
  readonly star: number;
  readonly active: boolean;
  readonly size: StarSize;
  readonly onSelect: (value: number) => void;
}

function StarButton({ star, active, size, onSelect }: StarButtonProps) {
  const handleClick = useCallback(() => {
    onSelect(star);
  }, [onSelect, star]);

  return (
    <button
      type="button"
      onClick={handleClick}
      className="rounded-md p-0.5 transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
      aria-label={`Rate ${star} star${star === 1 ? "" : "s"}`}
      aria-pressed={active}
    >
      <Star
        className={cn(
          SIZE_CLASS[size],
          active
            ? "fill-amber-400 text-amber-400"
            : "fill-slate-100 text-slate-300 dark:fill-slate-700 dark:text-slate-600"
        )}
        aria-hidden="true"
      />
    </button>
  );
}

interface StarRatingInputProps {
  readonly value: number;
  readonly onChange: (value: number) => void;
  readonly size?: StarSize;
  readonly className?: string;
}

/** Interactive 1–5 star selector used by the write-review form. */
export function StarRatingInput({
  value,
  onChange,
  size = "lg",
  className,
}: StarRatingInputProps) {
  return (
    <div
      className={cn("flex items-center gap-1", className)}
      role="radiogroup"
      aria-label="Rating"
    >
      {STAR_VALUES.map((star) => (
        <StarButton
          key={star}
          star={star}
          active={star <= value}
          size={size}
          onSelect={onChange}
        />
      ))}
    </div>
  );
}
