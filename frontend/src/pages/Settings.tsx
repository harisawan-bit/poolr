import { useState } from "react";
import type { Project } from "../lib/project";
import { Card, Select } from "../components/ui";
import { TEMPLATES, type ProjectTemplate } from "../lib/templates";
import { isAnalyticsEnabled, setAnalyticsConsent, exportTelemetry, clearTelemetry } from "../lib/analytics";
import { getCrashLogs, clearCrashLogs } from "../lib/crashReporter";
import { useColorBlind } from "../lib/colorBlind";

export default function Settings({ project, onChange }: { project: Project; onChange: (p: Project) => void }) {
  const [fontSize, setFontSize] = useState(14);
  const [analytics, setAnalytics] = useState(isAnalyticsEnabled());
  const [crashLogs] = useState(getCrashLogs());
  const { mode: colorBlindMode, setMode: setColorBlindMode } = useColorBlind();

  const handleAnalyticsToggle = (enabled: boolean) => {
    setAnalytics(enabled);
    setAnalyticsConsent(enabled);
  };

  const applyTemplate = (template: ProjectTemplate) => {
    onChange({
      ...project,
      pico: { ...template.pico },
      protocol: {
        ...project.protocol,
        databases: template.databases,
        objective: project.protocol.objective || template.description,
      },
    });
  };

  return (
    <div className="space-y-3">
      <Card title="Appearance">
        <div className="space-y-3">
          <div>
            <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Font Size</div>
            <input type="range" min="10" max="20" value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} className="w-full" />
            <div className="mt-1 text-center" style={{ fontSize: `${fontSize}px` }}>
              Preview: The quick brown fox jumps over the lazy dog
            </div>
          </div>
          <div>
            <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Color Blindness Mode</div>
            <Select value={colorBlindMode} onChange={(e) => setColorBlindMode(e.target.value as any)}>
              <option value="none">None</option>
              <option value="protanopia">Protanopia (red-blind)</option>
              <option value="deuteranopia">Deuteranopia (green-blind)</option>
              <option value="tritanopia">Tritanopia (blue-blind)</option>
            </Select>
          </div>
        </div>
      </Card>

      <Card title="Project Templates">
        <p className="mb-3 text-[12px] text-[var(--color-text-muted)]">Apply a template to pre-fill PICO, databases, and search strategy.</p>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
          {TEMPLATES.map((t) => (
            <button key={t.id} className="rounded-lg border border-[var(--color-border)] p-3 text-left hover:border-[var(--color-accent)]" onClick={() => applyTemplate(t)}>
              <div className="text-[12px] font-semibold">{t.name}</div>
              <div className="text-[11px] text-[var(--color-text-muted)]">{t.description}</div>
            </button>
          ))}
        </div>
      </Card>

      <Card title="Privacy & Analytics">
        <div className="space-y-3">
          <label className="flex items-center justify-between">
            <span className="text-[12px]">Anonymous usage analytics (local only)</span>
            <input type="checkbox" checked={analytics} onChange={(e) => handleAnalyticsToggle(e.target.checked)} />
          </label>
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={() => prompt("Telemetry data:", exportTelemetry())}>Export telemetry</button>
            <button className="btn-ghost" onClick={() => { clearTelemetry(); alert("Telemetry cleared"); }}>Clear telemetry</button>
          </div>
        </div>
      </Card>

      <Card title="Crash Reports">
        <div className="space-y-2">
          <div className="text-[12px] text-[var(--color-text-muted)]">{crashLogs.length} crash logs stored locally</div>
          {crashLogs.length > 0 && (
            <div className="max-h-40 overflow-y-auto rounded border border-[var(--color-border)] p-2">
              {crashLogs.slice(0, 5).map((log, i) => (
                <div key={i} className="border-b border-[var(--color-border)] py-1 text-[11px]">
                  <div className="font-mono text-[var(--color-exclude)]">{log.message}</div>
                  <div className="text-[10px] text-[var(--color-text-muted)]">{log.timestamp}</div>
                </div>
              ))}
            </div>
          )}
          <button className="btn-ghost" onClick={() => { clearCrashLogs(); alert("Crash logs cleared"); }}>Clear crash logs</button>
        </div>
      </Card>
    </div>
  );
}
