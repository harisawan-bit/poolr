"use client";

/**
 * Adapted from kokonutui ProfileDropdown (@kokonutui, MIT).
 * Ported off next/image + next/link + custom Gemini icon. The "bending
 * line" indicator and gradient-ring avatar are preserved.
 *
 * v0.5.4: replaced all zinc-* hardcodes with poolr CSS tokens so the
 * component respects the active theme instead of hardcoding a light-gray
 * palette that clashed with the dark theme. Removed the gradient avatar
 * ring in favor of a flat monochrome ring consistent with poolr's brand.
 *
 * In poolr this is the account drawer in the dock: profile, appearance
 * (theme), version & license live HERE — not screamed across the shell.
 */

import { FileText, LogOut, Moon, Palette, Settings, Sun, User } from "lucide-react";
import * as React from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui";
import { cn } from "../../lib/utils";
import { useTheme } from "../../lib/theme";

export interface PoolrProfile {
  name: string;
  email: string;
  avatarSvg?: React.ReactNode;
}

interface MenuItem {
  label: string;
  value?: string;
  icon: React.ReactNode;
  onSelect?: () => void;
}

const SAMPLE_PROFILE_DATA: PoolrProfile = {
  name: "Reviewer",
  email: "local workspace",
};

export default function ProfileDropdown({
  data = SAMPLE_PROFILE_DATA,
  appVersion,
  className,
}: ProfileDropdownProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const { theme, toggleTheme } = useTheme();

  const menuItems: MenuItem[] = [
    {
      label: "Profile",
      icon: <User className="h-4 w-4" />,
    },
    {
      label: "Appearance",
      value: theme === "dark" ? "Dark" : "Light",
      icon: <Palette className="h-4 w-4" />,
      onSelect: toggleTheme,
    },
    {
      label: "Settings",
      icon: <Settings className="h-4 w-4" />,
    },
    {
      label: "Terms & Policies",
      icon: <FileText className="h-4 w-4" />,
    },
  ];

  return (
    <div className={cn("relative", className)}>
      <DropdownMenu onOpenChange={setIsOpen}>
        <div className="group relative">
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                "flex items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-2 transition-all duration-200",
                "hover:border-[var(--color-border-strong)] hover:bg-[var(--hover-surface)] hover:shadow-sm",
                "focus:outline-none"
              )}
              type="button"
            >
              <div className="flex-1 text-left">
                <div className="font-medium text-sm text-[var(--color-text)] leading-tight tracking-tight">
                  {data.name}
                </div>
                <div className="text-xs text-[var(--color-text-muted)] leading-tight tracking-tight">
                  {data.email}
                </div>
              </div>
              <div className="relative">
                <div className="h-10 w-10 rounded-full border border-[var(--color-border-strong)] bg-[var(--color-surface-2)] p-0.5">
                  <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-[var(--color-surface)]">
                    {data.avatarSvg ?? (
                      <User className="h-5 w-5 text-[var(--color-text-muted)]" />
                    )}
                  </div>
                </div>
              </div>
            </button>
          </DropdownMenuTrigger>

          {/* Bending line indicator */}
          <div
            className={cn(
              "pointer-events-none absolute top-1/2 -right-3 -translate-y-1/2 transition-all duration-200",
              isOpen ? "opacity-100" : "opacity-60 group-hover:opacity-100"
            )}
          >
            <svg
              aria-hidden="true"
              className={cn(
                "transition-all duration-200",
                isOpen
                  ? "scale-110 text-[var(--color-accent)]"
                  : "text-[var(--color-text-muted)] group-hover:text-[var(--color-text)]"
              )}
              fill="none"
              height="24"
              viewBox="0 0 12 24"
              width="12"
            >
              <path d="M2 4C6 8 6 16 2 20" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
            </svg>
          </div>

          <DropdownMenuContent
            align="end"
            className="w-64 data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          >
            <div className="space-y-1">
              {menuItems.map((item) => (
                <DropdownMenuItem
                  className={cn(
                    "group cursor-pointer rounded-xl border border-transparent p-3 transition-all duration-200",
                    "hover:border-[var(--color-border)] hover:bg-[var(--hover-surface)] hover:shadow-sm"
                  )}
                  key={item.label}
                  onSelect={() => item.onSelect?.()}
                >
                  <div className="flex flex-1 items-center gap-2">
                    {item.icon}
                    <span className="whitespace-nowrap font-medium text-sm text-[var(--color-text)] leading-tight tracking-tight transition-colors group-hover:text-[var(--color-text)]">
                      {item.label}
                    </span>
                  </div>
                  <div className="ml-auto flex-shrink-0">
                    {item.value && (
                      <span className="rounded-md border border-[var(--color-accent)]/10 bg-[var(--color-accent)]/10 px-2 py-1 font-medium text-xs tracking-tight text-[var(--color-accent)]">
                        {item.value}
                      </span>
                    )}
                  </div>
                </DropdownMenuItem>
              ))}
            </div>

            <DropdownMenuSeparator className="bg-[var(--color-border)]" />

            {/* Version + license — quiet, exactly where they belong */}
            <div className="flex items-center justify-between px-3 py-1.5 text-[11px] text-[var(--color-text-muted)]">
              <span>poolr v{appVersion} · MIT License</span>
              {theme === "dark" ? (
                <Moon className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <Sun className="h-3.5 w-3.5" aria-hidden="true" />
              )}
            </div>

            <DropdownMenuItem asChild>
              <button
                className={cn(
                  "group flex w-full cursor-pointer items-center gap-3 rounded-xl border border-transparent p-3 transition-all duration-200",
                  "border-[var(--color-exclude)]/20 bg-[var(--color-exclude)]/10 hover:border-[var(--color-exclude)]/30 hover:bg-[var(--color-exclude)]/20 hover:shadow-sm"
                )}
                type="button"
              >
                <LogOut className="h-4 w-4 text-[var(--color-exclude)] group-hover:text-[var(--color-exclude)]" />
                <span className="font-medium text-[var(--color-exclude)] text-sm group-hover:text-[var(--color-exclude)]">Close Workspace</span>
              </button>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </div>
      </DropdownMenu>
    </div>
  );
}

interface ProfileDropdownProps extends React.HTMLAttributes<HTMLDivElement> {
  data?: PoolrProfile;
  appVersion: string;
}
