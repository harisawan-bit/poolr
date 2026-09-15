import { useState, useMemo } from "react";
import type { Project } from "../../lib/project";
import { Card, Button } from "../../components/ui";
import { postJson } from "../../lib/api";
import { ErrorDisplay } from "../../components/StudyManager";
import { Loader2, Download, Copy, Check, PieChart, ScatterChart, BarChart3 } from "lucide-react";
import { getExtractedData, downloadFile } from "./hubUtils";

interface Props {
  project: Project;
  onProjectChange?: (p: Project) => void;
}

export function FiguresHub({ project }: Props) {
  const [subTab, setSubTab] = useState<"galbraith" | "labbe" | "baujat" | "contour" | "forest">("galbraith");
  const extracted = useMemo(() => getExtractedData(project), [project]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--color-border)] pb-2">
        <button
          onClick={() => setSubTab("galbraith")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            subTab === "galbraith"
              ? "bg-[var(--color-accent)] text-white shadow-sm"
              : "text-[var(--color-muted-foreground)] hover:text-[var(--color-text)] hover:bg-[var(--hover-surface)]"
          }`}
        >
          <ScatterChart size={14} />
          Galbraith Radial Plot
        </button>
        <button
          onClick={() => setSubTab("labbe")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            subTab === "labbe"
              ? "bg-[var(--color-accent)] text-white shadow-sm"
              : "text-[var(--color-muted-foreground)] hover:text-[var(--color-text)] hover:bg-[var(--hover-surface)]"
          }`}
        >
          <PieChart size={14} />
          L'Abbé Plot (Binary)
        </button>
        <button
          onClick={() => setSubTab("baujat")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            subTab === "baujat"
              ? "bg-[var(--color-accent)] text-white shadow-sm"
              : "text-[var(--color-muted-foreground)] hover:text-[var(--color-text)] hover:bg-[var(--hover-surface)]"
          }`}
        >
          <BarChart3 size={14} />
          Baujat Plot (Heterogeneity vs Influence)
        </button>
        <button
          onClick={() => setSubTab("contour")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            subTab === "contour"
              ? "bg-[var(--color-accent)] text-white shadow-sm"
              : "text-[var(--color-muted-foreground)] hover:text-[var(--color-text)] hover:bg-[var(--hover-surface)]"
          }`}
        >
          <ScatterChart size={14} />
          Contour-Enhanced Funnel
        </button>
        <button
          onClick={() => setSubTab("forest")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            subTab === "forest"
              ? "bg-[var(--color-accent)] text-white shadow-sm"
              : "text-[var(--color-muted-foreground)] hover:text-[var(--color-text)] hover:bg-[var(--hover-surface)]"
          }`}
        >
          <BarChart3 size={14} />
          Standard Forest & Funnel
        </button>
      </div>

      {subTab === "galbraith" && <GalbraithSection extracted={extracted} />}
      {subTab === "labbe" && <LabbeSection extracted={extracted} />}
      {subTab === "baujat" && <BaujatSection extracted={extracted} />}
      {subTab === "contour" && <ContourFunnelSection extracted={extracted} />}
      {subTab === "forest" && <StandardForestSection extracted={extracted} />}
    </div>
  );
}

// ─── SVG Container Component with Copy & Download ───────────────────────────
function SvgViewer({ svg, filename }: { svg: string; filename: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(svg);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    downloadFile(filename, svg, "image/svg+xml");
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={handleCopy}>
          {copied ? <><Check size={12} className="text-green-400" /> Copied SVG</> : <><Copy size={12} /> Copy SVG</>}
        </Button>
        <Button size="sm" onClick={handleDownload}>
          <Download size={12} /> Download SVG
        </Button>
      </div>
      <div
        className="p-4 bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl flex items-center justify-center overflow-x-auto min-h-[320px]"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  );
}

// ─── 1. Galbraith Radial Plot ────────────────────────────────────────────────
function GalbraithSection({ extracted }: { extracted: ReturnType<typeof getExtractedData> }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [svg, setSvg] = useState<string | null>(null);

  const studies = extracted.effects.length > 0 ? extracted.effects.map((e, i) => ({
    name: extracted.names[i],
    effect: e,
    se: extracted.standardErrors[i],
  })) : [
    { name: "Study A", effect: 0.25, se: 0.10 },
    { name: "Study B", effect: 0.45, se: 0.12 },
    { name: "Study C", effect: 0.15, se: 0.08 },
    { name: "Study D", effect: 0.90, se: 0.18 },
    { name: "Study E", effect: 0.35, se: 0.11 },
  ];

  const run = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("http://127.0.0.1:5180/api/figure/galbraith", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studies }),
      });
      if (!res.ok) throw new Error(await res.text());
      setSvg(await res.text());
    } catch (e: any) {
      setErr(e.message);
    }
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      <Card
        title="Galbraith Radial Plot"
        subtitle="Z-scores plotted against precision (1/SE) with ±2 standard error bounds to identify outliers"
      >
        <div className="text-xs text-[var(--color-muted-foreground)] mb-3">
          Studies outside the ±2 SE confidence band contribute disproportionately to between-study heterogeneity.
        </div>
        <Button onClick={run} disabled={busy}>
          {busy ? <><Loader2 size={14} className="animate-spin" /> Rendering Radial Plot...</> : "Generate Galbraith Plot"}
        </Button>
      </Card>

      {err && <ErrorDisplay error={err} />}
      {svg && <SvgViewer svg={svg} filename="galbraith_radial_plot.svg" />}
    </div>
  );
}

// ─── 2. L'Abbé Plot ─────────────────────────────────────────────────────────
function LabbeSection({ extracted }: { extracted: ReturnType<typeof getExtractedData> }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [svg, setSvg] = useState<string | null>(null);

  const arms = extracted.binaryData.length > 0 ? extracted.binaryData.map(b => ({
    name: b.study,
    a: b.ai,
    n1: b.n1i,
    c: b.ci,
    n2: b.n2i,
  })) : [
    { name: "Trial 1", a: 25, n1: 100, c: 15, n2: 100 },
    { name: "Trial 2", a: 40, n1: 150, c: 20, n2: 150 },
    { name: "Trial 3", a: 55, n1: 200, c: 30, n2: 200 },
    { name: "Trial 4", a: 18, n1: 80, c: 10, n2: 80 },
  ];

  const run = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("http://127.0.0.1:5180/api/figure/labbe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(arms),
      });
      if (!res.ok) throw new Error(await res.text());
      setSvg(await res.text());
    } catch (e: any) {
      setErr(e.message);
    }
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      <Card
        title="L'Abbé Plot for Binary Outcomes"
        subtitle="Event rate in intervention group plotted against event rate in control group with line of equality"
      >
        <div className="text-xs text-[var(--color-muted-foreground)] mb-3">
          Points above the diagonal indicate beneficial intervention effects; circle sizes scale with study sample size.
        </div>
        <Button onClick={run} disabled={busy}>
          {busy ? <><Loader2 size={14} className="animate-spin" /> Rendering L'Abbé Plot...</> : "Generate L'Abbé Plot"}
        </Button>
      </Card>

      {err && <ErrorDisplay error={err} />}
      {svg && <SvgViewer svg={svg} filename="labbe_plot.svg" />}
    </div>
  );
}

// ─── 3. Baujat Plot ─────────────────────────────────────────────────────────
function BaujatSection({ extracted }: { extracted: ReturnType<typeof getExtractedData> }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [svg, setSvg] = useState<string | null>(null);

  const studies = extracted.effects.length > 0 ? extracted.effects.map((e, i) => ({
    name: extracted.names[i],
    effect: e,
    se: extracted.standardErrors[i],
  })) : [
    { name: "Study 1", effect: 0.30, se: 0.10 },
    { name: "Study 2", effect: 0.40, se: 0.12 },
    { name: "Study 3", effect: 0.85, se: 0.15 },
    { name: "Study 4", effect: 0.35, se: 0.09 },
  ];

  const run = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("http://127.0.0.1:5180/api/figure/baujat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studies }),
      });
      if (!res.ok) throw new Error(await res.text());
      setSvg(await res.text());
    } catch (e: any) {
      setErr(e.message);
    }
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      <Card
        title="Baujat Plot"
        subtitle="Diagnostic plot assessing overall heterogeneity contribution vs influence on the pooled estimate"
      >
        <div className="text-xs text-[var(--color-muted-foreground)] mb-3">
          Studies in the upper right quadrant contribute heavily to Cochran's Q and shift the pooled result.
        </div>
        <Button onClick={run} disabled={busy}>
          {busy ? <><Loader2 size={14} className="animate-spin" /> Rendering Baujat Plot...</> : "Generate Baujat Plot"}
        </Button>
      </Card>

      {err && <ErrorDisplay error={err} />}
      {svg && <SvgViewer svg={svg} filename="baujat_plot.svg" />}
    </div>
  );
}

// ─── 4. Contour-Enhanced Funnel Plot ─────────────────────────────────────────
function ContourFunnelSection({ extracted }: { extracted: ReturnType<typeof getExtractedData> }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [svg, setSvg] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setErr(null);
    try {
      // First get meta response
      const metaResp = await postJson("/api/meta", {
        data: extracted.effects.length > 0 ? extracted.effects.map((e, i) => ({
          study: extracted.names[i],
          effect_size: e,
          effect_se: extracted.standardErrors[i],
        })) : [
          { study: "Trial 1", effect_size: 0.35, effect_se: 0.12 },
          { study: "Trial 2", effect_size: 0.45, effect_se: 0.15 },
          { study: "Trial 3", effect_size: 0.20, effect_se: 0.08 },
          { study: "Trial 4", effect_size: 0.60, effect_se: 0.22 },
          { study: "Trial 5", effect_size: 0.30, effect_se: 0.14 },
        ],
        model: "random",
        measure: "OR",
      });

      const res = await fetch("http://127.0.0.1:5180/api/figure/funnel_contour", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(metaResp),
      });
      if (!res.ok) throw new Error(await res.text());
      setSvg(await res.text());
    } catch (e: any) {
      setErr(e.message);
    }
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      <Card
        title="Contour-Enhanced Funnel Plot"
        subtitle="Funnel plot overlaid with statistical significance contours (p < 0.01, p < 0.05, p < 0.10)"
      >
        <div className="text-xs text-[var(--color-muted-foreground)] mb-3">
          If missing studies fall into areas of statistical non-significance (p &gt; 0.05), publication bias is plausible.
        </div>
        <Button onClick={run} disabled={busy}>
          {busy ? <><Loader2 size={14} className="animate-spin" /> Rendering Contour Funnel...</> : "Generate Contour Funnel Plot"}
        </Button>
      </Card>

      {err && <ErrorDisplay error={err} />}
      {svg && <SvgViewer svg={svg} filename="contour_funnel_plot.svg" />}
    </div>
  );
}

// ─── 5. Standard Forest & Funnel Plots ───────────────────────────────────────
function StandardForestSection({ extracted }: { extracted: ReturnType<typeof getExtractedData> }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [forestSvg, setForestSvg] = useState<string | null>(null);
  const [funnelSvg, setFunnelSvg] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setErr(null);
    try {
      const metaResp = await postJson("/api/meta", {
        data: extracted.effects.length > 0 ? extracted.effects.map((e, i) => ({
          study: extracted.names[i],
          effect_size: e,
          effect_se: extracted.standardErrors[i],
        })) : [
          { study: "Study 1", effect_size: 0.35, effect_se: 0.12 },
          { study: "Study 2", effect_size: 0.50, effect_se: 0.14 },
          { study: "Study 3", effect_size: 0.22, effect_se: 0.09 },
          { study: "Study 4", effect_size: 0.42, effect_se: 0.11 },
        ],
        model: "random",
        measure: "OR",
      });

      const [res1, res2] = await Promise.all([
        fetch("http://127.0.0.1:5180/api/figure/forest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(metaResp),
        }),
        fetch("http://127.0.0.1:5180/api/figure/funnel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(metaResp),
        }),
      ]);

      if (res1.ok) setForestSvg(await res1.text());
      if (res2.ok) setFunnelSvg(await res2.text());
    } catch (e: any) {
      setErr(e.message);
    }
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      <Card
        title="Standard High-Resolution Vector Figures"
        subtitle="Direct publication-grade SVG generation for Forest and Classic Funnel plots"
      >
        <Button onClick={run} disabled={busy}>
          {busy ? <><Loader2 size={14} className="animate-spin" /> Rendering Vector Figures...</> : "Generate Forest & Funnel Plots"}
        </Button>
      </Card>

      {err && <ErrorDisplay error={err} />}

      {forestSvg && (
        <Card title="Publication Forest Plot (Vector SVG)">
          <SvgViewer svg={forestSvg} filename="publication_forest_plot.svg" />
        </Card>
      )}

      {funnelSvg && (
        <Card title="Classic Funnel Plot (Vector SVG)">
          <SvgViewer svg={funnelSvg} filename="classic_funnel_plot.svg" />
        </Card>
      )}
    </div>
  );
}
