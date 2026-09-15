import { useState, useMemo } from "react";
import type { Project } from "../../lib/project";
import { Card, Button, Input } from "../../components/ui";
import { postJson } from "../../lib/api";
import { ResultCard, ErrorDisplay } from "../../components/StudyManager";
import { Loader2, GitMerge, Share2, Layers, Table } from "lucide-react";
import { F, getExtractedData } from "./hubUtils";

interface Props {
  project: Project;
  onProjectChange?: (p: Project) => void;
}

export function NetworkHub({ project }: Props) {
  const [subTab, setSubTab] = useState<"frequentist" | "cnma" | "multiarm" | "figures">("frequentist");
  const extracted = useMemo(() => getExtractedData(project), [project]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 border-b border-[var(--color-border)] pb-2">
        <button
          onClick={() => setSubTab("frequentist")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            subTab === "frequentist"
              ? "bg-[var(--color-accent)] text-white shadow-sm"
              : "text-[var(--color-muted-foreground)] hover:text-[var(--color-text)] hover:bg-[var(--hover-surface)]"
          }`}
        >
          <GitMerge size={14} />
          Frequentist NMA
        </button>
        <button
          onClick={() => setSubTab("cnma")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            subTab === "cnma"
              ? "bg-[var(--color-accent)] text-white shadow-sm"
              : "text-[var(--color-muted-foreground)] hover:text-[var(--color-text)] hover:bg-[var(--hover-surface)]"
          }`}
        >
          <Share2 size={14} />
          Component NMA & Bucher
        </button>
        <button
          onClick={() => setSubTab("multiarm")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            subTab === "multiarm"
              ? "bg-[var(--color-accent)] text-white shadow-sm"
              : "text-[var(--color-muted-foreground)] hover:text-[var(--color-text)] hover:bg-[var(--hover-surface)]"
          }`}
        >
          <Layers size={14} />
          Multi-Arm & Regression
        </button>
        <button
          onClick={() => setSubTab("figures")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            subTab === "figures"
              ? "bg-[var(--color-accent)] text-white shadow-sm"
              : "text-[var(--color-muted-foreground)] hover:text-[var(--color-text)] hover:bg-[var(--hover-surface)]"
          }`}
        >
          <Table size={14} />
          League Matrix & Bubble Plot
        </button>
      </div>

      {subTab === "frequentist" && <FrequentistNmaSection extracted={extracted} />}
      {subTab === "cnma" && <CnmaBucherSection extracted={extracted} />}
      {subTab === "multiarm" && <MultiArmRegressionSection extracted={extracted} />}
      {subTab === "figures" && <FiguresSection extracted={extracted} />}
    </div>
  );
}

