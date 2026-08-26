"use client";

/**
 * Adapted from kokonutui ActionSearchBar (@kokonutui, MIT).
 * Ported off next-themes deps + custom debounce hook (inline useDebounce).
 * In poolr: Ctrl+K command palette for jumping between pages/actions.
 */

import { Search, Send } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Input } from "../ui";
import { cn } from "../../lib/utils";

export interface CommandAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  description?: string;
  short?: string;
  end?: string;
  onSelect?: () => void;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

const ANIMATION_VARIANTS = {
  container: {
    hidden: { opacity: 0, height: 0 },
    show: {
      opacity: 1,
      height: "auto",
      transition: { height: { duration: 0.4 }, staggerChildren: 0.05 },
    },
    exit: {
      opacity: 0,
      height: 0,
      transition: { height: { duration: 0.3 }, opacity: { duration: 0.2 } },
    },
  },
  item: {
    hidden: { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0, transition: { duration: 0.25 } },
    exit: { opacity: 0, y: -8, transition: { duration: 0.15 } },
  },
} as const;

interface CommandSearchProps {
  actions: CommandAction[];
  placeholder?: string;
  hint?: string;
}

export default function CommandSearch({
  actions,
  placeholder = "Jump to…",
  hint,
}: CommandSearchProps) {
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [selectedAction, setSelectedAction] = useState<CommandAction | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const debouncedQuery = useDebounce(query, 150);
  const rootRef = useRef<HTMLDivElement>(null);

  const filteredActions = useMemo(() => {
    if (!debouncedQuery) return actions;
    const normalizedQuery = debouncedQuery.toLowerCase().trim();
    return actions.filter((action) =>
      `${action.label} ${action.description || ""}`.toLowerCase().includes(normalizedQuery)
    );
  }, [debouncedQuery, actions]);

  useEffect(() => {
    if (!isFocused) setActiveIndex(-1);
  }, [isFocused]);

  // Close on outside click.
  useEffect(() => {
    if (!isFocused) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setIsFocused(false);
        setSelectedAction(null);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [isFocused]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setActiveIndex(-1);
  }, []);

  const runAction = useCallback(
    (action: CommandAction) => {
      action.onSelect?.();
      setSelectedAction(action);
      setIsFocused(false);
      setTimeout(() => {
        setSelectedAction(null);
        setQuery("");
      }, 350);
    },
    []
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setActiveIndex((prev) =>
            prev < filteredActions.length - 1 ? prev + 1 : 0
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setActiveIndex((prev) => (prev > 0 ? prev - 1 : filteredActions.length - 1));
          break;
        case "Enter":
          e.preventDefault();
          if (activeIndex >= 0 && filteredActions[activeIndex]) runAction(filteredActions[activeIndex]);
          else if (filteredActions.length === 1) runAction(filteredActions[0]);
          break;
        case "Escape":
          setIsFocused(false);
          setActiveIndex(-1);
          break;
      }
    },
    [filteredActions, activeIndex, runAction]
  );

  return (
    <div className="w-full" ref={rootRef}>
      <div className="relative">
        <Input
          aria-activedescendant={
            activeIndex >= 0 && isFocused
              ? `poolr-action-${filteredActions[activeIndex]?.id}`
              : undefined
          }
          aria-autocomplete="list"
          aria-expanded={isFocused}
          autoComplete="off"
          className="h-9 rounded-lg py-1.5 pr-9 pl-3 text-sm focus-visible:ring-offset-0"
          onBlur={() => setTimeout(() => setIsFocused(false), 150)}
          onChange={handleInputChange}
          onFocus={() => setIsFocused(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          role="combobox"
          type="text"
          value={query}
        />
        <div className="absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2">
          <AnimatePresence mode="popLayout">
            {query.length > 0 || activeIndex >= 0 ? (
              <motion.div
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 16, opacity: 0 }}
                initial={{ y: -16, opacity: 0 }}
                key="send"
                transition={{ duration: 0.2 }}
              >
                <Send className="h-4 w-4 text-[var(--color-text-muted)]" />
              </motion.div>
            ) : (
              <motion.div
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 16, opacity: 0 }}
                initial={{ y: -16, opacity: 0 }}
                key="search"
                transition={{ duration: 0.2 }}
              >
                <Search className="h-4 w-4 text-[var(--color-text-muted)]" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>
        {isFocused && !selectedAction && (
          <motion.div
            animate="show"
            aria-label="Command results"
            className="absolute z-40 mt-1 w-full overflow-hidden rounded-lg border border-[var(--card-border)] bg-[var(--drawer-bg)] shadow-xl"
            exit="exit"
            initial="hidden"
            role="listbox"
            variants={ANIMATION_VARIANTS.container}
          >
            <motion.ul className="max-h-72 overflow-auto p-1" role="none">
              {filteredActions.length === 0 && (
                <li className="px-3 py-4 text-center text-xs text-[var(--color-text-muted)]">
                  No matching commands
                </li>
              )}
              {filteredActions.map((action) => {
                const idx = filteredActions.indexOf(action);
                return (
                  <motion.li
                    aria-selected={activeIndex === idx}
                    className={cn(
                      "flex cursor-pointer items-center justify-between rounded-md px-3 py-2 hover:bg-[var(--hover-surface)]",
                      activeIndex === idx && "bg-[var(--hover-surface)]"
                    )}
                    id={`poolr-action-${action.id}`}
                    key={action.id}
                    layout
                    onClick={() => runAction(action)}
                    onMouseEnter={() => setActiveIndex(idx)}
                    role="option"
                    variants={ANIMATION_VARIANTS.item}
                  >
                    <div className="flex items-center gap-2">
                      <span aria-hidden="true" className="text-[var(--color-text-muted)]">
                        {action.icon}
                      </span>
                      <span className="font-medium text-sm text-[var(--color-text)]">{action.label}</span>
                      {action.description && (
                        <span className="text-xs text-[var(--color-text-muted)]">{action.description}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {action.short && (
                        <kbd className="rounded border border-[var(--color-border)] px-1.5 text-[10px] text-[var(--color-text-muted)]">
                          {action.short}
                        </kbd>
                      )}
                      {action.end && (
                        <span className="text-right text-xs text-[var(--color-text-muted)]">{action.end}</span>
                      )}
                    </div>
                  </motion.li>
                );
              })}
            </motion.ul>
            {hint && (
              <div className="mt-1 border-t border-[var(--color-border)] px-3 py-2">
                <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
                  <span>{hint}</span>
                  <span>ESC to close</span>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
