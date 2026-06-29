import { cn } from "@/utils/cn";
import { getTrustScoreLabel } from "@/features/cbn/utils/trust-score";

interface TrustScoreBadgeProps {
  readonly score: number;
  readonly size?: "sm" | "md" | "lg";
  readonly className?: string;
}

const RING_SIZE = {
  sm: { outer: 40, stroke: 4, font: "text-[10px]" },
  md: { outer: 56, stroke: 5, font: "text-xs" },
  lg: { outer: 72, stroke: 6, font: "text-sm" },
};

function getScoreColor(score: number): string {
  if (score >= 90) {return "#16A34A";} // green
  if (score >= 75) {return "#2563EB";} // blue
  if (score >= 60) {return "#F59E0B";} // yellow
  if (score >= 40) {return "#EA580C";} // orange
  return "#DC2626"; // red
}

/**
 * Circular progress ring displaying a trust score (0–100).
 * Shows the numeric score inside and the label below.
 */
export function TrustScoreBadge({
  score,
  size = "md",
  className,
}: TrustScoreBadgeProps) {
  const { outer, stroke, font } = RING_SIZE[size];
  const radius = (outer - stroke * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, score));
  const offset = circumference - (clamped / 100) * circumference;
  const color = getScoreColor(clamped);
  const label = getTrustScoreLabel(clamped);

  return (
    <div
      className={cn("flex flex-col items-center gap-0.5", className)}
      aria-label={`Trust score: ${clamped} — ${label}`}
    >
      <svg
        width={outer}
        height={outer}
        viewBox={`0 0 ${outer} ${outer}`}
        fill="none"
        aria-hidden="true"
      >
        {/* Background ring */}
        <circle
          cx={outer / 2}
          cy={outer / 2}
          r={radius}
          stroke="#E2E8F0"
          strokeWidth={stroke}
        />
        {/* Progress ring */}
        <circle
          cx={outer / 2}
          cy={outer / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${outer / 2} ${outer / 2})`}
          style={{ transition: "stroke-dashoffset 0.4s ease" }}
        />
        {/* Score text */}
        <text
          x={outer / 2}
          y={outer / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={size === "sm" ? 10 : size === "md" ? 13 : 16}
          fontWeight="700"
          fill={color}
        >
          {clamped}
        </text>
      </svg>
      <span
        className={cn("font-medium leading-none", font)}
        style={{ color }}
      >
        {label}
      </span>
    </div>
  );
}