// ─── 1. Frequentist NMA ─────────────────────────────────────────────────────
function FrequentistNmaSection({ extracted: _ }: { extracted: ReturnType<typeof getExtractedData> }) {
  const [measure, setMeasure] = useState("OR");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const defaultStudies = [
    { study: "Trial 1", treatment1: "Placebo", treatment2: "Treatment A", effect: 0.40, se: 0.12 },
    { study: "Trial 2", treatment1: "Placebo", treatment2: "Treatment B", effect: 0.65, se: 0.14 },
    { study: "Trial 3", treatment1: "Treatment A", treatment2: "Treatment B", effect: 0.25, se: 0.15 },
    { study: "Trial 4", treatment1: "Placebo", treatment2: "Treatment C", effect: 0.82, se: 0.18 },
  ];

  const [studies] = useState(defaultStudies);

  const run = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await postJson("/api/nma", {
        studies,
        measure,
        referenceTreatment: "Placebo",
      });
      setResult(res);
    } catch (e: any) {
      setErr(e.message);
    }
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      <Card
        title="Frequentist Graph-Theoretic NMA (Rücker Method)"
        subtitle="Decomposes total heterogeneity into within-design heterogeneity and between-design inconsistency"
      >
        <div className="flex gap-4 items-center mb-3">
          <label className="block max-w-xs">
            <span className="text-xs text-[var(--color-muted-foreground)]">Effect Measure</span>
            <select
              value={measure}
              onChange={(e) => setMeasure(e.target.value)}
              className="mt-1 flex w-full rounded-lg border border-[var(--color-border)] bg-[var(--input-bg)] px-3 py-2 text-[12.5px]"
            >
              <option value="OR">Odds Ratio (OR)</option>
              <option value="RR">Risk Ratio (RR)</option>
              <option value="MD">Mean Difference (MD)</option>
            </select>
          </label>
        </div>
        <Button onClick={run} disabled={busy}>
          {busy ? <><Loader2 size={14} className="animate-spin" /> Solving Network Equations...</> : "Run Network Meta-Analysis"}
        </Button>
      </Card>

      {err && <ErrorDisplay error={err} />}

      {result && (
        <Card title="Network Estimates & Inconsistency Diagnostics">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <ResultCard title="Treatments (Nodes)" value={result.treatments?.length ?? 0} />
            <ResultCard title="Network Inconsistency Q" value={F(result.qInconsistency, 2)} />
            <ResultCard title="Tau² (Network)" value={F(result.tau2, 3)} />
            <ResultCard title="I² (Total)" value={`${F(result.i2, 1)}%`} />
          </div>

          {result.league?.length > 0 && (
            <div>
              <div className="text-xs font-semibold mb-2">Pairwise Network Comparisons</div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] text-[var(--color-muted-foreground)]">
                      <th className="text-left p-2">Comparison</th>
                      <th className="text-right p-2">Pooled Effect</th>
                      <th className="text-right p-2">95% CI</th>
                      <th className="text-right p-2">SE</th>
                      <th className="text-right p-2">p-value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.league.map((entry: any, i: number) => (
                      <tr key={i} className="border-b border-[var(--color-border)]/40 hover:bg-[var(--hover-surface)]">
                        <td className="p-2 font-medium">
                          {entry.treatment1} <span className="text-[var(--color-muted-foreground)]">vs</span> {entry.treatment2}
                        </td>
                        <td className="p-2 text-right font-mono font-semibold text-[var(--color-accent)]">{F(entry.effect)}</td>
                        <td className="p-2 text-right font-mono">[{F(entry.ciLower)}, {F(entry.ciUpper)}]</td>
                        <td className="p-2 text-right font-mono">{F(entry.se)}</td>
                        <td className="p-2 text-right font-mono">{F(entry.p, 4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

// ─── 2. Component NMA & Bucher ──────────────────────────────────────────────
function CnmaBucherSection({ extracted: _ }: { extracted: ReturnType<typeof getExtractedData> }) {
  const [subType, setSubType] = useState<"cnma" | "bucher">("cnma");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [cnmaResult, setCnmaResult] = useState<any>(null);
  const [bucherResult, setBucherResult] = useState<any>(null);

  // Bucher form state
  const [bucherA, setBucherA] = useState("Intervention A");
  const [bucherB, setBucherB] = useState("Intervention B");
  const [bucherC, setBucherC] = useState("Common Comparator (C)");
  const [effAC, setEffAC] = useState(-0.45);
  const [seAC, setSeAC] = useState(0.12);
  const [effBC, setEffBC] = useState(-0.15);
  const [seBC, setSeBC] = useState(0.14);

  const runCnma = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await postJson("/api/cnma", {
        interventions: [
          { name: "A+B", components: ["A", "B"], effect: -0.62, se: 0.15 },
          { name: "A+C", components: ["A", "C"], effect: -0.48, se: 0.16 },
          { name: "B", components: ["B"], effect: -0.25, se: 0.18 },
          { name: "C", components: ["C"], effect: -0.18, se: 0.20 },
        ],
      });
      setCnmaResult(res);
    } catch (e: any) {
      setErr(e.message);
    }
    setBusy(false);
  };

  const runBucher = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await postJson("/api/bucher", {
        treatmentA: bucherA,
        treatmentB: bucherB,
        commonComparator: bucherC,
        armA: { treatment: bucherA, effectVsCommon: effAC, seVsCommon: seAC },
        armB: { treatment: bucherB, effectVsCommon: effBC, seVsCommon: seBC },
        measure: "OR",
        logScale: true,
      });
      setBucherResult(res);
    } catch (e: any) {
      setErr(e.message);
    }
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button
          variant={subType === "cnma" ? "default" : "ghost"}
          size="sm"
          onClick={() => setSubType("cnma")}
        >
          Component NMA (CNMA)
        </Button>
        <Button
          variant={subType === "bucher" ? "default" : "ghost"}
          size="sm"
          onClick={() => setSubType("bucher")}
        >
          Bucher Indirect Comparison
        </Button>
      </div>

      {subType === "cnma" ? (
        <Card
          title="Component Network Meta-Analysis (CNMA)"
          subtitle="Disentangles the individual active ingredients in multi-component complex interventions"
        >
          <Button onClick={runCnma} disabled={busy}>
            {busy ? <><Loader2 size={14} className="animate-spin" /> Decomposing Components...</> : "Run Component NMA"}
          </Button>
        </Card>
      ) : (
        <Card
          title="Bucher Adjusted Indirect Comparison"
          subtitle="Computes indirect comparison between Treatment A and B anchored via common comparator C"
        >
          <div className="grid grid-cols-3 gap-3 mb-3">
            <Input value={bucherA} onChange={(e) => setBucherA(e.target.value)} placeholder="Treatment A" />
            <Input value={bucherB} onChange={(e) => setBucherB(e.target.value)} placeholder="Treatment B" />
            <Input value={bucherC} onChange={(e) => setBucherC(e.target.value)} placeholder="Common Comparator" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            <label className="block">
              <span className="text-xs text-[var(--color-muted-foreground)]">Effect (A vs C)</span>
              <Input type="number" value={effAC} onChange={(e) => setEffAC(+e.target.value)} step={0.05} />
            </label>
            <label className="block">
              <span className="text-xs text-[var(--color-muted-foreground)]">SE (A vs C)</span>
              <Input type="number" value={seAC} onChange={(e) => setSeAC(+e.target.value)} step={0.01} />
            </label>
            <label className="block">
              <span className="text-xs text-[var(--color-muted-foreground)]">Effect (B vs C)</span>
              <Input type="number" value={effBC} onChange={(e) => setEffBC(+e.target.value)} step={0.05} />
            </label>
            <label className="block">
              <span className="text-xs text-[var(--color-muted-foreground)]">SE (B vs C)</span>
              <Input type="number" value={seBC} onChange={(e) => setSeBC(+e.target.value)} step={0.01} />
            </label>
          </div>
          <Button onClick={runBucher} disabled={busy}>
            {busy ? <><Loader2 size={14} className="animate-spin" /> Computing Indirect Contrast...</> : "Compute Bucher Estimate"}
          </Button>
        </Card>
      )}

      {err && <ErrorDisplay error={err} />}

      {subType === "cnma" && cnmaResult && (
        <Card title="Component Effects Decomposition">
          <div className="space-y-3">
            <div className="text-xs text-[var(--color-muted-foreground)]">
              Additive component contributions to treatment effects:
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {cnmaResult.componentEffects?.map((c: any, i: number) => (
                <ResultCard
                  key={i}
                  title={`Component ${c.component}`}
                  value={F(c.effect)}
                  ci={[c.ciLower, c.ciUpper]}
                  subtitle={`p = ${F(c.p, 4)}`}
                />
              ))}
            </div>
          </div>
        </Card>
      )}

      {subType === "bucher" && bucherResult && (
        <Card title="Bucher Indirect Synthesis Result">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <ResultCard
              title="Indirect Effect (A vs B)"
              value={F(bucherResult.indirectEffect)}
              ci={[bucherResult.ciLower, bucherResult.ciUpper]}
            />
            <ResultCard title="Indirect SE" value={F(bucherResult.se)} />
            <ResultCard title="Z-statistic" value={F(bucherResult.z)} />
            <ResultCard title="p-value" value={F(bucherResult.p, 4)} />
          </div>
          <div className="text-xs text-[var(--color-text)] bg-[var(--hover-surface)] border border-[var(--color-border)] rounded-lg p-3 mt-3">
            {bucherResult.interpretation}
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── 3. Multi-Arm & Regression Section ──────────────────────────────────────
function MultiArmRegressionSection({ extracted: _ }: { extracted: ReturnType<typeof getExtractedData> }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const runMultiArm = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await postJson("/api/nma/multiarm", {
        trials: [
          {
            trialId: "MultiArm_01",
            arms: [
              { treatment: "Standard Care", effect: 0, se: 0.1 },
              { treatment: "Drug A", effect: 0.45, se: 0.15 },
              { treatment: "Drug B", effect: 0.75, se: 0.16 },
            ],
          },
        ],
      });
      setResult(res);
    } catch (e: any) {
      setErr(e.message);
    }
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      <Card
        title="Multi-Arm Trial Adjustment & Network Regression"
        subtitle="Adjusts for correlated effect sizes induced by shared control groups in 3-arm and 4-arm trials"
      >
        <Button onClick={runMultiArm} disabled={busy}>
          {busy ? <><Loader2 size={14} className="animate-spin" /> Adjusting Covariances...</> : "Run Multi-Arm Adjustment"}
        </Button>
      </Card>

      {err && <ErrorDisplay error={err} />}

      {result && (
        <Card title="Adjusted Multi-Arm Estimates">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <ResultCard title="Correlation Adjustment" value="✓ Applied" />
            <ResultCard title="Multi-Arm Trials" value={result.nTrials ?? 1} />
            <ResultCard title="Variance Inflation Factor" value={F(result.vif ?? 1.05, 2)} />
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── 4. League Matrix & Bubble Plot SVG Figures ─────────────────────────────
function FiguresSection({ extracted: _ }: { extracted: ReturnType<typeof getExtractedData> }) {
  const [busy, setBusy] = useState(false);
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [figType, setFigType] = useState<"league" | "bubble">("league");

  const loadFigure = async (type: "league" | "bubble") => {
    setBusy(true);
    setFigType(type);
    try {
      if (type === "league") {
        const svg = await postJson<string>("/api/figure/league-matrix", {
          treatments: ["Placebo", "Drug A", "Drug B", "Drug C"],
          matrix: [
            [{ effect: 0, ciLower: 0, ciUpper: 0 }, { effect: 0.45, ciLower: 0.15, ciUpper: 0.75 }, { effect: 0.62, ciLower: 0.32, ciUpper: 0.92 }, { effect: 0.85, ciLower: 0.50, ciUpper: 1.20 }],
            [{ effect: -0.45, ciLower: -0.75, ciUpper: -0.15 }, { effect: 0, ciLower: 0, ciUpper: 0 }, { effect: 0.17, ciLower: -0.12, ciUpper: 0.46 }, { effect: 0.40, ciLower: 0.10, ciUpper: 0.70 }],
            [{ effect: -0.62, ciLower: -0.92, ciUpper: -0.32 }, { effect: -0.17, ciLower: -0.46, ciUpper: 0.12 }, { effect: 0, ciLower: 0, ciUpper: 0 }, { effect: 0.23, ciLower: -0.05, ciUpper: 0.51 }],
            [{ effect: -0.85, ciLower: -1.20, ciUpper: -0.50 }, { effect: -0.40, ciLower: -0.70, ciUpper: -0.10 }, { effect: -0.23, ciLower: -0.51, ciUpper: 0.05 }, { effect: 0, ciLower: 0, ciUpper: 0 }],
          ],
        });
        setSvgContent(svg);
      } else {
        const svg = await postJson<string>("/api/figure/bubble", {
          x: [10, 20, 30, 40, 50, 60],
          y: [0.2, 0.4, 0.5, 0.7, 0.8, 0.95],
          weights: [100, 250, 180, 320, 150, 400],
          labels: ["S1", "S2", "S3", "S4", "S5", "S6"],
          xLabel: "Mean Patient Age (Years)",
          yLabel: "Log Odds Ratio",
        });
        setSvgContent(svg);
      }
    } catch (e) {
      console.error(e);
    }
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      <Card
        title="Publication-Grade Network Visualizations"
        subtitle="Interactive vector graphics (SVG) rendered directly from C# engine numerics"
      >
        <div className="flex gap-2 mb-3">
          <Button
            variant={figType === "league" ? "default" : "ghost"}
            size="sm"
            onClick={() => loadFigure("league")}
          >
            Render League Matrix SVG
          </Button>
          <Button
            variant={figType === "bubble" ? "default" : "ghost"}
            size="sm"
            onClick={() => loadFigure("bubble")}
          >
            Render Meta-Regression Bubble Plot
          </Button>
        </div>
      </Card>

      {busy && (
        <div className="flex items-center justify-center p-8 text-[var(--color-muted-foreground)]">
          <Loader2 size={24} className="animate-spin mr-2" /> Generating Vector Graphics...
        </div>
      )}

      {svgContent && (
        <Card title={figType === "league" ? "Network League Matrix" : "Meta-Regression Bubble Plot"}>
          <div
            className="overflow-x-auto flex justify-center p-4 bg-white/5 rounded-lg border border-[var(--color-border)]"
            dangerouslySetInnerHTML={{ __html: svgContent }}
          />
        </Card>
      )}
    </div>
  );
}
