import * as React from "react";
import { Drawer as DrawerPrimitive } from "vaul";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { cn } from "../../lib/utils";

/* ── Button ─────────────────────────────────────────────────────────── */

type ButtonVariant = "default" | "primary" | "outline" | "ghost" | "secondary";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: "sm" | "default" | "lg";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-[var(--radius-btn)] text-[12.5px] font-semibold transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--workspace-accent)] focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-45",
        {
          default: "bg-[var(--btn-bg)] text-[var(--btn-fg)] hover:bg-[var(--btn-hover-bg)] border border-[var(--btn-border)] shadow-sm active:translate-y-[0.5px]",
          primary: "bg-[var(--btn-bg)] text-[var(--btn-fg)] hover:bg-[var(--btn-hover-bg)] border border-[var(--btn-border)] shadow-sm active:translate-y-[0.5px]",
          outline: "border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-text)] hover:border-[var(--workspace-accent)] hover:bg-[var(--hover-surface)]",
          ghost: "border border-transparent text-[var(--color-text)] hover:border-[var(--color-border)] hover:bg-[var(--hover-surface)]",
          secondary: "border border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text)] hover:border-[var(--color-border-strong)] hover:bg-[var(--hover-surface)]",
        }[variant],
        size === "sm" ? "h-8 px-3 text-[12px]" : size === "lg" ? "h-11 px-5 text-[13.5px]" : "h-9 px-3.5",
        className
      )}
      {...props}
    />
  )
);
Button.displayName = "Button";

/* ── Input / Textarea / Select (token-driven) ──────────────────────── */

const fieldCls =
  "flex w-full rounded-[var(--radius-btn)] border border-[var(--color-border)] bg-[var(--input-bg)] px-3 py-2 text-[12.5px] text-[var(--color-text)] placeholder:text-[var(--placeholder-fg)] focus-visible:border-[var(--color-border-strong)] focus-visible:outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-50";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => <input ref={ref} className={cn(fieldCls, "h-10", className)} {...props} />
);
Input.displayName = "Input";

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(fieldCls, props.className)} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(fieldCls, "py-1.5", props.className)} />;
}

/* ── Card (supports both APIs: legacy title/right and plain div) ────── */

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  subtitle?: string;
  right?: React.ReactNode;
}

