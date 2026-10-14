"use client";

/**
 * SpotlightNavItem — adapted from Vengeance UI's Spotlight Navbar (MIT,
 * Ashutoshx7). Poolr translation: instead of a horizontal top navbar
 * (poolr uses a floating icon dock), this is a reusable nav-item button
 * that lights a radial spotlight under the cursor and lifts when active.
 * Used by the dock and the tab strips across the hub pages.
 *
 * Respects prefers-reduced-motion (no spotlight, no lift).
 */

import { useReducedMotion } from "motion/react";
import * as React from "react";
import { cn } from "../../lib/utils";

export interface SpotlightNavItemProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Active state — drives the raised, token-tinted styling. */
  active?: boolean;
  /** Optional leading icon element. */
  icon?: React.ReactNode;
}

export const SpotlightNavItem = React.forwardRef<
  HTMLButtonElement,
  SpotlightNavItemProps
>(({ active = false, icon, className, children, ...rest }, ref) => {
  const reduced = useReducedMotion();
  const btnRef = React.useRef<HTMLButtonElement | null>(null);
  const [pos, setPos] = React.useState<{ x: number; y: number } | null>(null);

  const handleMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (reduced) return;
    const el = btnRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const setRefs = React.useCallback(
    (node: HTMLButtonElement | null) => {
      btnRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) (ref as React.MutableRefObject<HTMLButtonElement | null>).current = node;
    },
    [ref]
  );

  return (
    <button
      ref={setRefs}
      type="button"
      onMouseMove={handleMove}
      onMouseLeave={() => setPos(null)}
      className={cn(
        "group relative inline-flex items-center gap-1.5 overflow-hidden rounded-lg px-3 py-1.5",
        "text-[11.5px] font-medium transition-colors duration-150 outline-none",
        "focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/40",
        active
          ? "bg-[var(--hover-surface)] text-[var(--color-text)] shadow-sm"
          : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
        className
      )}
      aria-current={active ? "page" : undefined}
      {...rest}
    >
      {/* Cursor spotlight — token-tinted radial gradient, pointer-events none. */}
      {!reduced && pos && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-60 transition-opacity"
          style={{
            left: pos.x,
            top: pos.y,
            background:
              "radial-gradient(circle, var(--color-accent) 0%, transparent 65%)",
            opacity: 0.12,
          }}
        />
      )}
      {icon && (
        <span className="relative z-10 shrink-0 [&>svg]:h-3.5 [&>svg]:w-3.5">
          {icon}
        </span>
      )}
      <span className="relative z-10 whitespace-nowrap">{children}</span>
      {/* Active underline bar */}
      {active && (
        <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[var(--color-accent)]" />
      )}
    </button>
  );
});
SpotlightNavItem.displayName = "SpotlightNavItem";

export default SpotlightNavItem;
