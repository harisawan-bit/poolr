/**
 * SaveContext — lightweight save-state management.
 *
 * Tracks save status, debounced auto-save, and provides a unified
 * interface for triggering saves from any page.
 */
import * as React from "react";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

interface SaveContextValue {
  status: SaveStatus;
  lastSaved: number | null;
  triggerSave: () => void;
  setStatus: (s: SaveStatus) => void;
}

export const SaveContext = React.createContext<SaveContextValue | null>(null);

export function SaveProvider({
  project,
  projectPath,
  children,
}: {
  project: unknown;
  projectPath: string | null;
  children: React.ReactNode;
}) {
  const [status, setStatus] = React.useState<SaveStatus>("idle");
  const [lastSaved, setLastSaved] = React.useState<number | null>(null);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const seqRef = React.useRef(0);

  const triggerSave = React.useCallback(() => {
    if (!projectPath) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    seqRef.current += 1;
    const mySeq = seqRef.current;
    setStatus("saving");
    timerRef.current = setTimeout(async () => {
      try {
        // Lazy import to avoid circular deps
        const { saveProject } = await import("../lib/api");
        await saveProject(projectPath, project);
        if (seqRef.current === mySeq) {
          setStatus("saved");
          setLastSaved(Date.now());
        }
      } catch {
        if (seqRef.current === mySeq) setStatus("error");
      }
    }, 800);
  }, [project, projectPath]);

  const value = React.useMemo<SaveContextValue>(
    () => ({ status, lastSaved, triggerSave, setStatus }),
    [status, lastSaved, triggerSave]
  );

  return <SaveContext.Provider value={value}>{children}</SaveContext.Provider>;
}

export function useSave(): SaveContextValue {
  const ctx = React.useContext(SaveContext);
  if (!ctx) throw new Error("useSave must be used within SaveProvider");
  return ctx;
}
