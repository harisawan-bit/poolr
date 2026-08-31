"use client";

/**
 * SankeyChart — poolr-local PRISMA 2020 flow diagram, inspired by Bklit's
 * sankey (node/link/tooltip composition). Pure SVG + motion, house tokens.
 * Stages: Identification → Screening → Included, with exclusions.
 *
 * v0.5.4: tightened column spacing, balanced node heights, and a compact
 * viewBox that scales proportionally within its card instead of stretching
 * to fill the full width.
 */

import { useId } from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "../../lib/utils";

export interface SankeyNode {
  name: string;
  category: "source" | "stage" | "outcome" | "excluded";
  value?: number;
}

export interface SankeyLink {
  source: number;
  target: number;
  value: number;
}

export interface SankeyData {
  nodes: SankeyNode[];
  links: SankeyLink[];
}

interface SankeyChartProps {
  data: SankeyData;
  className?: string;
}

const NODE_W = 14;
const NODE_GAP_Y = 10;

export function SankeyChart({ data, className }: SankeyChartProps) {
  const reduced = useReducedMotion();
  const uid = useId().replace(/[:]/g, "");

  // Column layout by category order: source(0) stage(1) outcome(2) / excluded hangs right of its source column
  const colOrder = ["source", "stage", "outcome"] as const;
  const columns = new Map<number, SankeyNode[]>();
  data.nodes.forEach((n) => {
    const c = Math.max(0, colOrder.indexOf(n.category as (typeof colOrder)[number]));
    if (!columns.has(c)) columns.set(c, []);
    columns.get(c)!.push(n);
  });

  // Compact viewBox — proportional to a card, not full-bleed
  const W = 420;
  const H = 200;
  const colX = [30, 165, 290];

  // Node geometry: heights proportional to value
  interface Geom {
    node: SankeyNode;
    index: number;
    x: number;
    y: number;
    h: number;
    col: number;
  }
  const geoms: Geom[] = [];
  columns.forEach((nodesInCol, col) => {
    const total = nodesInCol.reduce((s, n) => s + (n.value ?? 1), 0);
    const usableH = H - NODE_GAP_Y * (nodesInCol.length - 1);
    let y = 16;
    nodesInCol.forEach((n) => {
      const h = Math.max(18, ((n.value ?? 1) / Math.max(total, 1)) * usableH * 0.7);
      geoms.push({ node: n, index: data.nodes.indexOf(n), x: colX[col] ?? 30, y, h, col });
      y += h + NODE_GAP_Y;
    });
  });

  const geomOf = (idx: number) => geoms.find((g) => g.index === idx)!;
  const colorOf = (n: SankeyNode) =>
    n.category === "excluded"
      ? "var(--color-exclude)"
      : n.category === "outcome"
        ? "var(--color-include)"
        : "var(--chart-1)";

  return (
    <div className={cn("relative w-full max-w-[460px]", className)}>
      <svg aria-label="PRISMA flow diagram" role="img" viewBox={`0 0 ${W} ${H}`} className="h-auto w-full">
        <defs>
          {data.links.map((l, i) => (
            <linearGradient
              gradientUnits="userSpaceOnUse"
              id={`${uid}-link-${i}`}
              key={i}
              x1={geomOf(l.source).x + NODE_W}
              x2={geomOf(l.target).x}
              y1="0"
              y2="0"
            >
              <stop offset="0%" stopColor={colorOf(data.nodes[l.source])} stopOpacity="0.35" />
              <stop offset="100%" stopColor={colorOf(data.nodes[l.target])} stopOpacity="0.35" />
            </linearGradient>
          ))}
        </defs>

        {/* links */}
        {data.links.map((l, i) => {
          const s = geomOf(l.source);
          const t = geomOf(l.target);
          const maxV = Math.max(...data.links.map((x) => x.value), 1);
          const th = Math.max(4, (l.value / maxV) * 40);
          const sy = s.y + s.h / 2;
          const ty = t.y + t.h / 2;
          const d = `M${s.x + NODE_W},${sy - th / 2} C${s.x + NODE_W + 50},${sy - th / 2} ${t.x - 50},${ty - th / 2} ${t.x},${ty - th / 2} L${t.x},${ty + th / 2} C${t.x - 50},${ty + th / 2} ${s.x + NODE_W + 50},${sy + th / 2} ${s.x + NODE_W},${sy + th / 2} Z`;
          return (
            <motion.path
              d={d}
              fill={`url(#${uid}-link-${i})`}
              initial={reduced ? { opacity: 1 } : { opacity: 0 }}
              animate={{ opacity: 1 }}
              key={`link-${i}`}
              transition={{ delay: reduced ? 0 : 0.15 + i * 0.08, duration: 0.4 }}
            >
              <title>{`${data.nodes[l.source].name} → ${data.nodes[l.target].name}: ${l.value}`}</title>
            </motion.path>
          );
        })}

        {/* nodes */}
        {geoms.map((g) => (
          <motion.g
            animate={{ opacity: 1 }}
            initial={reduced ? { opacity: 0 } : { opacity: 0, x: -6 }}
            key={`node-${g.index}`}
            transition={{ delay: reduced ? 0 : g.col * 0.1, duration: 0.35, ease: "easeOut" }}
          >
            <rect fill={colorOf(g.node)} height={g.h} rx="3" width={NODE_W} x={g.x} y={g.y} />
            <text
              fill="var(--chart-foreground)"
              fontSize="10.5"
              fontWeight="500"
              textAnchor={g.col === 0 ? "end" : g.col === 2 ? "start" : "end"}
              x={g.col === 2 ? g.x + NODE_W + 6 : g.x - 6}
              y={g.y + g.h / 2 - 1}
            >
              {g.node.name}
            </text>
            {g.node.value != null && (
              <text
                fill="var(--chart-label)"
                fontSize="9.5"
                textAnchor={g.col === 2 ? "start" : "end"}
                x={g.col === 2 ? g.x + NODE_W + 6 : g.x - 6}
                y={g.y + g.h / 2 + 10}
              >
                {g.node.value.toLocaleString()}
              </text>
            )}
          </motion.g>
        ))}
      </svg>
    </div>
  );
}

export default SankeyChart;
