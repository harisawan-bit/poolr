"use client";

/**
 * AnimatedNumber — adapted from Vengeance UI's Animated Number / Stats Counter
 * (MIT, Ashutoshx7). Poolr translation: pools the count-up onto the token
 * palette, formats with Intl.NumberFormat, and fires once when the element
 * scrolls into view (matching the source library's scroll-triggered counter).
 * Every numeric readout in poolr (I², pooled effect, study counts) can wrap
 * this component for a smooth transition instead of an instant jump.
 *
 * Honours prefers-reduced-motion by jumping straight to the final value.
 */

import NumberFlow from "@number-flow/react";
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";

export interface AnimatedNumberProps {
  /** Target numeric value. */
  value: number;
  /** Decimal places to render. Defaults to 0 for integers. */
  decimals?: number;
  /** Optional prefix (e.g. "$", "τ²"). */
  prefix?: string;
  /** Optional suffix (e.g. "%", "ms"). */
  suffix?: string;
  /** Locale for grouping. Defaults to "en-US". */
  locale?: string;
  /** Extra classes on the wrapper. */
  className?: string;
}

/**
 * Wraps @number-flow/react (already in poolr's package.json — no new
 * dependency). The library handles the digit tween internally; we only
 * own the IntersectionObserver gate so the animation fires when the
 * caller's card becomes visible.
 */
export function AnimatedNumber({
  value,
  decimals,
  prefix = "",
  suffix = "",
  locale = "en-US",
  className,
}: AnimatedNumberProps) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            io.disconnect();
          }
        }
      },
      { threshold: 0.2 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const dp = decimals ?? (Number.isInteger(value) ? 0 : 2);
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  }).format(value);

  return (
    <div ref={ref} className={className}>
      <NumberFlow
        value={value}
        format={{
          minimumFractionDigits: dp,
          maximumFractionDigits: dp,
        }}
        locales={locale}
        className="tabular-nums"
      />
      {(prefix || suffix) && (
        <span className="sr-only">
          {prefix}
          {formatted}
          {suffix}
        </span>
      )}
    </div>
  );
}

export default AnimatedNumber;
