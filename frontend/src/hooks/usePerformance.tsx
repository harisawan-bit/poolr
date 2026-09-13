/**
 * Performance hooks — memoization, debouncing, virtualization, cleanup.
 */

import * as React from "react";

// ── useDebouncedValue ───────────────────────────────────────────────────

/**
 * Debounce a value — prevents re-computation on every keystroke.
 * Default 250ms delay balances responsiveness with CPU savings.
 */
export function useDebouncedValue<T>(value: T, delayMs = 250): T {
  const [debounced, setDebounced] = React.useState(value);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    timer.current = setTimeout(() => setDebounced(value), delayMs);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [value, delayMs]);

  return debounced;
}

// ── useMemoizedCallback ─────────────────────────────────────────────────

/**
 * Stable callback that always calls the latest implementation
 * without causing re-renders in children that depend on it.
 */
export function useMemoizedCallback<T extends (...args: any[]) => any>(
  fn: T
): T {
  const ref = React.useRef(fn);
  ref.current = fn;
  return React.useCallback(
    ((...args: any[]) => ref.current(...args)) as T,
    []
  );
}

// ── useIsMounted ────────────────────────────────────────────────────────

/**
 * Returns a ref that is true while the component is mounted.
 * Use in async callbacks to prevent setState on unmounted components.
 */
export function useIsMounted(): React.MutableRefObject<boolean> {
  const mounted = React.useRef(true);
  React.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  return mounted;
}

// ── useAbortableEffect ──────────────────────────────────────────────────

/**
 * useEffect that auto-aborts async work on cleanup.
 * Prevents memory leaks and stale async updates.
 */
export function useAbortableEffect(
  effect: (signal: AbortSignal) => (void | (() => void) | Promise<void>),
  deps: React.DependencyList
): void {
  React.useEffect(() => {
    const controller = new AbortController();
    const result = effect(controller.signal);
    return () => {
      controller.abort();
      if (typeof result === "function") result();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

// ── useStableDeps ───────────────────────────────────────────────────────

/**
 * Memoize an object/array so its identity is stable when contents
 * haven't changed. Prevents unnecessary re-renders from new object
 * identities.
 */
export function useStableDeps<T extends Record<string, unknown> | unknown[]>(
  deps: T
): T {
  const ref = React.useRef<T>(deps);
  const prev = ref.current;

  const changed = React.useMemo(() => {
    if (Array.isArray(deps) && Array.isArray(prev)) {
      if (deps.length !== prev.length) return true;
      for (let i = 0; i < deps.length; i++) {
        if (deps[i] !== prev[i]) return true;
      }
      return false;
    }
    if (typeof deps === "object" && typeof prev === "object") {
      const keys = Object.keys(deps);
      if (keys.length !== Object.keys(prev).length) return true;
      for (const k of keys) {
        if ((deps as Record<string, unknown>)[k] !== (prev as Record<string, unknown>)[k]) return true;
      }
      return false;
    }
    return deps !== prev;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deps]);

  if (changed) ref.current = deps;
  return ref.current;
}

// ── useThrottledValue ───────────────────────────────────────────────────

/**
 * Throttle a value — caps update rate to once per interval.
 * Good for sliders, resize handlers, scroll position.
 */
export function useThrottledValue<T>(value: T, intervalMs = 100): T {
  const [throttled, setThrottled] = React.useState(value);
  const lastRan = React.useRef(0);

  React.useEffect(() => {
    const now = Date.now();
    if (now - lastRan.current >= intervalMs) {
      lastRan.current = now;
      setThrottled(value);
    } else {
      const timer = setTimeout(() => {
        lastRan.current = Date.now();
        setThrottled(value);
      }, intervalMs - (now - lastRan.current));
      return () => clearTimeout(timer);
    }
  }, [value, intervalMs]);

  return throttled;
}

// ── VirtualList ─────────────────────────────────────────────────────────

export interface VirtualListProps<T> {
  items: T[];
  /** Fixed row height in px */
  rowHeight: number;
  /** Container height in px */
  height: number;
  /** Extra rows rendered above/below viewport */
  overscan?: number;
  /** Render a single row */
  renderRow: (item: T, index: number) => React.ReactNode;
  getKey: (item: T, index: number) => string | number;
  className?: string;
}

/**
 * Virtualized list — only renders rows visible in the viewport.
 * Use for lists > 100 items to avoid DOM bloat.
 */
export function VirtualList<T>({
  items,
  rowHeight,
  height,
  overscan = 5,
  renderRow,
  getKey,
  className,
}: VirtualListProps<T>) {
  const [scrollTop, setScrollTop] = React.useState(0);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const totalHeight = items.length * rowHeight;
  const startIdx = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const visibleCount = Math.ceil(height / rowHeight) + 2 * overscan;
  const endIdx = Math.min(items.length, startIdx + visibleCount);

  const offsetY = startIdx * rowHeight;

  const handleScroll = React.useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      setScrollTop(e.currentTarget.scrollTop);
    },
    []
  );

  // Cleanup: clear scroll state on unmount
  React.useEffect(() => {
    return () => {
      if (containerRef.current) containerRef.current.onscroll = null;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ height, overflowY: "auto", position: "relative" }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: "relative" }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {items.slice(startIdx, endIdx).map((item, i) => {
            const idx = startIdx + i;
            return (
              <div key={getKey(item, idx)} style={{ height: rowHeight }}>
                {renderRow(item, idx)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── withLazyInitialization ──────────────────────────────────────────────

/**
 * Lazy-initialize a value — runs factory only once on first render.
 * Unlike useState(() => factory()), this also works with useRef
 * semantics and never re-runs.
 */
export function useLazyRef<T>(factory: () => T): React.MutableRefObject<T> {
  const ref = React.useRef<T | null>(null);
  if (ref.current === null) {
    ref.current = factory();
  }
  return ref as React.MutableRefObject<T>;
}

// ── usePrevious ─────────────────────────────────────────────────────────

/**
 * Returns the previous value of a state/prop.
 * Useful for diffing without re-rendering.
 */
export function usePrevious<T>(value: T): T | undefined {
  const ref = React.useRef<T | undefined>(undefined);
  React.useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref.current;
}

// ── useDeepCompareEffect ────────────────────────────────────────────────

/**
 * useEffect with deep comparison — only fires when deps actually change
 * by value, not by reference. Use for non-primitive deps.
 */
export function useDeepCompareEffect(
  effect: () => void | (() => void),
  deps: React.DependencyList
): void {
  const ref = React.useRef<React.DependencyList>([]);

  const changed = deps.some((dep, i) => !Object.is(dep, ref.current[i]));
  if (changed) {
    ref.current = deps;
  }

  React.useEffect(effect, ref.current);
}
