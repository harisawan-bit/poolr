import { downloadText, type Project } from "../lib/project";
import { generateProsperoMarkdown } from "../lib/prospero";
import ResearchDiscovery from "../components/ResearchDiscovery";
import { Card, Input, Textarea, Button } from "../components/ui";
import { suggestPICO } from "../lib/ai";
import { Sparkles, Loader2, Download } from "lucide-react";
import { useState } from "react";
import { StepCommentsButton } from "../components/StepCommentsDrawer";

export default function Protocol({ project, onChange }: { project: Project; onChange: (p: Project) => void }) {
  const set = (patch: Partial<Project>) => onChange({ ...project, ...patch });
  const [busy, setBusy] = useState(false);
  const [suggestion, setSuggestion] = useState<Partial<Project["pico"]> | null>(null);
  const [error, setError] = useState("");

  const handleSuggestPICO = async () => {
    const question = project.metadata.title || project.protocol.objective;
    if (!question.trim()) return;
    setBusy(true); setError("");
    try {
      const pico = await suggestPICO(question);
      setSuggestion(pico);
    } catch (e) { setError(String(e)); } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      {error && <p role="alert" className="text-sm">{error}</p>}
      {suggestion && <Card title="Review the AI suggestion"><p className="text-xs mb-2">Verify this proposal and search for existing reviews before applying it.</p>{Object.entries(suggestion).map(([key, value]) => <p key={key} className="text-sm mb-2"><strong>{key}:</strong> {value}</p>)}<Button onClick={() => { set({ pico: { ...project.pico, ...suggestion } }); setSuggestion(null); }}>Apply reviewed suggestion</Button><Button onClick={() => setSuggestion(null)}>Discard</Button></Card>}
      <ResearchDiscovery topic={project.metadata.title || project.protocol.objective} />
      <Card title="Review title" right={<StepCommentsButton step="protocol" stepTitle="Protocol & PICO" />}>
        <Input
          value={project.metadata.title ?? ""}
          placeholder="e.g. Effect of X on Y in Z populations"
          onChange={(e) => set({ metadata: { ...project.metadata, title: e.target.value } })}
        />
      </Card>

      <Card
        title="PICO definition"
        right={
          <Button
            variant="outline"
            size="sm"
            onClick={handleSuggestPICO}
            disabled={busy || !(project.metadata.title || project.protocol.objective).trim()}
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {busy ? "Suggesting…" : "Suggest PICO"}
          </Button>
        }
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="block text-xs font-medium" htmlFor="protocol-population">Population</label>
            <Textarea id="protocol-population" rows={3} value={project.pico.population}
              onChange={(e) => set({ pico: { ...project.pico, population: e.target.value } })}
              placeholder="Participants / patients" />
          </div>
          <div>
            <label className="block text-xs font-medium" htmlFor="protocol-intervention">Intervention</label>
            <Textarea id="protocol-intervention" rows={3} value={project.pico.intervention}
              onChange={(e) => set({ pico: { ...project.pico, intervention: e.target.value } })}
              placeholder="Experimental exposure / treatment" />
          </div>
          <div>
            <label className="block text-xs font-medium" htmlFor="protocol-comparator">Comparator</label>
            <Textarea id="protocol-comparator" rows={3} value={project.pico.comparator}
              onChange={(e) => set({ pico: { ...project.pico, comparator: e.target.value } })}
              placeholder="Control / standard of care" />
          </div>
          <div>
            <label className="block text-xs font-medium" htmlFor="protocol-outcomes">Outcomes</label>
            <Textarea id="protocol-outcomes" rows={3} value={project.pico.outcomes}
              onChange={(e) => set({ pico: { ...project.pico, outcomes: e.target.value } })}
              placeholder="Primary & secondary outcomes" />
          </div>
        </div>
      </Card>

      <Card
        title="Protocol details"
        right={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const md = generateProsperoMarkdown({
                  reviewTitle: project.metadata.title || "Untitled Systematic Review",
                  reviewQuestion: project.protocol.objective || `${project.pico.intervention} vs ${project.pico.comparator} in ${project.pico.population}`,
                  population: project.pico.population || "Not specified",
                  intervention: project.pico.intervention || "Not specified",
                  comparator: project.pico.comparator || "Not specified",
                  outcome: project.pico.outcomes || "Not specified",
                  studyDesign: (project.protocol.studyDesigns || "Randomized controlled trials").split(/[;,]/).map((s) => s.trim()).filter(Boolean),
                  searchSources: project.protocol.databases.split(/[;,]/).map((s) => s.trim()).filter(Boolean),
                  searchDate: new Date().toISOString().slice(0, 10),
                  languageRestrictions: "None",
                  contactName: "Lead Reviewer",
                  contactEmail: "",
                  affiliation: "",
                  reviewTeam: "Review team",
                  anticipatedStartDate: project.metadata.created.slice(0, 10),
                  anticipatedCompletionDate: "",
                  status: "ongoing",
                });
                downloadText("prospero_protocol_draft.md", md, "text/markdown");
              }}
            >
              <Download className="h-3.5 w-3.5" /> Export PROSPERO (.md)
            </Button>
            <Button variant="ghost" size="sm" onClick={() => window.dispatchEvent(new CustomEvent("poolr:gopage", { detail: "search" }))}>
              Registry &amp; Search →
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium" htmlFor="protocol-objective">Objective</label>
            <Textarea id="protocol-objective" rows={2} value={project.protocol.objective}
              onChange={(e) => set({ protocol: { ...project.protocol, objective: e.target.value } })}
              placeholder="State the primary research question." />
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="block text-xs font-medium" htmlFor="protocol-inclusion">Inclusion criteria (synced to AI Screening &amp; Manuscript)</label>
              <Textarea id="protocol-inclusion" rows={2} value={project.protocol.inclusionCriteria ?? ""}
                onChange={(e) => set({ protocol: { ...project.protocol, inclusionCriteria: e.target.value } })}
                placeholder="e.g. Adult patients (≥18y), randomized trials, primary clinical outcomes reported" />
            </div>
            <div>
              <label className="block text-xs font-medium" htmlFor="protocol-exclusion">Exclusion criteria (synced to AI Screening &amp; Manuscript)</label>
              <Textarea id="protocol-exclusion" rows={2} value={project.protocol.exclusionCriteria ?? ""}
                onChange={(e) => set({ protocol: { ...project.protocol, exclusionCriteria: e.target.value } })}
                placeholder="e.g. Animal/in-vitro studies, case reports, editorials, reviews without primary data" />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <label className="block text-xs font-medium" htmlFor="protocol-databases">Databases</label>
              <Input id="protocol-databases" value={project.protocol.databases}
                onChange={(e) => set({ protocol: { ...project.protocol, databases: e.target.value } })} />
            </div>
            <div>
              <label className="block text-xs font-medium" htmlFor="protocol-designs">Eligible study designs</label>
              <Input id="protocol-designs" value={project.protocol.studyDesigns ?? ""}
                placeholder="e.g. RCT, Cohort"
                onChange={(e) => set({ protocol: { ...project.protocol, studyDesigns: e.target.value } })} />
            </div>
            <div>
              <label className="block text-xs font-medium" htmlFor="protocol-registration">Registration (PROSPERO / OSF)</label>
              <Input id="protocol-registration" value={project.protocol.registration}
                onChange={(e) => set({ protocol: { ...project.protocol, registration: e.target.value } })}
                placeholder="PROSPERO CRD... or 'Not registered'" />
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
