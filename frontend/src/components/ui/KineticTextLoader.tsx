"use client";

/**
 * KineticTextLoader — adapted from Vengeance UI's Kinetic Text Loader (MIT,
 * Ashutoshx7). Poolr translation: the loading state replaces the bare
 * `Loader2` spinner that appears 140 times across the app. Each character
 * of the message bobs on a spring, staggered, in poolr's muted text color.
 *
 * Honours prefers-reduced-motion (renders a static message + a plain
 * indeterminate bar so the user still sees progress feedback).
 */

import { motion, useReducedMotion } from "motion/react";
import { cn } from "../../lib/utils";

export interface KineticTextLoaderProps {
  /** Message to animate. Defaults to "Loading…". */
  text?: string;
  /** Extra classes on the wrapper. */
  className?: string;
}

export function KineticTextLoader({
  text = "Loading…",
  className,
}: KineticTextLoaderProps) {
  const reduced = useReducedMotion();
  const chars = Array.from(text);

  if (reduced) {
    return (
      <div
        role="status"
        aria-live="polite"
        className={cn("flex flex-col items-start gap-2", className)}
      >
        <span className="text-[12px] text-[var(--color-text-muted)]">{text}</span>
        <span className="h-0.5 w-24 overflow-hidden rounded-full bg-[var(--color-border)]">
          <motion.span
            className="block h-full w-1/3 rounded-full bg-[var(--color-accent)]"
            animate={{ x: ["-100%", "300%"] }}
            transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
          />
        </span>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("flex items-baseline gap-[1px]", className)}
    >
      {chars.map((ch, i) => (
        <motion.span
          key={`${ch}-${i}`}
          className="inline-block text-[12.5px] font-medium text-[var(--color-text-muted)]"
          initial={{ y: 0, opacity: 0.5 }}
          animate={{
            y: [0, -4, 0],
            opacity: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 1.2,
            repeat: Infinity,
            delay: i * 0.06,
            ease: "easeInOut",
          }}
        >
          {ch === " " ? "\u00A0" : ch}
        </motion.span>
      ))}
    </div>
  );
}

export default KineticTextLoader;
