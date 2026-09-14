import { useState, useMemo } from "react";
import type { Project } from "../lib/project";
import { Card, Button, EmptyState } from "../components/ui";
import { postJson } from "../lib/api";
import { Activity, BarChart3, GitBranch, Grid3X3, TrendingUp, Zap } from "lucide-react";

const F = (n: number, d = 3) => n.toFixed(d);

export default function EnginePage({ project, title, endpoint, renderInputs, renderResult }: {
  project: Project;
  title: string;
  endpoint: string;
  renderInputs: (project: Project, setProject: (p: Project) => void, busy: boolean, setBusy: (b: boolean) => void, err: string | null, setErr: (e: string | null) => void, result: any, setResult: (r: any) => void) => React.ReactNode;
  renderResult: (result: any) => React.ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  return (
    <div className="space-y-4">
      <Card title={title}>
        {renderInputs(project, () => {}, busy, setBusy, err, setErr, result, setResult)}
      </Card>
      {result && <Card title="Results">{renderResult(result)}</Card>}
    </div>
  );
}
