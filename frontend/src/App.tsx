import { Component, useEffect, useMemo, useRef, useState, type ErrorInfo, type ReactNode } from "react";
import {
  Activity,
  Clock,
  ClipboardList,
  FileDown,
  FilePlus2,
  FolderOpen,
  LayoutDashboard,
  Layers,
  ListChecks,
  Moon,
  Settings2,
  Share2,
  Sigma,
  Sparkles,
  Sun,
  Save,
  Search as SearchIcon,
  ShieldAlert,
  Table2,
  Workflow,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import {
  engineHealth,
  openProjectDialog,
  exportProject,
  saveProject,
  getProject,
} from "./lib/api";
import { emptyProject, normalizeProject, type Project } from "./lib/project";
import { APP_VERSION } from "./lib/version";
import { ThemeProvider, useTheme } from "./lib/theme";
import Dashboard from "./pages/Dashboard";
import Protocol from "./pages/Protocol";
import Search from "./pages/Search";
import Screening from "./pages/Screening";
import Extraction from "./pages/Extraction";
import Rob from "./pages/Rob";
import Meta from "./pages/Meta";
import Nma from "./pages/Nma";
import Survival from "./pages/Survival";
import Dta from "./pages/Dta";
import Multilevel from "./pages/Multilevel";
import Prisma from "./pages/Prisma";
import DisclaimerModal from "./components/DisclaimerModal";

// v0.5.3 kokonutui component family (adapted, MIT — see file headers)
import FloatingDock, { type DockItem } from "./components/kokonut/FloatingDock";
import DynamicGreeting from "./components/kokonut/DynamicGreeting";
import ProfileSetup, { type ProfileData } from "./components/kokonut/ProfileSetup";
import ProfileDropdown from "./components/kokonut/ProfileDropdown";
import SwitchButton from "./components/kokonut/SwitchButton";
import CommandSearch, { type CommandAction } from "./components/kokonut/CommandSearch";
import OptionsDrawer from "./components/kokonut/OptionsDrawer";

const LAST_PATH_KEY = "poolr.lastProjectPath";
const PROFILE_KEY = "poolr.profile";

const NAV = [
  { key: "dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { key: "protocol", label: "Protocol", Icon: ClipboardList },
  { key: "search", label: "Search", Icon: SearchIcon },
  { key: "screening", label: "Screening", Icon: ListChecks },
  { key: "extraction", label: "Extraction", Icon: Table2 },
  { key: "rob", label: "Risk of Bias", Icon: ShieldAlert },
  { key: "meta", label: "Meta-Analysis", Icon: Sigma },
  { key: "nma", label: "Network MA", Icon: Share2 },
  { key: "multilevel", label: "Multilevel", Icon: Layers },
  { key: "dta", label: "DTA", Icon: Activity },
  { key: "survival", label: "Survival", Icon: Clock },
  { key: "prisma", label: "PRISMA", Icon: Workflow },
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
  nma: "Network Meta-Analysis",
  multilevel: "Multilevel / Multivariate MA",
  dta: "Diagnostic Test Accuracy",
  survival: "Survival Extensions",
  prisma: "PRISMA 2020",
};

function LogoMark({ size = 20 }: { size?: number }) {
  return (
    <img
      src="/poolr-logo.png"
      alt="poolr"
      width={size}
      height={size}
      className="rounded-md"
      draggable={false}
    />
  );
}

/* Animated random floating line field (behind content, z-0).
   v0.5.3: stroke tint follows the active theme. */
type Line = { x: number; y: number; depth: number; vx: number; vy: number; pts: { x: number; y: number }[] };
function useLineField(ref: React.RefObject<HTMLCanvasElement | null>, theme: "light" | "dark") {
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0; let w = 0; let h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let lines: Line[] = [];
    const isDark = theme === "dark";
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
        ctx!.strokeStyle = isDark
          ? `rgba(255,255,255,${alpha.toFixed(3)})`
          : `rgba(15,17,21,${(alpha * 1.15).toFixed(3)})`;
        ctx!.lineWidth = 0.25 + l.depth * 0.55; drawCurve(l.pts, l.x, l.y);
      }
      raf = requestAnimationFrame(draw);
    };
    build(); draw(); window.addEventListener("resize", build);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", build); };
  }, [ref, theme]);
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

interface StoredProfile extends ProfileData {}

function readProfile(): StoredProfile | null {
  try {
    const raw = store.get(PROFILE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as StoredProfile;
    return p && typeof p.username === "string" && typeof p.avatarId === "number" ? p : null;
  } catch {
    return null;
  }
}

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
        <p className="mt-1 text-[12.5px] text-[var(--color-text-muted)]">
          {this.state.error.message || "Unknown error"} — your project data is untouched. Switch pages or reload.
        </p>
        <button className="btn-ghost mt-3" onClick={() => this.setState({ error: null })}>Try again</button>
      </div>
    );
  }
}

export default function App() {
  return (
    <ThemeProvider>
      <Shell />
    </ThemeProvider>
  );
}

