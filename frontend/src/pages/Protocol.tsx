import type { Project } from "../lib/project";
import { Card, Input, Textarea, SectionLabel } from "../components/ui";

export default function Protocol({ project, onChange }: { project: Project; onChange: (p: Project) => void }) {
  const set = (patch: Partial<Project>) => onChange({ ...project, ...patch });

  return (
    <div className="space-y-3">
      <Card title="Review title">
        <Input
          value={project.metadata.title ?? ""}
          placeholder="e.g. Effect of X on Y in Z populations"
          onChange={(e) => set({ metadata: { ...project.metadata, title: e.target.value } })}
        />
      </Card>

      <Card title="PICO definition">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <SectionLabel>Population</SectionLabel>
            <Textarea rows={3} value={project.pico.population}
              onChange={(e) => set({ pico: { ...project.pico, population: e.target.value } })}
              placeholder="Participants / patients" />
          </div>
          <div>
            <SectionLabel>Intervention</SectionLabel>
            <Textarea rows={3} value={project.pico.intervention}
              onChange={(e) => set({ pico: { ...project.pico, intervention: e.target.value } })}
              placeholder="Experimental exposure / treatment" />
          </div>
          <div>
            <SectionLabel>Comparator</SectionLabel>
            <Textarea rows={3} value={project.pico.comparator}
              onChange={(e) => set({ pico: { ...project.pico, comparator: e.target.value } })}
              placeholder="Control / standard of care" />
          </div>
          <div>
            <SectionLabel>Outcomes</SectionLabel>
            <Textarea rows={3} value={project.pico.outcomes}
              onChange={(e) => set({ pico: { ...project.pico, outcomes: e.target.value } })}
              placeholder="Primary & secondary outcomes" />
          </div>
        </div>
      </Card>

      <Card title="Protocol details">
        <div className="space-y-3">
          <div>
            <SectionLabel>Objective</SectionLabel>
            <Textarea rows={2} value={project.protocol.objective}
              onChange={(e) => set({ protocol: { ...project.protocol, objective: e.target.value } })}
              placeholder="State the primary research question." />
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <SectionLabel>Databases</SectionLabel>
              <Input value={project.protocol.databases}
                onChange={(e) => set({ protocol: { ...project.protocol, databases: e.target.value } })} />
            </div>
            <div>
              <SectionLabel>Registration</SectionLabel>
              <Input value={project.protocol.registration}
                onChange={(e) => set({ protocol: { ...project.protocol, registration: e.target.value } })}
                placeholder="PROSPERO ID or 'Not registered'" />
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
