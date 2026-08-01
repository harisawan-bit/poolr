import { useEffect, useRef, useState } from "react";
import {
  engineHealth,
  openProjectDialog,
  exportProject,
  newProject,
  saveProject,
} from "./lib/api";

const NAV = [
  { key: "dashboard", label: "Dashboard", icon: "▦" },
  { key: "protocol", label: "Protocol", icon: "✎" },
  { key: "search", label: "Search", icon: "⌕" },
  { key: "screening", label: "Screening", icon: "☑" },
  { key: "extraction", label: "Extraction", icon: "▤" },
  { key: "rob", label: "Risk of Bias", icon: "⚠" },
  { key: "meta", label: "Meta-Analysis", icon: "📈" },
  { key: "prisma", label: "PRISMA", icon: "◫" },
] as const;

type PageKey = (typeof NAV)[number]["key"];

const TITLES: Record<PageKey, string> = {
  dashboard: "Dashboard",
  protocol: "Protocol / PICO Definition",
  search: "Search Strategy Builder",
  screening: "Screening",
  extraction: "Data Extraction",
  rob: "Risk of Bias Assessment",
  meta: "Meta-Analysis",
  prisma: "PRISMA 2020",
};

function LogoMark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-label="poolr">
      <circle cx="10" cy="9" r="5.2" stroke="var(--color-accent)" strokeWidth="2.4" />
      <path d="M10 14.2V22" stroke="var(--color-accent)" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

/* Animated random floating line field (unchanged from prior shell). */
type Line = { x: number; y: number; depth: number; vx: number; vy: number; pts: { x: number; y: number }[] };
function useLineField(ref: React.RefObject<HTMLCanvasElement | null>) {
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0; let w = 0; let h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let lines: Line[] = [];
    let seed = 1337;
    const rand = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
    const makeCurve = (depth: number) => {
      const span = Math.max(w, h) * (1.1 + depth * 0.6);
      const segs = 14 + Math.floor(rand() * 8);
      const startX = rand() * w, startY = rand() * h;
      const ang = rand() * Math.PI * 2;
      let x = startX, y = startY; const dx = Math.cos(ang), dy = Math.sin(ang);
      const step = span / segs; const pts: { x: number; y: number }[] = [];
      for (let i = 0; i <= segs; i++) {
        const wobble = (rand() - 0.5) * 1.1; const a = Math.atan2(dy, dx) + wobble;
        x += Math.cos(a) * step; y += Math.sin(a) * step; pts.push({ x, y });
      }
      return pts;
    };
    const build = () => {
      w = window.innerWidth; h = window.innerHeight;
      canvas.width = Math.floor(w * dpr); canvas.height = Math.floor(h * dpr);
      canvas.style.width = w + "px"; canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round((w * h) / 5200);
      lines = Array.from({ length: count }, () => {
        const depth = Math.pow(rand(), 1.5);
        return { x: 0, y: 0, depth, vx: (rand() - 0.5) * (0.1 + depth * 0.5), vy: (rand() - 0.5) * (0.1 + depth * 0.5), pts: makeCurve(depth) };
      });
    };
    const drawCurve = (pts: { x: number; y: number }[], ox: number, oy: number) => {
      ctx!.beginPath(); ctx!.moveTo(pts[0].x + ox, pts[0].y + oy);
      for (let i = 1; i < pts.length - 1; i++) {
        const mx = (pts[i].x + pts[i + 1].x) / 2 + ox, my = (pts[i].y + pts[i + 1].y) / 2 + oy;
        ctx!.quadraticCurveTo(pts[i].x + ox, pts[i].y + oy, mx, my);
      }
      const n = pts.length - 1; ctx!.lineTo(pts[n].x + ox, pts[n].y + oy); ctx!.stroke();
    };
    const draw = () => {
      ctx!.clearRect(0, 0, w, h); ctx!.lineCap = "round"; ctx!.lineJoin = "round";
      for (const l of lines) {
        l.x += l.vx; l.y += l.vy; const span = Math.max(w, h) * 1.8;
        if (l.x < -span) l.x = span; if (l.x > span) l.x = -span;
        if (l.y < -span) l.y = span; if (l.y > span) l.y = -span;
        const alpha = 0.01 + l.depth * 0.05;
        ctx!.strokeStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
        ctx!.lineWidth = 0.25 + l.depth * 0.55; drawCurve(l.pts, l.x, l.y);
      }
      raf = requestAnimationFrame(draw);
    };
    build(); draw(); window.addEventListener("resize", build);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", build); };
  }, [ref]);
}

