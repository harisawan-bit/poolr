import * as React from "react";
import { cn } from "../../lib/utils";
import { Copy, Check } from "lucide-react";

export interface ResultCardProps {
  /** Pooled effect value */
  effect: number | string;
  /** Confidence interval as a pre-formatted string (e.g. "1.2 – 3.4") */
  ci: string;
  /** p-value as a pre-formatted string */
  pValue: string;
  /** Optional: show copy-to-clipboard button */
  copyable?: boolean;
  /** Formatter for the numeric values — defaults to no formatting */
  className?: string;
  /** Extra content below the pooled result */
  children?: React.ReactNode;
  /** Whether the effect is on a ratio scale (OR/RR) for badge styling */
  isRatio?: boolean;
}

/**
 * Standardized pooled-result display: large effect value with CI + p-value pills.
 * Used across Meta, NetworkMeta, IPDMeta, MultilevelMeta, etc.
 */
export function ResultCard({
  effect,
  ci,
  pValue,
  copyable = true,
  className,
  children,
  isRatio = false,
}: ResultCardProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    const text = `Effect: ${effect}\n95% CI: ${ci}\np = ${pValue}`;
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-baseline gap-3">
        <span className="text-[22px] font-bold tabular-nums text-[var(--color-text)]">
          {effect}
        </span>
        <span className="text-[12px] text-[var(--color-text-muted)]">
          {isRatio ? "OR" : "ES"} [{ci}]
        </span>
        <span
          className={cn(
            "rounded-full border px-2 py-0.5 text-[10.5px] font-medium",
            parseFloat(pValue) < 0.05
              ? "border-[var(--color-include)]/30 bg-[var(--color-include)]/15 text-[var(--color-include)]"
              : "border-[var(--color-border)] bg-white/[0.05] text-[var(--color-text-muted)]"
          )}
        >
          p = {pValue}
        </span>
        {copyable && (
          <button
            onClick={handleCopy}
            className="ml-auto rounded-md border border-[var(--color-border)] p-1 text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
            title="Copy result"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>
      {children}
    </div>
  );
}
