import * as React from "react";
import { cn } from "../../lib/utils";

export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Metric label shown under the value */
  label: string;
  /** The primary value — string or number */
  value: React.ReactNode;
  /** Optional secondary line (e.g., CI or subtitle) */
  sub?: React.ReactNode;
  /** Visual tone — defaults to neutral text color */
  tone?: "default" | "accent" | "good" | "warn" | "bad";
  /** Show a colored dot accent */
  dot?: boolean;
}

const toneColor: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default: "text-[var(--color-text)]",
  accent: "text-[var(--color-accent)]",
  good: "text-[var(--color-include)]",
  warn: "text-[var(--color-unsure)]",
  bad: "text-[var(--color-exclude)]",
};

const dotColor: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default: "bg-[var(--color-text-muted)]",
  accent: "bg-[var(--color-accent)]",
  good: "bg-[var(--color-include)]",
  warn: "bg-[var(--color-unsure)]",
  bad: "bg-[var(--color-exclude)]",
};

export function StatCard({
  label,
  value,
  sub,
  tone = "default",
  dot = false,
  className,
  ...rest
}: StatCardProps) {
  return (
    <div className={cn("card p-2.5", className)} {...rest}>
      <div className="flex items-center gap-1.5">
        {dot && (
          <span className={cn("inline-block h-1.5 w-1.5 shrink-0 rounded-full", dotColor[tone])} />
        )}
        <div className={cn("text-[18px] font-semibold tabular-nums", toneColor[tone])}>
          {value}
        </div>
      </div>
      <div className="text-[10.5px] text-[var(--color-text-muted)]">{label}</div>
      {sub && (
        <div className="mt-0.5 text-[10px] text-[var(--color-text-muted)]/70">{sub}</div>
      )}
    </div>
  );
}