export default function App() {
  const [page, setPage] = useState<PageKey>("dashboard");
  const [connected, setConnected] = useState<boolean | null>(null);
  const [collapsed, setCollapsed] = useState(typeof window !== "undefined" && window.innerWidth < 820);
  const [project, setProject] = useState<Record<string, unknown> | null>(null);
  const [projectPath, setProjectPath] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [busy, setBusy] = useState(false);
  const linefieldRef = useRef<HTMLCanvasElement | null>(null);

  useLineField(linefieldRef);

  useEffect(() => {
    let alive = true;
    engineHealth().then((ok) => alive && setConnected(ok));
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    const onResize = () => setCollapsed(window.innerWidth < 820);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const handleOpen = async () => {
    setBusy(true);
    try {
      const res = await openProjectDialog();
      if (res.data) { setProject(res.data as Record<string, unknown>); setProjectPath(res.path); setSaveState("saved"); }
    } catch (e) {
      console.error(e); setSaveState("error");
    } finally { setBusy(false); }
  };

  const handleNew = async () => {
    const p = newProject();
    setProject(p); setSaveState("idle");
    // Auto-save into the engine store (no file picker in browser/dev).
    try {
      const saved = await saveProject(projectPath ?? "poolr.json", p);
      setProjectPath(saved); setSaveState("saved");
    } catch { setSaveState("error"); }
  };

  const handleSave = async () => {
    if (!project) return;
    setSaveState("saving");
    try {
      const saved = await saveProject(projectPath ?? "poolr.json", project);
      setProjectPath(saved); setSaveState("saved");
    } catch { setSaveState("error"); }
  };

  const handleExport = async () => {
    if (!project) return;
    setBusy(true);
    try { await exportProject(project, "docx"); } catch (e) { console.error(e); }
    finally { setBusy(false); }
  };

  // ---- Dashboard KPIs derived from the live project ----
  const meta = (project?.["meta"] as any)?.results;
  const studies = ((project?.["extraction"] as any)?.studies) ?? [];
  const robCount = ((project?.["rob"] as any)?.assessments)?.length ?? 0;
  const kpis = [
    { k: "Studies", v: String(studies.length) },
    { k: "Pooled effect", v: meta ? (meta.pooled?.effect ?? "—").toFixed(2) : "—" },
    { k: "I²", v: meta ? `${(meta.heterogeneity?.i2 ?? 0).toFixed(0)}%` : "—" },
    { k: "RoB done", v: String(robCount) },
  ];

  const saveLabel =
    saveState === "saving" ? "saving…" : saveState === "saved" ? "saved" : saveState === "error" ? "save error" : "unsaved";

  return (
    <div className="relative z-10 flex h-full w-full overflow-hidden text-[#e6e7ea]">
      <canvas ref={linefieldRef} className="linefield" aria-hidden="true" />

      <aside className={`glass flex flex-col border-r border-white/[0.07] transition-[width] duration-150 ${collapsed ? "w-[56px]" : "w-52"}`}>
        <div className={`flex items-center gap-2 py-3.5 ${collapsed ? "justify-center px-0" : "px-4"}`}>
          <LogoMark size={20} />
          {!collapsed && <span className="font-sans text-[15px] font-semibold tracking-tight">poolr</span>}
        </div>
        <nav className={`flex flex-1 flex-col gap-0.5 ${collapsed ? "px-1.5" : "px-2.5"} py-1`}>
          {NAV.map((item) => {
            const active = item.key === page;
            return (
              <button
                key={item.key}
                title={collapsed ? item.label : undefined}
                onClick={() => setPage(item.key)}
                className={`relative flex items-center gap-2.5 rounded-[3px] px-2.5 py-1.5 text-left text-[12.5px] transition-colors ${active ? "bg-white/[0.06] font-sans font-semibold text-[#e6e7ea]" : "text-[#8b8d96] hover:bg-white/[0.03] hover:text-[#e6e7ea]"} ${collapsed ? "justify-center" : ""}`}
              >
                {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full bg-[var(--color-accent)]" />}
                <span className={`text-center text-[14px] ${collapsed ? "" : "w-4"}`}>{item.icon}</span>
                {!collapsed && item.label}
              </button>
            );
          })}
        </nav>
        <div className={`py-2.5 text-[10.5px] text-[#8b8d96] ${collapsed ? "text-center px-1" : "px-4"}`}>
          {collapsed ? "v0.4.0" : `v0.4.0 · ${connected === null ? "connecting…" : connected ? "online" : "offline"}`}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="glass flex items-center justify-between border-b border-white/[0.07] px-4 py-2">
          <div>
            <h1 className="text-[16px] font-semibold">{TITLES[page]}</h1>
            <p className="text-[10.5px] text-[#8b8d96]">Systematic review &amp; meta-analysis</p>
          </div>
          <div className="flex gap-1.5">
            <button className="btn-ghost" disabled={busy} onClick={handleOpen}>Open</button>
            <button className="btn-ghost" disabled={busy} onClick={handleNew}>New</button>
            <button className="btn-ghost" disabled={!project} onClick={handleSave}>Save</button>
            <button className="btn-primary" disabled={!project || busy} onClick={handleExport}>Export</button>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4">
          {page === "dashboard" && (
            <div className="card p-4">
              <h2 className="mb-1.5 text-[14px] font-semibold">Dashboard</h2>
              <p className="text-[12.5px] text-[#8b8d96] leading-relaxed">
                {project ? (
                  <>Loaded <span className="text-[#e6e7ea]">{projectPath ?? "untitled project"}</span>. {studies.length} study(ies) extracted.</>
                ) : (
                  <>No project loaded. Use <span className="text-[#e6e7ea]">Open</span> to load a <code>poolr.json</code>, or <span className="text-[#e6e7ea]">New</span> to start one.</>
                )}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {kpis.map((kpi) => (
                  <div key={kpi.k} className="card p-2.5">
                    <div className="text-[18px] font-semibold">{kpi.v}</div>
                    <div className="text-[10.5px] text-[#8b8d96]">{kpi.k}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {page !== "dashboard" && (
            <div className="card p-4">
              <h2 className="mb-1.5 text-[14px] font-semibold">{TITLES[page]}</h2>
              <p className="text-[12.5px] text-[#8b8d96] leading-relaxed">
                This panel is part of the Phase D page build. The shell (sidebar, header,
                project open/save/export, engine bridge) is live in Phase C; page content
                for <span className="text-[#e6e7ea]">{TITLES[page]}</span> arrives in Phase D.
              </p>
            </div>
          )}
        </main>

        <footer className="glass flex items-center justify-between border-t border-white/[0.07] px-4 py-1 text-[10.5px] text-[#8b8d96]">
          <span>poolr v0.4.0 · systematic review &amp; meta-analysis</span>
          <span className="flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${saveState === "error" ? "bg-[#f05252]" : saveState === "saved" ? "bg-[#3fb950]" : "bg-[#8b8d96]"}`} />
            {saveLabel}
          </span>
        </footer>

        <div className="border-t border-white/[0.06] bg-[#07080b] px-4 py-2.5 text-[10.5px] leading-relaxed text-[#8b8d96]">
          <p className="max-w-[80ch]">
            poolr helps researchers plan, screen, and synthesize evidence into a
            defensible meta-analysis. Always verify outputs against your protocol and
            preregister before analysis. For research use — not a substitute for
            clinical judgment.
          </p>
          <p className="mt-1 text-[#b9bbc2]">
            Developed by <span className="font-sans font-semibold text-[#e6e7ea]">M. Haris Awan</span> · © {new Date().getFullYear()} poolr
          </p>
        </div>
      </div>
    </div>
  );
}
