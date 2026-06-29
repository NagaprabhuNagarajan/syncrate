"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

/**
 * Count-up animated number for KPIs and financial figures.
 *
 * Animates from 0 to `value` once on mount (and whenever `value` changes).
 * Honors `prefers-reduced-motion` by rendering the final value immediately.
 * Output is tabular-aligned via the `.nums` utility.
 */
export function AnimatedNumber({
  value,
  duration = 900,
  decimals = 0,
  prefix = "",
  suffix = "",
  locale = "en-IN",
  className,
}: {
  readonly value: number;
  readonly duration?: number;
  readonly decimals?: number;
  readonly prefix?: string;
  readonly suffix?: string;
  readonly locale?: string;
  readonly className?: string;
}) {
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(reduceMotion ? value : 0);
  const frame = useRef<number | null>(null);
  const startTs = useRef<number | null>(null);

  useEffect(() => {
    if (reduceMotion) {
      setDisplay(value);
      return;
    }
    const from = 0;
    const animate = (ts: number) => {
      if (startTs.current === null) {
        startTs.current = ts;
      }
      const elapsed = ts - startTs.current;
      const t = Math.min(1, elapsed / duration);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (value - from) * eased);
      if (t < 1) {
        frame.current = requestAnimationFrame(animate);
      }
    };
    frame.current = requestAnimationFrame(animate);
    return () => {
      if (frame.current !== null) {
        cancelAnimationFrame(frame.current);
      }
      startTs.current = null;
    };
  }, [value, duration, reduceMotion]);

  const formatted = display.toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return (
    <span className={["nums tabular-nums", className].filter(Boolean).join(" ")}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}

AnimatedNumber.displayName = "AnimatedNumber";
