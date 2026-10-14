"use client";

/**
 * AnnotatedText — adapted from Componentry's Annotated Text (MIT,
 * harshjdhv/componentry). Poolr translation: hand-drawn SVG marks
 * (circle, highlight, underline, bracket, strike) drawn around inline
 * text, used to emphasise key findings on the Interpret and GRADE pages.
 *
 * The source library ships a full 12-variant set; poolr keeps the six
 * that matter for a research tool and drops the decorative ones. Strokes
 * use currentColor so the mark inherits the active theme's text color,
 * and the draw-on animation is skipped under prefers-reduced-motion.
 */

import { motion, useReducedMotion } from "motion/react";
import * as React from "react";
import { cn } from "../../lib/utils";

export type AnnotatedVariant =
  | "underline"
  | "circle"
  | "highlight"
  | "box"
  | "bracket"
  | "strikethrough";

export interface AnnotatedTextProps
  extends React.HTMLAttributes<HTMLSpanElement> {
  /** Which hand-drawn mark to draw. */
  variant?: AnnotatedVariant;
  /** Whether to draw the mark on mount. Set false for always-visible. */
  animate?: boolean;
  /** Delay before drawing, in seconds. */
  delay?: number;
}

export function AnnotatedText({
  variant = "underline",
  animate = true,
  delay = 0,
  className,
  children,
  ...rest
}: AnnotatedTextProps) {
  const reduced = useReducedMotion();
  const doAnimate = animate && !reduced;
  const uid = React.useId().replace(/:/g, "");

  // Each variant is an SVG drawn in a viewBox above/below the text baseline.
  const marks: Record<AnnotatedVariant, React.ReactNode> = {
    underline: (
      <path
        d="M2 8 Q 25 4, 50 7 T 98 8"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    ),
    circle: (
      <ellipse
        cx="50"
        cy="8"
        rx="46"
        ry="7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    ),
    highlight: (
      <rect
        x="1"
        y="3"
        width="98"
        height="9"
        rx="1.5"
        fill="currentColor"
        opacity="0.22"
      />
    ),
    box: (
      <rect
        x="1.5"
        y="2"
        width="97"
        height="11"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    ),
    bracket: (
      <path
        d="M1 1 L 1 14 M 1 1 L 6 1 M 1 14 L 6 14 M 99 1 L 99 14 M 99 1 L 94 1 M 99 14 L 94 14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    ),
    strikethrough: (
      <path
        d="M2 7 Q 50 4, 98 7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.8"
      />
    ),
  };

  return (
    <span
      className={cn("relative inline-block whitespace-nowrap", className)}
      {...rest}
    >
      {children}
      <svg
        aria-hidden="true"
        viewBox="0 0 100 16"
        preserveAspectRatio="none"
        className="pointer-events-none absolute -bottom-1.5 left-0 h-3 w-full overflow-visible text-[var(--color-accent)]"
      >
        <motion.g
          id={`mark-${uid}`}
          initial={doAnimate ? { pathLength: 0, opacity: 0 } : false}
          animate={
            doAnimate
              ? { pathLength: 1, opacity: 1 }
              : { pathLength: 1, opacity: 1 }
          }
          transition={
            doAnimate
              ? { duration: 0.5, delay, ease: "easeOut" }
              : { duration: 0 }
          }
        >
          {marks[variant]}
        </motion.g>
      </svg>
    </span>
  );
}

export default AnnotatedText;