function Shell() {
  const { theme, toggleTheme } = useTheme();
  const [page, setPage] = useState<PageKey>("dashboard");
  const [connected, setConnected] = useState<boolean | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [projectPath, setProjectPath] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  // v0.5.3 boot experience: splash (greeting) → first-run setup (optional) → app.
  const [splashDone, setSplashDone] = useState(false);
  const [profile, setProfile] = useState<StoredProfile | null>(() => readProfile());
  const [paletteOpen, setPaletteOpen] = useState(false);

  const linefieldRef = useRef<HTMLCanvasElement | null>(null);
  useLineField(linefieldRef, theme);

  // Engine cold-start polling (v0.5.2 behavior kept verbatim).
  useEffect(() => {
    let alive = true;
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

  // Ctrl+K opens the command palette.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
      if (e.key === "Escape") setPaletteOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const cancelPendingSave = () => {
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
    saveSeq.current++;
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
    nma: () => <Nma project={current} onChange={onProjectChange} />,
    multilevel: () => <Multilevel project={current} onChange={onProjectChange} />,
    dta: () => <Dta project={current} onChange={onProjectChange} />,
    survival: () => <Survival project={current} onChange={onProjectChange} />,
    prisma: () => <Prisma project={current} onChange={onProjectChange} />,
  };

  /* Dock navigation — the sidebar's replacement. */
  const dockItems: DockItem[] = useMemo(
    () =>
      NAV.map((n) => ({
        title: n.label,
        icon: <n.Icon className="h-[55%] w-[55%]" />,
        onSelect: () => setPage(n.key),
        active: n.key === page,
      })),
    [page]
  );

  /* Command palette actions (Ctrl+K). */
  const paletteActions: CommandAction[] = useMemo(
    () => [
      ...NAV.map((n) => ({
        id: `go-${n.key}`,
        label: n.label,
        description: n.key === page ? "current page" : undefined,
        end: "Go to",
        icon: <n.Icon className="h-4 w-4" />,
        onSelect: () => setPage(n.key),
      })),
      { id: "file-open", label: "Open project…", end: "File", short: "", icon: <FolderOpen className="h-4 w-4" />, onSelect: () => void handleOpen() },
      { id: "file-demo", label: "Load demo review", description: "BCG dataset", end: "File", icon: <Sparkles className="h-4 w-4" />, onSelect: () => void loadDemo() },
      { id: "file-new", label: "New workspace", end: "File", icon: <FilePlus2 className="h-4 w-4" />, onSelect: () => void handleNew() },
      { id: "file-save", label: "Save project", end: "File", icon: <Save className="h-4 w-4" />, onSelect: () => void handleSave() },
      { id: "file-export", label: "Export report (DOCX)", end: "File", icon: <FileDown className="h-4 w-4" />, onSelect: () => void handleExport() },
      { id: "app-theme", label: theme === "dark" ? "Switch to light theme" : "Switch to dark theme", end: "Appearance", icon: theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />, onSelect: toggleTheme },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [theme, page, project]
  );

  const connDot =
    connected === null ? "bg-[var(--color-text-muted)]" : connected ? "bg-[var(--color-include)]" : "bg-[var(--color-exclude)]";
  const connLabel = connected === null ? "connecting…" : connected ? "engine online" : "engine offline";

  /* ── Boot splash: greeting cycles while services spin up ── */
  const showSplash = !splashDone;

  /* ── First-run personalization ── */
  const showSetup = splashDone && !profile;

  return (
    <div className="relative z-10 flex h-full w-full flex-col overflow-hidden text-[var(--color-text)]">
      <canvas ref={linefieldRef} className="linefield" aria-hidden="true" />

      {/* ── Header ── */}
      <header className="glass z-20 flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-3">
          <LogoMark size={22} />
          <div>
            <h1 className="text-[16px] font-semibold">{TITLES[page]}</h1>
            <p className="hidden text-[10.5px] text-[var(--color-text-muted)] sm:block">Systematic review &amp; meta-analysis</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button className="btn-ghost flex items-center gap-1.5" disabled={busy} onClick={handleOpen}>
            <FolderOpen className="h-3.5 w-3.5" /> Open
          </button>
          <button className="btn-ghost flex items-center gap-1.5" disabled={busy} onClick={loadDemo}>
            <Sparkles className="h-3.5 w-3.5" /> Demo
          </button>
          <button className="btn-ghost flex items-center gap-1.5" onClick={handleNew}>
            <FilePlus2 className="h-3.5 w-3.5" /> New
          </button>
          <button className="btn-ghost flex items-center gap-1.5" disabled={!project} onClick={handleSave}>
            <Save className="h-3.5 w-3.5" /> Save
          </button>
          <button className="btn-primary flex items-center gap-1.5" disabled={!project || busy} onClick={handleExport}>
            <FileDown className="h-3.5 w-3.5" /> Export
          </button>
          <SwitchButton size="sm" showLabel={false} className="ml-1 !h-8 !rounded-lg !px-2" />
        </div>
      </header>

      {/* ── Main ── */}
      <main className="relative z-10 flex-1 overflow-auto p-4 pb-24">
        {banner && (
          <div className="mb-3 flex items-start gap-2 rounded-[3px] border border-[var(--color-exclude)]/30 bg-[var(--color-exclude)]/10 px-2.5 py-1.5 text-[12px] text-[var(--color-exclude)]">
            <span className="flex-1">{banner}</span>
            <button className="shrink-0 text-[var(--color-exclude)]/70 hover:text-[var(--color-exclude)]" onClick={() => setBanner(null)} aria-label="Dismiss">✕</button>
          </div>
        )}
        <AnimatePresence mode="wait">
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            initial={{ opacity: 0, y: 6 }}
            key={page}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            <PageBoundary pageKey={page}>{pages[page]()}</PageBoundary>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* ── Footer — quiet: connection + save state only (version lives in the profile menu) ── */}
      <footer className="glass z-20 flex items-center justify-between border-t px-4 py-1 text-[10.5px] text-[var(--color-text-muted)]">
        <span className="flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full ${connDot}`} />
          {connLabel}
        </span>
        <span className="flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full ${saveState === "error" ? "bg-[var(--color-exclude)]" : saveState === "saved" ? "bg-[var(--color-include)]" : "bg-[#8b8d96]"}`} />
          {saveLabel}
        </span>
      </footer>

      {/* ── Floating dock (sidebar replacement) ── */}
      <div className="pointer-events-none fixed inset-x-0 bottom-3 z-30 flex justify-center">
        <FloatingDock items={dockItems} className="pointer-events-auto" />
      </div>

      {/* ── Workspace options + profile (bottom-right corner) ── */}
      <div className="fixed bottom-3 right-3 z-30 flex items-end gap-2">
        <OptionsDrawer
          closeText="Close"
          description="Load sample data, start fresh, or jump straight into analysis. Everything runs locally."
          icon={Settings2}
          title="Workspace options"
          trigger={<button className="btn-ghost flex items-center gap-1.5 rounded-full shadow-lg"><Settings2 className="h-3.5 w-3.5" /> Options</button>}
        >
          <div className="space-y-2">
            <button className="btn-ghost flex w-full items-center gap-2 py-2" onClick={() => { void loadDemo(); }}>
              <Sparkles className="h-4 w-4" /> Load bundled demo review
            </button>
            <button className="btn-ghost flex w-full items-center gap-2 py-2" onClick={() => { void handleNew(); }}>
              <FilePlus2 className="h-4 w-4" /> Start a new workspace
            </button>
            <button className="btn-ghost flex w-full items-center gap-2 py-2" onClick={() => { setPage("meta"); }}>
              <Sigma className="h-4 w-4" /> Go to Meta-Analysis
            </button>
            <div className="mt-3 flex items-center justify-between rounded-xl border border-[var(--card-border)] px-3 py-2">
              <span className="text-[12.5px]">Theme</span>
              <SwitchButton size="sm" />
            </div>
          </div>
        </OptionsDrawer>

        <ProfileDropdown
          appVersion={APP_VERSION}
          className="[&_[data-radix-popper-content-wrapper]]:bottom-4"
          data={{
            name: profile?.username ?? "Reviewer",
            email: "local workspace · your data stays here",
          }}
        />
      </div>

      {/* ── Command palette (Ctrl+K) ── */}
      <AnimatePresence>
        {paletteOpen && (
          <motion.div
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-28 backdrop-blur-[2px]"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            onClick={() => setPaletteOpen(false)}
            transition={{ duration: 0.15 }}
          >
            <motion.div
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="w-full max-w-xl px-4"
              exit={{ opacity: 0, scale: 0.98, y: -8 }}
              initial={{ opacity: 0, scale: 0.98, y: -8 }}
              onClick={(e) => e.stopPropagation()}
              transition={{ duration: 0.16, ease: "easeOut" }}
            >
              <CommandSearch actions={paletteActions} hint="↑↓ navigate · Enter select · Ctrl+K toggle" placeholder="Jump to a page or run a command…" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Boot splash ── */}
      <AnimatePresence>
        {showSplash && (
          <motion.div
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-[60] flex flex-col items-center justify-center"
            exit={{ opacity: 0 }}
            initial={{ opacity: 1 }}
            style={{ background: "var(--color-bg)" }}
            transition={{ duration: 0.35 }}
          >
            <motion.div
              animate={{ opacity: 1, scale: 1 }}
              className="mb-2"
              initial={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            >
              <LogoMark size={44} />
            </motion.div>
            <DynamicGreeting onFinish={() => setTimeout(() => setSplashDone(true), 450)} />
            <p className="text-[11px] tracking-wide text-[var(--color-text-muted)]">starting local services…</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── First-run avatar/name setup ── */}
      <AnimatePresence>
        {showSetup && (
          <motion.div
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-[55] flex items-center justify-center overflow-auto p-6"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            style={{ background: "var(--color-bg)" }}
            transition={{ duration: 0.25 }}
          >
            <ProfileSetup
              onComplete={(data) => {
                store.set(PROFILE_KEY, JSON.stringify(data));
                setProfile(data);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {showDisclaimer && <DisclaimerModal onClose={() => setShowDisclaimer(false)} />}
    </div>
  );
}
