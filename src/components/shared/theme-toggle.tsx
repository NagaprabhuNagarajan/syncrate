"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/utils/cn";

/**
 * Theme toggle button — switches between light and dark.
 *
 * Uses `resolvedTheme` so a "system" default resolves to the concrete
 * active theme before flipping. Renders a stable placeholder until mounted
 * to avoid a hydration mismatch (the server has no notion of the user's theme).
 */
export function ThemeToggle({ className }: { readonly className?: string }) {
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = resolvedTheme === "dark";

  const baseClasses = cn(
    "relative rounded-md p-1.5 text-slate-500 transition-colors",
    "hover:bg-slate-100 hover:text-slate-700",
    "dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
    className
  );

  // Before mount, render a non-interactive placeholder with the same footprint
  // so layout doesn't shift and no incorrect icon flashes.
  if (!mounted) {
    return (
      <button
        type="button"
        className={baseClasses}
        aria-label="Toggle theme"
        disabled
      >
        <Sun className="h-5 w-5" aria-hidden="true" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={baseClasses}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Switch to light theme" : "Switch to dark theme"}
    >
      {isDark ? (
        <Sun className="h-5 w-5" aria-hidden="true" />
      ) : (
        <Moon className="h-5 w-5" aria-hidden="true" />
      )}
    </button>
  );
}

ThemeToggle.displayName = "ThemeToggle";
