import * as React from "react";
import { cn } from "../../lib/utils";

export interface ColumnDef<T> {
  /** Column header label */
  header: string;
  /** Render cell for this column — receives the row datum */
  cell: (row: T, idx: number) => React.ReactNode;
  /** Optional className for th and td */
  className?: string;
  /** Sort key accessor (string) or comparator. Omit to disable sort for this column. */
  sort?: ((a: T, b: T) => number) | keyof T;
}

export interface DataTableProps<T> {
  rows: T[];
  columns: ColumnDef<T>[];
  /** Key extractor for React keys */
  rowKey: (row: T, idx: number) => string | number;
  /** Empty state message when rows is empty */
  emptyMessage?: string;
  /** Max height before scrolling (Tailwind class or px) */
  maxHeight?: string;
  /** Caption for accessibility */
  caption?: string;
}

type SortDir = "asc" | "desc" | null;

function defaultCompare(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b));
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  emptyMessage = "No data",
  maxHeight = "none",
  caption,
}: DataTableProps<T>) {
  const [sortCol, setSortCol] = React.useState<number | null>(null);
  const [sortDir, setSortDir] = React.useState<SortDir>(null);

  const handleSort = (colIdx: number) => {
    if (!columns[colIdx]?.sort) return;
    if (sortCol === colIdx) {
      setSortDir(sortDir === "asc" ? "desc" : sortDir === "desc" ? null : "asc");
    } else {
      setSortCol(colIdx);
      setSortDir("asc");
    }
  };

  const sorted = React.useMemo(() => {
    if (sortCol == null || sortDir == null) return rows;
    const col = columns[sortCol];
    if (!col?.sort) return rows;
    const sortedRows = [...rows];
    if (typeof col.sort === "function") {
      sortedRows.sort(col.sort);
    } else {
      const key = col.sort;
      sortedRows.sort((a, b) => defaultCompare(a[key], b[key]));
    }
    return sortDir === "desc" ? sortedRows.reverse() : sortedRows;
  }, [rows, sortCol, sortDir, columns]);

  return (
    <div
      className={cn(
        "overflow-x-auto rounded-[3px] border border-[var(--color-border)]",
        maxHeight !== "none" && "overflow-y-auto"
      )}
      style={maxHeight !== "none" ? { maxHeight } : undefined}
    >
      <table className="w-full text-left text-[12px]">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead className="text-[10.5px] uppercase tracking-wide text-[var(--color-text-muted)]">
          <tr className="border-b border-[var(--color-border)] bg-white/[0.02]">
            {columns.map((col, i) => {
              const active = sortCol === i;
              return (
                <th
                  key={i}
                  className={cn(
                    "px-2 py-1 font-medium",
                    col.sort && "cursor-pointer select-none hover:text-[var(--color-text)]",
                    col.className
                  )}
                  onClick={() => handleSort(i)}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {active && (
                      <span className="text-[var(--color-accent)]">
                        {sortDir === "asc" ? "▲" : "▼"}
                      </span>
                    )}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-2 py-4 text-center text-[var(--color-text-muted)]">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            sorted.map((row, rowIdx) => (
              <tr
                key={rowKey(row, rowIdx)}
                className="border-t border-[var(--color-border)] last:border-0 hover:bg-white/[0.02]"
              >
                {columns.map((col, colIdx) => (
                  <td
                    key={colIdx}
                    className={cn("px-2 py-1", col.className)}
                  >
                    {col.cell(row, rowIdx)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
