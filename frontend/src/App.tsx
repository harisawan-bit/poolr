import { Component, useEffect, useMemo, useRef, useState, type ErrorInfo, type ReactNode } from "react";
import {
  engineHealth,
  openProjectDialog,
  exportProject,
  saveProject,
  getProject,
} from "./lib/api";
import { emptyProject, normalizeProject, type Project } from "./lib/project";
import { APP_VERSION } from "./lib/version";
import Dashboard from "./pages/Dashboard";
import Protocol from "./pages/Protocol";
import Search from "./pages/Search";
import Screening from "./pages/Screening";
import Extraction from "./pages/Extraction";
import Rob from "./pages/Rob";
import Meta from "./pages/Meta";
import Prisma from "./pages/Prisma";
import DisclaimerModal from "./components/DisclaimerModal";

const LAST_PATH_KEY = "poolr.lastProjectPath";

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

/* Animated random floating line field (behind content, z-0). */
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

/** localStorage can throw (private mode / disabled storage) — never let it break boot. */
const store = {
  get(key: string): string | null {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  set(key: string, value: string) {
    try { localStorage.setItem(key, value); } catch { /* quota or blocked — non-fatal */ }
  },
};

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Keeps one broken page from white-screening the whole shell. */
class PageBoundary extends Component<{ pageKey: string; children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error("page crashed", error, info); }
  componentDidUpdate(prev: { pageKey: string }) {
    if (prev.pageKey !== this.props.pageKey && this.state.error) this.setState({ error: null });
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="card p-4">
        <h2 className="text-[14px] font-semibold">This page hit an error</h2>
        <p className="mt-1 text-[12.5px] text-[#8b8d96]">
          {this.state.error.message || "Unknown error"} — your project data is untouched. Switch pages or reload.
        </p>
        <button className="btn-ghost mt-3" onClick={() => this.setState({ error: null })}>Try again</button>
      </div>
    );
  }
}

