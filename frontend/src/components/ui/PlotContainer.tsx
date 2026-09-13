import { cn } from "../../lib/utils";
import { Download } from "lucide-react";

export interface PlotContainerProps {
  /** SVG content as an HTML string (already sanitized by the caller) */
  svgHtml: string | null;
  /** Optional title shown above the plot */
  title?: string;
  /** Fired when the user clicks Export SVG — receives the current SVG string */
  onExport?: (svg: string) => void;
  /** Descriptive caption below the plot */
  caption?: string;
  /** Height constraint for the plot area */
  maxHeight?: string;
  /** Placeholder when no SVG is available */
  emptyMessage?: string;
  className?: string;
}

/**
 * Wraps an SVG plot with a title bar, optional caption, and consistent export button.
 * Used by forest plots, funnel plots, Galbraith, Baujat, L'Abbé, etc.
 */
export function PlotContainer({
  svgHtml,
  title,
  onExport,
  caption,
  maxHeight = "500px",
  emptyMessage = "No plot generated.",
  className,
}: PlotContainerProps) {
  return (
    <div className={cn("space-y-2", className)}>
      {(title || (svgHtml && onExport)) && (
        <div className="flex items-center justify-between">
          {title && (
            <h3 className="text-[12.5px] font-semibold text-[var(--color-text)]">{title}</h3>
          )}
          {svgHtml && onExport && (
            <button
              onClick={() => onExport(svgHtml)}
              className="inline-flex items-center gap-1 rounded-md border border-[var(--color-border)] px-2 py-1 text-[11px] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
            >
              <Download className="h-3 w-3" />
              SVG
            </button>
          )}
        </div>
      )}
      {svgHtml ? (
        <div
          className="overflow-x-auto rounded-lg bg-[var(--color-surface)] p-2"
          style={{ maxHeight }}
          dangerouslySetInnerHTML={{ __html: svgHtml }}
        />
      ) : (
        <div className="flex items-center justify-center rounded-lg border border-dashed border-[var(--color-border)] py-16 text-[12px] text-[var(--color-text-muted)]">
          {emptyMessage}
        </div>
      )}
      {caption && (
        <p className="text-[11px] leading-relaxed text-[var(--color-text-muted)]">{caption}</p>
      )}
    </div>
  );
}
