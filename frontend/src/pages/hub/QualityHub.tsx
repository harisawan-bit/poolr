import { useState } from "react";
import type { Project } from "../../lib/project";
import {
  RoB2Page,
  RobinsIPage,
  Quadas2Page,
  Amstar2Page,
  NosPage,
  GradeEvidenceProfilePage,
  GradeSoFTablePage
} from "../QualityPages";
import { ShieldCheck, ShieldAlert, CheckSquare, Award, Star, FileText } from "lucide-react";

interface Props {
  project: Project;
  onProjectChange?: (p: Project) => void;
}

export function QualityHub({ project, onProjectChange: _, initialPanel }: Props & { initialPanel?: string }) {
  const [subTab, setSubTab] = useState<"rob2" | "robins" | "quadas" | "amstar" | "nos" | "grade" | "sof">((["rob2", "robins", "quadas", "amstar", "nos", "grade", "sof"] as readonly string[]).includes(initialPanel ?? "") ? initialPanel as "rob2" | "robins" | "quadas" | "amstar" | "nos" | "grade" | "sof" : "rob2");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 border-b border-[var(--color-border)] pb-2 overflow-x-auto">
        <button
          onClick={() => setSubTab("rob2")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
            subTab === "rob2"
              ? "bg-[var(--btn-bg)] text-[var(--btn-fg)] font-semibold shadow-sm"
              : "text-[var(--color-muted-foreground)] hover:text-[var(--color-text)] hover:bg-[var(--hover-surface)]"
          }`}
        >
          <ShieldCheck size={14} />
          RoB 2 (RCTs)
        </button>
        <button
          onClick={() => setSubTab("robins")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
            subTab === "robins"
              ? "bg-[var(--btn-bg)] text-[var(--btn-fg)] font-semibold shadow-sm"
              : "text-[var(--color-muted-foreground)] hover:text-[var(--color-text)] hover:bg-[var(--hover-surface)]"
          }`}
        >
          <ShieldAlert size={14} />
          ROBINS-I (Non-Randomized)
        </button>
        <button
          onClick={() => setSubTab("quadas")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
            subTab === "quadas"
              ? "bg-[var(--btn-bg)] text-[var(--btn-fg)] font-semibold shadow-sm"
              : "text-[var(--color-muted-foreground)] hover:text-[var(--color-text)] hover:bg-[var(--hover-surface)]"
          }`}
        >
          <CheckSquare size={14} />
          QUADAS-2 (Diagnostic)
        </button>
        <button
          onClick={() => setSubTab("amstar")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
            subTab === "amstar"
              ? "bg-[var(--btn-bg)] text-[var(--btn-fg)] font-semibold shadow-sm"
              : "text-[var(--color-muted-foreground)] hover:text-[var(--color-text)] hover:bg-[var(--hover-surface)]"
          }`}
        >
          <Award size={14} />
          AMSTAR 2 (Overview)
        </button>
        <button
          onClick={() => setSubTab("nos")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
            subTab === "nos"
              ? "bg-[var(--btn-bg)] text-[var(--btn-fg)] font-semibold shadow-sm"
              : "text-[var(--color-muted-foreground)] hover:text-[var(--color-text)] hover:bg-[var(--hover-surface)]"
          }`}
        >
          <Star size={14} />
          Newcastle-Ottawa (NOS)
        </button>
        <button
                  onClick={() => setSubTab("grade")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                    subTab === "grade"
                      ? "bg-[var(--btn-bg)] text-[var(--btn-fg)] font-semibold shadow-sm"
                      : "text-[var(--color-muted-foreground)] hover:text-[var(--color-text)] hover:bg-[var(--hover-surface)]"
                  }`}
                >
                  <FileText size={14} />
                  GRADE Evidence Profile
                </button>
                <button
                  onClick={() => setSubTab("sof")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                    subTab === "sof"
                      ? "bg-[var(--btn-bg)] text-[var(--btn-fg)] font-semibold shadow-sm"
                      : "text-[var(--color-muted-foreground)] hover:text-[var(--color-text)] hover:bg-[var(--hover-surface)]"
                  }`}
                >
                  <FileText size={14} />
                  GRADE SoF Table
                </button>
              </div>

      {subTab === "rob2" && <RoB2Page project={project} />}
      {subTab === "robins" && <RobinsIPage project={project} />}
      {subTab === "quadas" && <Quadas2Page project={project} />}
      {subTab === "amstar" && <Amstar2Page project={project} />}
      {subTab === "nos" && <NosPage project={project} />}
      {subTab === "grade" && <GradeEvidenceProfilePage project={project} />}
      {subTab === "sof" && <GradeSoFTablePage project={project} />}
    </div>
  );
}
