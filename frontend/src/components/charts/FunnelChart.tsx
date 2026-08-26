"use client";

/**
 * FunnelChart — poolr-local implementation inspired by Bklit UI's funnel
 * (house monochrome tokens, motion reveal). Renders a PRISMA screening
 * funnel: identified → screened → eligible → included.
 */

import { motion, useReducedMotion } from "motion/react";
import { cn } from "../../lib/utils";

export interface FunnelDatum {
  label: string;
  value: number;
  displayValue?: string;
}

interface FunnelChartProps {
  data: FunnelDatum[];
  color?: string;
  layers?: number;
  className?: string;
}

function trapezoidPath(topW: number, bottomW: number, height: number): string {
  const inset = (topW - bottomW) / 2;
  return `M0,0 L${topW},0 L${topW - inset},${height} L${inset},${height} Z`;
}

export function FunnelChart({
  data,
  color = "var(--chart-1)",
  layers = 3,
  className,
}: FunnelChartProps) {
  const reduced = useReducedMotion();
  if (!data.length) return null;

  const max = Math.max(...data.map((d) => d.value), 1);
  const width = 420;
  const rowH = 56;
  const gap = 10;
  const height = data.length * (rowH + gap) - gap;

  // Each layer's width is proportional to value/max; the last stage never
  // goes below 8% so the label stays readable.
  const widths = data.map((d) => Math.max(0.08, d.value / max) * width);

  return (
    <div className={cn("w-full", className)}>
      <svg
        aria-label="Screening funnel"
        role="img"
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {[0, 1, 2].slice(0, Math.max(1, Math.min(layers, 3))).map((i) => (
            <linearGradient id={`poolr-funnel-grad-${i}`} key={i} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.85 - i * 0.22} />
              <stop offset="100%" stopColor={color} stopOpacity={0.55 - i * 0.15} />
            </linearGradient>
          ))}
        </defs>

        {data.map((d, i) => {
          const topW = widths[i];
          const nextVal = data[i + 1]?.value ?? d.value * 0.92;
          const bottomW = Math.max(0.07, nextVal / max) * width;
          const y = i * (rowH + gap);
          const cx = width / 2;
          return (
            <motion.g
              animate={{ opacity: 1 }}
              initial={reduced ? { opacity: 0 } : { opacity: 0 }}
              key={d.label}
              transition={{ delay: reduced ? 0 : i * 0.12, duration: 0.45, ease: "easeOut" }}
            >
              <path
                d={trapezoidPath(topW, bottomW, rowH)}
                fill={`url(#poolr-funnel-grad-${Math.min(i % Math.max(1, Math.min(layers, 3)), 2)})`}
                transform={`translate(${(width - topW) / 2}, ${y})`}
              />
              {/* stage name left of the shape */}
              <text
                fill="var(--chart-label)"
                fontSize="11"
                textAnchor="end"
                x={(width - topW) / 2 - 10}
                y={y + rowH / 2 + 4}
              >
                {d.label}
              </text>
              {/* count right of the shape */}
              <text
                fill="var(--chart-foreground)"
                fontSize="12"
                fontWeight="600"
                textAnchor="start"
                x={(width + topW) / 2 + 10}
                y={y + rowH / 2 + 4}
              >
                {d.displayValue ?? String(d.value)}
              </text>
              {/* conversion to previous stage */}
              {i > 0 && data[i - 1].value > 0 && (
                <text
                  fill="var(--chart-label)"
                  fontSize="9.5"
                  opacity="0.8"
                  textAnchor="middle"
                  x={cx}
                  y={y - gap / 2 + 3}
                >
                  {Math.round((d.value / data[i - 1].value) * 100)}%
                </text>
              )}
            </motion.g>
          );
        })}
      </svg>
    </div>
  );
}

export default FunnelChart;
