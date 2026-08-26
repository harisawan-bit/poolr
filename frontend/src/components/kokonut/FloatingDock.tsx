"use client";

/**
 * FloatingDock — adapted from Aceternity UI's floating dock (MIT,
 * © Aceternity UI / Manu Arora) with the magnifying dock pattern the
 * user selected to replace poolr's sidebar. Icons are lucide (no
 * tabler dependency); navigation uses callbacks instead of links.
 */

import { AnimatePresence, MotionValue, motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { useRef, useState } from "react";
import { cn } from "../../lib/utils";

export interface DockItem {
  title: string;
  icon: React.ReactNode;
  onSelect: () => void;
  active?: boolean;
}

const ICON_SIZE = 40;

function DockIcon({ item, mouseX }: { item: DockItem; mouseX: MotionValue<number> }) {
  const ref = useRef<HTMLButtonElement>(null);

  const distance = useTransform(mouseX, (val: number) => {
    const bounds = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 };
    return val - bounds.x - bounds.width / 2;
  });

  const iconSize = useSpring(useTransform(distance, [-140, 0, 140], [ICON_SIZE, 56, ICON_SIZE]), {
    mass: 0.1,
    stiffness: 150,
    damping: 12,
  });
  const iconTranslate = useSpring(useTransform(distance, [-140, 0, 140], [-6, 0, -6]), {
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

export function FloatingDock({ items, className }: { items: DockItem[]; className?: string }) {
  const mouseX = useMotionValue(Number.POSITIVE_INFINITY);

  return (
    <motion.div
      className={cn(
        "mx-auto flex h-14 items-end gap-2 rounded-2xl border border-[var(--card-border)] bg-[var(--drawer-bg)] px-3 pb-2 pt-1 shadow-xl",
        className
      )}
      onMouseMove={(e) => mouseX.set(e.pageX)}
      onMouseLeave={() => mouseX.set(Number.POSITIVE_INFINITY)}
    >
      {items.map((item) => (
        <DockIcon item={item} key={item.title} mouseX={mouseX} />
      ))}
    </motion.div>
  );
}

export default FloatingDock;
