"use client";

/**
 * Adapted from kokonutui Toolbar (@dorianbaffier, MIT) — springy icon
 * buttons that expand their label when active, click notifications,
 * and the lock toggle. In poolr: contextual action bar per page.
 */

import type { LucideIcon } from "lucide-react";
import { AnimatePresence, motion, type Transition } from "motion/react";
import * as React from "react";
import { cn } from "../../lib/utils";

interface ToolbarItem {
  id: string;
  title: string;
  icon: LucideIcon;
}

interface ToolbarProps {
  items?: ToolbarItem[];
  defaultSelected?: string | null;
  className?: string;
  onSelect?: (itemId: string) => void;
}

const buttonVariants = {
  initial: { gap: 0, paddingLeft: ".5rem", paddingRight: ".5rem" },
  animate: (isSelected: boolean) => ({
    gap: isSelected ? ".5rem" : 0,
    paddingLeft: isSelected ? "1rem" : ".5rem",
    paddingRight: isSelected ? "1rem" : ".5rem",
  }),
};

const spanVariants = {
  initial: { width: 0, opacity: 0 },
  animate: { width: "auto", opacity: 1 },
  exit: { width: 0, opacity: 0 },
};

const notificationVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: -8 },
  exit: { opacity: 0, y: -16 },
};

const lineVariants = {
  initial: { scaleX: 0, x: "-50%" },
  animate: { scaleX: 1, x: "0%", transition: { duration: 0.2, ease: "easeOut" } },
  exit: { scaleX: 0, x: "50%", transition: { duration: 0.2, ease: "easeIn" } },
};

const transition: Transition = { type: "spring", bounce: 0, duration: 0.4 };

export function Toolbar({ items, defaultSelected = null, className, onSelect }: ToolbarProps) {
  const [selected, setSelected] = React.useState<string | null>(defaultSelected);
  const [activeNotification, setActiveNotification] = React.useState<string | null>(null);

  const handleItemClick = (itemId: string) => {
    const next = selected === itemId ? null : itemId;
    setSelected(next);
    if (next) onSelect?.(itemId);
    else onSelect?.("");
    setActiveNotification(itemId);
    setTimeout(() => setActiveNotification(null), 1500);
  };

  return (
    <div className={cn("relative flex items-center gap-2 p-1.5", className)}>
      <AnimatePresence>
        {activeNotification && (
          <motion.div
            animate="animate"
            className="pointer-events-none absolute -top-7 left-1/2 z-50 -translate-x-1/2"
            exit="exit"
            initial="initial"
            transition={{ duration: 0.3 }}
            variants={notificationVariants}
          >
            <div className="rounded-full bg-[var(--btn-bg)] px-3 py-1 text-[11px] text-[var(--btn-fg)] shadow-md">
              {items?.find((item) => item.id === activeNotification)?.title} ready
            </div>
            <motion.div
              animate="animate"
              className="absolute -bottom-px left-1/2 h-[2px] w-full origin-left bg-[var(--btn-bg)]"
              exit="exit"
              initial="initial"
              variants={lineVariants as never}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center gap-1.5">
        {(items ?? []).map((item) => (
          <motion.button
            animate="animate"
            aria-label={item.title}
            aria-pressed={selected === item.id}
            className={cn(
              "relative flex items-center rounded-lg py-2",
              "font-medium text-[12.5px] transition-colors duration-300",
              selected === item.id
                ? "bg-[var(--btn-bg)] text-[var(--btn-fg)]"
                : "text-[var(--color-text-muted)] hover:bg-[var(--hover-surface)] hover:text-[var(--color-text)]"
            )}
            custom={selected === item.id}
            initial={false}
            key={item.id}
            onClick={() => handleItemClick(item.id)}
            title={item.title}
            transition={transition}
            variants={buttonVariants}
          >
            <item.icon size={16} />
            <AnimatePresence initial={false}>
              {selected === item.id && (
                <motion.span
                  animate="animate"
                  className="overflow-hidden whitespace-nowrap"
                  exit="exit"
                  initial="initial"
                  transition={transition}
                  variants={spanVariants}
                >
                  <span className="pl-1">{item.title}</span>
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

export default Toolbar;
