import * as React from "react";
import { cn } from "../../lib/utils";
import { Search } from "lucide-react";

export interface FilterOption {
  label: string;
  value: string;
}

export interface FilterBarProps {
  /** Controlled search query value */
  query: string;
  /** Fired when the search query changes */
  onQueryChange: (value: string) => void;
  /** Tab/filter options (e.g. "All", "Include", "Exclude") */
  options?: FilterOption[];
  /** Current active option value */
  activeOption?: string;
  /** Fired when the user selects a filter option */
  onOptionChange?: (value: string) => void;
  /** Placeholder text for the search input */
  placeholder?: string;
  /** Extra controls rendered to the right of the filter bar */
  children?: React.ReactNode;
  /** Optional className wrapper */
  className?: string;
}

export function FilterBar({
  query,
  onQueryChange,
  options,
  activeOption,
  onOptionChange,
  placeholder = "Search…",
  children,
  className,
}: FilterBarProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <div className="relative min-w-[200px] flex-1">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-text-muted)]" />
        <input
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={placeholder}
          className="flex w-full rounded-lg border border-[var(--color-border)] bg-[var(--input-bg)] py-1.5 pl-8 pr-3 text-[12.5px] text-[var(--color-text)] placeholder:text-[var(--placeholder-fg)] focus-visible:border-[var(--color-border-strong)] focus-visible:outline-none"
        />
      </div>
      {options && options.length > 0 && (
        <div className="flex items-center gap-0.5 rounded-md border border-[var(--color-border)] bg-[var(--input-bg)] p-0.5 text-[11px]">
          {options.map((opt) => (
            <button
              key={opt.value}
              className={cn(
                "rounded px-2 py-1 transition-colors",
                activeOption === opt.value
                  ? "bg-blue-600 dark:bg-blue-500 text-white font-medium shadow-sm"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              )}
              onClick={() => onOptionChange?.(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
      {children}
    </div>
  );
}