export default function App() {
  const [page, setPage] = useState<PageKey>("dashboard");
  const [connected, setConnected] = useState<boolean | null>(null);
  const [collapsed, setCollapsed] = useState(typeof window !== "undefined" && window.innerWidth < 820);
  const [project, setProject] = useState<Project | null>(null);
  const [projectPath, setProjectPath] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const linefieldRef = useRef<HTMLCanvasElement | null>(null);

  useLineField(linefieldRef);

  useEffect(() => {
    let alive = true;
    // v0.5.2 — the self-contained engine can take several seconds to bind its
    // port on first launch (self-contained extraction, JIT). Poll with backoff
    // instead of a single 1.5s probe, which lost that race and left the shell
    // stuck on "offline" even though every later request worked.
    let delay = 500;
    const tick = async () => {
      const ok = await engineHealth();
      if (!alive) return;
      setConnected(ok);
      if (!ok && delay < 15000) {
        setTimeout(() => { if (alive) { delay = Math.min(delay * 1.5, 15000); tick(); } }, delay);
      }
    };
    void tick();
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    const onResize = () => setCollapsed(window.innerWidth < 820);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Phase E (E3): load the last project on boot so a multi-day MA resumes after restart.
  useEffect(() => {
    let alive = true;
    const last = store.get(LAST_PATH_KEY);
    if (!last) return;
    getProject(last)
      .then((data) => {
        if (!alive) return;
        setProject(normalizeProject(data));
        setProjectPath(last);
        setSaveState("saved");
      })
      .catch(() => { /* no prior project / corrupt — start fresh */ });
    return () => { alive = false; };
  }, []);

  // Debounced autosave (Phase E behaviour wired into the shell).
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveSeq = useRef(0);
  const mounted = useRef(true);
  useEffect(() => () => {
    mounted.current = false;
    if (saveTimer.current) clearTimeout(saveTimer.current);
  }, []);

  const cancelPendingSave = () => {
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
    saveSeq.current++; // invalidate any in-flight save response
  };

  const onProjectChange = (p: Project) => {
    setProject(p);
    if (!projectPath) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveState("saving");
    const seq = ++saveSeq.current;
    saveTimer.current = setTimeout(async () => {
      try {
        const saved = await saveProject(projectPath, p);
        // A newer edit (or a manual save) superseded this one — drop the result
        // so a slow response can't flip the indicator back to "saved".
        if (!mounted.current || seq !== saveSeq.current) return;
        setProjectPath(saved); setSaveState("saved");
        store.set(LAST_PATH_KEY, saved);
      } catch (e) {
        if (!mounted.current || seq !== saveSeq.current) return;
        setSaveState("error"); setBanner(errText(e));
      }
    }, 300);
  };

  const handleOpen = async () => {
    setBusy(true); setBanner(null);
    cancelPendingSave();
    try {
      const res = await openProjectDialog();
      if (res.data) {
        setProject(normalizeProject(res.data));
        setProjectPath(res.path);
        setSaveState("saved");
        if (res.path) store.set(LAST_PATH_KEY, res.path);
      }
    } catch (e) { console.error(e); setSaveState("error"); setBanner(errText(e)); }
    finally { if (mounted.current) setBusy(false); }
  };

  const handleNew = async () => {
    cancelPendingSave();
    const p = emptyProject();
    setProject(p); setSaveState("idle"); setBanner(null);
    const seq = ++saveSeq.current;
    try {
      const saved = await saveProject("poolr.json", p);
      if (!mounted.current || seq !== saveSeq.current) return;
      setProjectPath(saved); setSaveState("saved");
      store.set(LAST_PATH_KEY, saved);
    } catch (e) {
      if (!mounted.current || seq !== saveSeq.current) return;
      setSaveState("error"); setBanner(errText(e));
    }
  };

  const loadDemo = async () => {
    cancelPendingSave();
    try {
      const r = await fetch("demo-project.json", { signal: AbortSignal.timeout(10000) });
      if (!r.ok) throw new Error(`demo asset missing (HTTP ${r.status})`);
      const raw = await r.json();
      setProject(normalizeProject(raw));
      setSaveState("idle"); setBanner(null);
    } catch (e) {
      // v0.5.2 — surface the failure instead of only logging it; the user
      // previously got no feedback at all when the demo asset failed to load.
      console.error(e);
      setSaveState("error");
      setBanner("Could not load the bundled demo project. Reinstall poolr or use Open with a saved project file.");
    }
  };

  const handleSave = async () => {
    if (!project) return;
    cancelPendingSave();
    setSaveState("saving"); setBanner(null);
    const seq = ++saveSeq.current;
    try {
      const saved = await saveProject(projectPath ?? "poolr.json", project);
      if (!mounted.current || seq !== saveSeq.current) return;
      setProjectPath(saved); setSaveState("saved");
      store.set(LAST_PATH_KEY, saved);
    } catch (e) {
      if (!mounted.current || seq !== saveSeq.current) return;
      setSaveState("error"); setBanner(errText(e));
    }
  };

  const [showDisclaimer, setShowDisclaimer] = useState(false);

  const handleExport = async () => {
    if (!project) return;
    setBusy(true); setBanner(null);
    try {
      await exportProject(project, "docx");
      if (mounted.current) setShowDisclaimer(true);
    } catch (e) { console.error(e); if (mounted.current) setBanner(errText(e)); }
    finally { if (mounted.current) setBusy(false); }
  };

  const saveLabel =
    saveState === "saving" ? "saving…" : saveState === "saved" ? "saved" : saveState === "error" ? "save error" : "unsaved";

  // Stable placeholder while no project is loaded: calling emptyProject() inline
  // in the render map minted a brand-new object (and a new `created` timestamp)
  // on every render, which needlessly re-rendered every page.
  const blank = useMemo(() => emptyProject(), []);
  const current = project ?? blank;

  const pages: Record<PageKey, () => React.ReactElement> = {
    dashboard: () => <Dashboard project={current} onChange={onProjectChange} />,
    protocol: () => <Protocol project={current} onChange={onProjectChange} />,
    search: () => <Search project={current} onChange={onProjectChange} />,
    screening: () => <Screening project={current} onChange={onProjectChange} />,
    extraction: () => <Extraction project={current} onChange={onProjectChange} />,
    rob: () => <Rob project={current} onChange={onProjectChange} />,
    meta: () => <Meta project={current} onChange={onProjectChange} />,
    prisma: () => <Prisma project={current} onChange={onProjectChange} />,
  };

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
          {collapsed ? `v${APP_VERSION}` : `v${APP_VERSION} · ${connected === null ? "connecting…" : connected ? "online" : "offline"}`}
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
            <button className="btn-ghost" disabled={busy} onClick={loadDemo}>Demo</button>
            <button className="btn-ghost" onClick={handleNew}>New</button>
            <button className="btn-ghost" disabled={!project} onClick={handleSave}>Save</button>
            <button className="btn-primary" disabled={!project || busy} onClick={handleExport}>Export</button>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4">
          {banner && (
            <div className="mb-3 flex items-start gap-2 rounded-[3px] border border-[#f05252]/30 bg-[#f05252]/10 px-2.5 py-1.5 text-[12px] text-[#f05252]">
              <span className="flex-1">{banner}</span>
              <button className="shrink-0 text-[#f05252]/70 hover:text-[#f05252]" onClick={() => setBanner(null)} aria-label="Dismiss">✕</button>
            </div>
          )}
          <PageBoundary pageKey={page}>{pages[page]()}</PageBoundary>
        </main>

        <footer className="glass flex items-center justify-between border-t border-white/[0.07] px-4 py-1 text-[10.5px] text-[#8b8d96]">
          <span>poolr v{APP_VERSION} · systematic review &amp; meta-analysis · © M. Haris Awan</span>
          <span className="flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${saveState === "error" ? "bg-[#f05252]" : saveState === "saved" ? "bg-[#3fb950]" : "bg-[#8b8d96]"}`} />
            {saveLabel}
          </span>
        </footer>
      </div>

      {showDisclaimer && <DisclaimerModal onClose={() => setShowDisclaimer(false)} />}
    </div>
  );
}
