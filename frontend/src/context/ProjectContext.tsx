/**
 * ProjectContext — lightweight global state for project data.
 *
 * Previously every meta page used `project`, `onChange` props threaded
 * through App state. This provides a context-based alternative that
 * still allows direct prop usage for backward compatibility.
 */
import * as React from "react";
import type { Project } from "../lib/project";

interface ProjectContextValue {
  project: Project;
  onChange: (p: Project) => void;
  /** Patch a sub-section of the project (immutable) */
  patch: <K extends keyof Project>(key: K, value: Project[K]) => void;
}

export const ProjectContext = React.createContext<ProjectContextValue | null>(null);

export function ProjectProvider({
  project,
  onChange,
  children,
}: {
  project: Project;
  onChange: (p: Project) => void;
  children: React.ReactNode;
}) {
  const patch = React.useCallback(
    <K extends keyof Project>(key: K, value: Project[K]) => {
      onChange({ ...project, [key]: value });
    },
    [project, onChange]
  );

  const value = React.useMemo<ProjectContextValue>(
    () => ({ project, onChange, patch }),
    [project, onChange, patch]
  );

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useProject(): ProjectContextValue {
  const ctx = React.useContext(ProjectContext);
  if (!ctx) throw new Error("useProject must be used within ProjectProvider");
  return ctx;
}
