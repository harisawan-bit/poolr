import { useState } from "react";
import type { Project } from "../lib/project";
import { StudySelector, useStudyManager } from "../components/StudyManager";
import { RoB2Page, RobinsIPage, Quadas2Page, Amstar2Page, NosPage, GradeEvidenceProfilePage, TesPage } from "./QualityPages";
import { BayesianMcmcPage, InfluencePage, GoshPage, PermutationPage, BootstrapPage } from "./EnginePages";

interface Props {
  project: Project;
  onProjectChange?: (p: Project) => void;
}

export default function AnalysisHub({ project, onProjectChange }: Props) {
  const { studies, activeStudyId, addStudy, removeStudy, switchStudy } = useStudyManager();
  const [activeTab, setActiveTab] = useState("bayesian");

  const tabs = [
    { key: "bayesian", label: "Bayesian MCMC", category: "Bayesian", component: BayesianMcmcPage },
    { key: "gosh", label: "GOSH", category: "Heterogeneity", component: GoshPage },
    { key: "influence", label: "Influence", category: "Diagnostics", component: InfluencePage },
    { key: "permutation", label: "Permutation", category: "Robust", component: PermutationPage },
    { key: "bootstrap", label: "Bootstrap", category: "Robust", component: BootstrapPage },
    { key: "tes", label: "TES", category: "Bias", component: TesPage },
    { key: "rob2", label: "RoB 2", category: "Quality", component: RoB2Page },
    { key: "robins-i", label: "ROBINS-I", category: "Quality", component: RobinsIPage },
    { key: "quadas-2", label: "QUADAS-2", category: "Quality", component: Quadas2Page },
    { key: "amstar-2", label: "AMSTAR-2", category: "Quality", component: Amstar2Page },
    { key: "nos", label: "NOS", category: "Quality", component: NosPage },
    { key: "grade", label: "GRADE Profile", category: "Quality", component: GradeEvidenceProfilePage },
  ];

  const activeTabConfig = tabs.find(t => t.key === activeTab)!;
  const ActiveComponent = activeTabConfig.component;
  const categories = [...new Set(tabs.map(t => t.category))];

  const handleAddStudy = () => {
    const name = prompt("Study name:");
    if (name) {
      addStudy(name, project);
    }
  };

  const handleImportProject = async () => {
    alert("Import project - feature coming soon");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <StudySelector
          studies={studies}
          activeStudyId={activeStudyId}
          onSwitch={switchStudy}
          onAdd={handleAddStudy}
          onRemove={removeStudy}
          onImport={handleImportProject}
        />
        <div className="text-xs text-[var(--color-muted-foreground)]">
          {studies.length} study/studies
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-[var(--color-border)] pb-2">
        {categories.map(cat => (
          <button key={cat} onClick={() => setActiveTab(tabs.find(t => t.category === cat)!.key)}
            className={`px-2 py-1 text-xs rounded transition-colors ${tabs.find(t => t.key === activeTab)?.category === cat ? "bg-[var(--color-accent)]/20 text-[var(--color-accent)] font-semibold" : "text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"}`}>
            {cat}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-1 border-b border-[var(--color-border)] pb-2">
        {tabs.filter(t => t.category === activeTabConfig.category).map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-2 py-1 text-xs rounded transition-colors ${activeTab === t.key ? "bg-[var(--color-accent)]/20 text-[var(--color-accent)] font-semibold" : "text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"}`}>
            {t.label}
          </button>
        ))}
      </div>

      <ActiveComponent project={project} onProjectChange={onProjectChange} />
    </div>
  );
}
