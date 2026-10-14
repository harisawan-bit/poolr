"use client";

/**
 * GlowBorderCard — adapted from Vengeance UI's Glow Border Card (MIT,
 * Ashutoshx7). Poolr translation: the rotating conic glow is driven by
 * poolr design tokens instead of hardcoded hex, so it inherits the light
 * and dark palettes and stays inside the desktop CSP (no external images,
 * no inline SVG fonts). The animation respects prefers-reduced-motion and
 * simply renders a static accent-tinted border when motion is off.
 */

import { motion, useReducedMotion } from "motion/react";
import * as React from "react";
import { cn } from "../../lib/utils";

export interface GlowBorderCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Rotation duration of the border glow, in seconds. */
  duration?: number;
  /** Stroke width of the glow ring in pixels. */
  borderWidth?: number;
  /** Disable the rotating glow and show a static token-tinted border. */
  disableGlow?: boolean;
}

/**
 * The ring is drawn as a conic-gradient masked to the card's border box.
 * poolr's accent token is a foreground-ish color per theme, so in dark mode
 * the glow reads as a light halo and in light mode as a deep blue accent.
 */
export function GlowBorderCard({
  children,
  className,
  duration = 4,
  borderWidth = 1.5,
  disableGlow = false,
  ...rest
}: GlowBorderCardProps) {
  const reduced = useReducedMotion();
  const animateGlow = !disableGlow && !reduced;

  return (
    <div
      className={cn(
        "relative isolate rounded-[var(--radius-card)] p-[var(--gbw,1.5px)]",
        "overflow-hidden",
        className
      )}
      style={
        {
          "--gbw": `${borderWidth}px`,
        } as React.CSSProperties
      }
      {...rest}
    >
      {/* Glow ring — a conic gradient that rotates around the border. */}
      <motion.span
        aria-hidden="true"
        className="pointer-events-none absolute inset-[-40%] opacity-70"
        style={{
          background:
            "conic-gradient(from 0deg, transparent 0deg, var(--color-accent) 90deg, var(--color-border-strong) 180deg, transparent 270deg)",
        }}
        animate={animateGlow ? { rotate: 360 } : undefined}
        transition={
          animateGlow
            ? { duration, repeat: Infinity, ease: "linear" }
            : undefined
        }
      />
      {/* Inner surface — covers the center so only the border glows. */}
      <div className="card relative z-10 h-full rounded-[calc(var(--radius-card)-1px)] p-4">
        {children}
      </div>
    </div>
  );
}

export default GlowBorderCard;
