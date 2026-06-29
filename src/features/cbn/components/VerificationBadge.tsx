import {
  ShieldOff,
  Mail,
  Smartphone,
  FileCheck,
  FileSearch,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/utils/cn";

interface VerificationBadgeProps {
  readonly level: number;
  readonly showLabel?: boolean;
  readonly size?: "sm" | "md";
  readonly className?: string;
}

interface VerificationConfig {
  readonly label: string;
  readonly icon: React.ComponentType<{ className?: string }>;
  readonly colorClass: string;
  readonly bgClass: string;
}

const CONFIGS: Record<number, VerificationConfig> = {
  0: {
    label: "Unverified",
    icon: ShieldOff,
    colorClass: "text-slate-500",
    bgClass: "bg-slate-100",
  },
  1: {
    label: "Email Verified",
    icon: Mail,
    colorClass: "text-blue-600",
    bgClass: "bg-blue-50",
  },
  2: {
    label: "Mobile Verified",
    icon: Smartphone,
    colorClass: "text-blue-700",
    bgClass: "bg-blue-100",
  },
  3: {
    label: "GST Verified",
    icon: FileCheck,
    colorClass: "text-green-600",
    bgClass: "bg-green-50",
  },
  4: {
    label: "Document Verified",
    icon: FileSearch,
    colorClass: "text-green-700",
    bgClass: "bg-green-100",
  },
  5: {
    label: "Syncrate Trusted",
    icon: ShieldCheck,
    colorClass: "text-amber-600",
    bgClass: "bg-amber-50",
  },
};

/**
 * Displays a verification badge for a business.
 * Level 0 = Unverified, Level 5 = Syncrate Trusted (premium gold).
 */
export function VerificationBadge({
  level,
  showLabel = true,
  size = "sm",
  className,
}: VerificationBadgeProps) {
  const clamped = Math.max(0, Math.min(5, Math.floor(level)));
  const config = CONFIGS[clamped] ?? CONFIGS[0];
  const Icon = config.icon;

  const iconSize = size === "sm" ? "h-3 w-3" : "h-4 w-4";
  const textSize = size === "sm" ? "text-[11px]" : "text-xs";
  const padding = size === "sm" ? "px-1.5 py-0.5" : "px-2 py-1";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-medium",
        config.colorClass,
        config.bgClass,
        padding,
        className
      )}
      title={config.label}
      aria-label={`Verification: ${config.label}`}
    >
      <Icon className={iconSize} aria-hidden="true" />
      {showLabel && (
        <span className={textSize}>{config.label}</span>
      )}
    </span>
  );
}