export function Card({ title, subtitle, right, children, className, ...rest }: CardProps) {
  return (
    <div className={cn("card p-4", className)} {...rest}>
      {title && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-[14px] font-semibold">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{subtitle}</p>}
          </div>
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-6", className)} {...props} />;
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">{children}</div>;
}

/* ── EmptyState with icons ──────────────────────────────────────────── */

import { FileText, Search, Users, Settings, FolderOpen, Plus, Database, Calculator, Download, Filter, BarChart3, PieChart, AlertTriangle, CheckCircle, XCircle, Clock, Cpu, Globe, BookOpen, Microscope, Heart, Activity, Zap, Target, Layers, GitBranch, Clipboard, FileSpreadsheet, Upload, DownloadCloud, RefreshCw, Eye, Trash, Edit, ChevronRight } from "lucide-react";

type IconName = "search" | "users" | "settings" | "folder" | "plus" | "database" | "calculator" | "download" | "filter" | "chart" | "pie" | "warning" | "check" | "x" | "clock" | "cpu" | "globe" | "book" | "microscope" | "heart" | "activity" | "zap" | "target" | "layers" | "git" | "clipboard" | "spreadsheet" | "upload" | "cloud" | "refresh" | "eye" | "trash" | "edit" | "chevron";

const iconMap: Record<IconName, typeof FileText> = {
  search: Search, users: Users, settings: Settings, folder: FolderOpen, plus: Plus,
  database: Database, calculator: Calculator, download: Download, filter: Filter,
  chart: BarChart3, pie: PieChart, warning: AlertTriangle, check: CheckCircle, x: XCircle,
  clock: Clock, cpu: Cpu, globe: Globe, book: BookOpen, microscope: Microscope,
  heart: Heart, activity: Activity, zap: Zap, target: Target, layers: Layers,
  git: GitBranch, clipboard: Clipboard, spreadsheet: FileSpreadsheet, upload: Upload,
  cloud: DownloadCloud, refresh: RefreshCw, eye: Eye, trash: Trash, edit: Edit, chevron: ChevronRight,
};

export function EmptyState({ children, icon, title }: { children: React.ReactNode; icon?: IconName; title?: string }) {
  const Icon = icon ? iconMap[icon] : FileText;
  return (
    <div className="rounded-[5px] border border-dashed border-[var(--color-border)] px-4 py-8 text-center">
      <div className="flex justify-center mb-3">
        <Icon className="h-8 w-8 text-[var(--color-text-muted)] opacity-50" />
      </div>
      {title && <div className="text-[12.5px] font-medium text-[var(--color-text-muted)] mb-1">{title}</div>}
      <div className="text-[12px] text-[var(--color-text-muted)]/70">{children}</div>
    </div>
  );
}

/* ── Pill ───────────────────────────────────────────────────────────── */

export function Pill({ tone = "neutral", children }: { tone?: "include" | "exclude" | "unsure" | "neutral" | "accent" | "success" | "warning" | "info"; children: React.ReactNode }) {
  const map: Record<string, string> = {
    include: "bg-emerald-500/12 text-[var(--color-include)] border-[var(--color-include)]/35",
    exclude: "bg-red-500/12 text-[var(--color-exclude)] border-[var(--color-exclude)]/35",
    unsure: "bg-amber-500/15 text-[var(--color-unsure)] border-[var(--color-unsure)]/35",
    neutral: "bg-[var(--color-surface-2)] text-[var(--color-text-muted)] border-[var(--color-border-strong)]",
    accent: "bg-[var(--workspace-selection)] text-[var(--workspace-accent)] border-[var(--workspace-accent)]/35",
    success: "bg-emerald-500/12 text-emerald-800 dark:text-emerald-300 border-emerald-600/30 dark:border-emerald-400/35",
    warning: "bg-amber-500/15 text-amber-900 dark:text-amber-300 border-amber-600/30 dark:border-amber-400/35",
    info: "bg-sky-500/12 text-sky-800 dark:text-sky-300 border-sky-600/30 dark:border-sky-400/35",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${map[tone]}`}>
      {children}
    </span>
  );
}

/* ── Drawer (vaul) ──────────────────────────────────────────────────── */

const Drawer = DrawerPrimitive.Root;
const DrawerTrigger = DrawerPrimitive.Trigger;
const DrawerClose = DrawerPrimitive.Close;

const DrawerContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DrawerPrimitive.Portal>
    <DrawerPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px]" />
    <DrawerPrimitive.Content
      ref={ref}
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 mx-auto max-w-[520px] outline-none",
        "rounded-t-2xl border border-[var(--card-border)] bg-[var(--drawer-bg)] p-6 shadow-2xl",
        className
      )}
      {...props}
    >
      <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--color-border-strong)]" />
      {children}
    </DrawerPrimitive.Content>
  </DrawerPrimitive.Portal>
));
DrawerContent.displayName = "DrawerContent";

const DrawerHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("grid gap-1.5 text-left", className)} {...props} />
);
const DrawerFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("mt-auto flex flex-col gap-3 pt-2", className)} {...props} />
);
const DrawerTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h2 ref={ref} className={cn("font-semibold text-base text-[var(--color-text)] tracking-tight", className)} {...props} />
  )
);
DrawerTitle.displayName = "DrawerTitle";
const DrawerDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-[12.5px] text-[var(--color-text-muted)] leading-relaxed tracking-tight", className)} {...props} />
  )
);
DrawerDescription.displayName = "DrawerDescription";

export { Drawer, DrawerTrigger, DrawerClose, DrawerContent, DrawerHeader, DrawerFooter, DrawerTitle, DrawerDescription };

/* ── DropdownMenu (radix) ───────────────────────────────────────────── */

const DropdownMenu = DropdownMenuPrimitive.Root;
const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;

const DropdownMenuContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 min-w-[16rem] overflow-hidden rounded-xl border border-[var(--card-border)] bg-[var(--drawer-bg)] p-2 shadow-xl",
        className
      )}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
));
DropdownMenuContent.displayName = "DropdownMenuContent";

const DropdownMenuItem = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex cursor-pointer select-none items-center rounded-lg outline-none transition-colors",
      "focus:bg-[var(--hover-surface)] data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    {...props}
  />
));
DropdownMenuItem.displayName = "DropdownMenuItem";

const DropdownMenuSeparator = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator ref={ref} className={cn("-mx-2 my-2 h-px bg-[var(--color-border)]", className)} {...props} />
));
DropdownMenuSeparator.displayName = "DropdownMenuSeparator";

export { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator };

/* ── Shared Data Display Primitives (Phase 1) ─────────────────────── */

export { StatCard } from "./StatCard";
export type { StatCardProps } from "./StatCard";

export { DataTable } from "./DataTable";
export type { DataTableProps, ColumnDef } from "./DataTable";

export { FilterBar } from "./FilterBar";
export type { FilterBarProps, FilterOption } from "./FilterBar";

export { ResultCard } from "./ResultCard";
export type { ResultCardProps } from "./ResultCard";

export { PlotContainer } from "./PlotContainer";
export type { PlotContainerProps } from "./PlotContainer";
