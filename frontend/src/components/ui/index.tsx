import * as React from "react";
import { Drawer as DrawerPrimitive } from "vaul";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { cn } from "../../lib/utils";

/* ── Button ─────────────────────────────────────────────────────────── */

type ButtonVariant = "default" | "outline" | "ghost" | "secondary";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: "sm" | "default" | "lg";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-lg text-[12.5px] font-medium transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/40 disabled:pointer-events-none disabled:opacity-50",
        {
          default: "bg-[var(--btn-bg)] text-[var(--btn-fg)] hover:bg-[var(--btn-hover-bg)] border border-[var(--btn-border)] shadow-sm active:scale-[0.99]",
          outline: "border border-[var(--color-border)] bg-transparent text-[var(--color-text)] hover:border-[var(--color-border-strong)] hover:bg-[var(--hover-surface)]",
          ghost: "text-[var(--color-text-muted)] hover:bg-[var(--hover-surface)] hover:text-[var(--color-text)]",
          secondary: "bg-[var(--hover-surface)] text-[var(--color-text)] hover:bg-[var(--color-border)]",
        }[variant],
        size === "sm" ? "h-8 px-3" : size === "lg" ? "h-11 px-5" : "h-10 px-4",
        className
      )}
      {...props}
    />
  )
);
Button.displayName = "Button";

/* ── Input / Textarea / Select (token-driven) ──────────────────────── */

const fieldCls =
  "flex w-full rounded-lg border border-[var(--color-border)] bg-[var(--input-bg)] px-3 py-2 text-[12.5px] text-[var(--color-text)] placeholder:text-[var(--placeholder-fg)] focus-visible:border-[var(--color-border-strong)] focus-visible:outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-50";

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
  right?: React.ReactNode;
}

export function Card({ title, right, children, className, ...rest }: CardProps) {
  return (
    <div className={cn("card p-4", className)} {...rest}>
      {title && (
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[14px] font-semibold">{title}</h2>
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

export function Pill({ tone = "neutral", children }: { tone?: "include" | "exclude" | "unsure" | "neutral" | "accent"; children: React.ReactNode }) {
  const map: Record<string, string> = {
    include: "bg-[var(--color-include)]/15 text-[var(--color-include)] border-[var(--color-include)]/30",
    exclude: "bg-[var(--color-exclude)]/15 text-[var(--color-exclude)] border-[var(--color-exclude)]/30",
    unsure: "bg-[var(--color-unsure)]/15 text-[var(--color-unsure)] border-[var(--color-unsure)]/30",
    neutral: "bg-white/[0.05] text-[var(--color-text-muted)] border-[var(--color-border)]",
    accent: "bg-white/[0.08] text-[var(--color-text)] border-[var(--color-border-strong)]",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10.5px] font-medium ${map[tone]}`}>
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
