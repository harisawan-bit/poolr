"use client";

/**
 * FloatingDock — adapted from Aceternity UI's floating dock (MIT,
 * © Aceternity UI / Manu Arora) with the magnifying dock pattern the
 * user selected to replace poolr's sidebar. Icons are lucide (no
 * tabler dependency); navigation uses callbacks instead of links.
 *
 * v0.5.4: integrated status (engine + save) and workspace options
 * into the dock itself, eliminating the separate footer bar and
 * bottom-right cluster. Reduced icon proportion for a tighter,
 * more professional footprint.
 */

import { AnimatePresence, MotionValue, motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { useRef, useState, type ReactNode } from "react";
import { cn } from "../../lib/utils";

export interface DockItem {
  title: string;
  icon: React.ReactNode;
  onSelect: () => void;
  active?: boolean;
}

const ICON_SIZE = 36;

function DockIcon({ item, mouseX }: { item: DockItem; mouseX: MotionValue<number> }) {
  const ref = useRef<HTMLButtonElement>(null);

  const distance = useTransform(mouseX, (val: number) => {
    const bounds = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 };
    return val - bounds.x - bounds.width / 2;
  });

  const iconSize = useSpring(useTransform(distance, [-120, 0, 120], [ICON_SIZE, 48, ICON_SIZE]), {
    mass: 0.1,
    stiffness: 150,
    damping: 12,
  });
  const iconTranslate = useSpring(useTransform(distance, [-120, 0, 120], [-4, 0, -4]), {
    mass: 0.1,
    stiffness: 150,
    damping: 12,
  });

  const [hovered, setHovered] = useState(false);

  return (
    <motion.button
      aria-label={item.title}
      aria-current={item.active ? "page" : undefined}
      className={cn(
        "relative flex aspect-square rounded-full items-center justify-center border transition-colors",
        item.active
          ? "border-[var(--color-border-strong)] bg-[var(--btn-bg)] text-[var(--btn-fg)]"
          : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
      )}
      onClick={item.onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      ref={ref}
      style={{ width: iconSize, height: iconSize, translateY: iconTranslate }}
      type="button"
    >
      <div className="flex h-full w-full items-center justify-center">{item.icon}</div>

      <AnimatePresence>
        {hovered && (
          <motion.div
            animate={{ opacity: 1, y: 0, pointerEvents: "auto" }}
            className="absolute -top-9 left-1/2 w-fit whitespace-nowrap rounded-md border border-[var(--card-border)] bg-[var(--drawer-bg)] px-2 py-0.5 text-[11px] text-[var(--color-text)] shadow-md"
            exit={{ opacity: 0, y: -4, pointerEvents: "none" }}
            initial={{ opacity: 0, y: 6, pointerEvents: "none" }}
            role="tooltip"
          >
            {item.title}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

interface DockStatusProps {
  connected: boolean | null;
  connLabel: string;
  saveState: "idle" | "saving" | "saved" | "error";
  saveLabel: string;
}

function DockStatus({ connected, connLabel, saveState, saveLabel }: DockStatusProps) {
  const connDot =
    connected === null
      ? "bg-[var(--color-text-muted)]"
      : connected
        ? "bg-[var(--color-include)]"
        : "bg-[var(--color-exclude)]";
  const saveDot =
    saveState === "error"
      ? "bg-[var(--color-exclude)]"
      : saveState === "saved"
        ? "bg-[var(--color-include)]"
        : "bg-[#8b8d96]";

  return (
    <div className="flex flex-col gap-1 px-2 py-1.5 text-[10px] text-[var(--color-text-muted)]">
      <span className="flex items-center gap-1.5">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${connDot}`} />
        <span className="truncate">{connLabel}</span>
      </span>
      <span className="flex items-center gap-1.5">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${saveDot}`} />
        <span className="truncate">{saveLabel}</span>
      </span>
    </div>
  );
}

interface FloatingDockProps {
  items: DockItem[];
  className?: string;
  connected?: boolean | null;
  connLabel?: string;
  saveState?: "idle" | "saving" | "saved" | "error";
  saveLabel?: string;
  optionsTrigger?: ReactNode;
}

export function FloatingDock({
  items,
  className,
  connected = null,
  connLabel = "",
  saveState = "idle",
  saveLabel = "",
  optionsTrigger,
}: FloatingDockProps) {
  const mouseX = useMotionValue(Number.POSITIVE_INFINITY);

  return (
    <motion.div
      className={cn(
        "mx-auto flex h-12 items-center gap-1.5 rounded-2xl border border-[var(--card-border)] bg-[var(--drawer-bg)] px-2.5 shadow-xl",
        className
      )}
      onMouseMove={(e) => mouseX.set(e.pageX)}
      onMouseLeave={() => mouseX.set(Number.POSITIVE_INFINITY)}
    >
      {items.map((item) => (
        <DockIcon item={item} key={item.title} mouseX={mouseX} />
      ))}

      {/* Divider between nav and status/options */}
      <div className="mx-1 h-6 w-px bg-[var(--color-border)]" />

      {/* Workspace options trigger (if provided) */}
      {optionsTrigger}

      {/* Integrated status indicators */}
      <DockStatus
        connected={connected}
        connLabel={connLabel}
        saveState={saveState}
        saveLabel={saveLabel}
      />
    </motion.div>
  );
}

export default FloatingDock;
