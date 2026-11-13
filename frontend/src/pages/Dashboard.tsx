import { useEffect, useState } from "react";
import { ArrowRight, BookOpen, ListChecks, Database, ShieldCheck } from "lucide-react";
import { dashboardGreeting, greetingPeriod, greetingVariantsPerPeriod } from "../lib/dashboardGreeting";
import type { Project } from "../lib/project";

const go = (page: string) => window.dispatchEvent(new CustomEvent("poolr:gopage", { detail: page }));
export default function Dashboard({ project, name }: { project: Project; name?: string; onChange: (p: Project) => void }) {
  const [greeting] = useState(() => {
    const period = greetingPeriod(new Date().getHours());
    const key = `poolr.dashboardGreeting.${period}`;
    let visit = 0;
    try {
      const saved = Number(localStorage.getItem(key));
      if (Number.isSafeInteger(saved) && saved >= 0) visit = saved % greetingVariantsPerPeriod;
    } catch { /* Dashboard also renders without local storage. */ }
    return { period, key, visit };
  });
  useEffect(() => {
    try { localStorage.setItem(greeting.key, String((greeting.visit + 1) % greetingVariantsPerPeriod)); }
    catch { /* Storage is optional for the greeting. */ }
  }, [greeting]);
  const welcome = dashboardGreeting(greeting.period, greeting.visit, name);
  const ta = project.screening.title_abstract;
  const ft = project.screening.full_text;
  const blinded = Boolean(project.screening.blinded);
  const pending = ta.filter(r => r.decision === "unset").length;
  const ftPending = ft.filter(r => r.decision === "unset").length;
  const conflictIds = new Set([...ta, ...ft].filter(r => r.conflictStatus === "pending" || r.conflictStatus === "discuss").map(r => r.id));
  const conflicts = conflictIds.size;
  const studies = project.extraction.studies.length;
  const next = !project.pico.population ? "protocol" : !ta.length ? "search" : pending || ftPending || (!blinded && conflicts > 0) ? "screening" : !studies ? "extraction" : "meta";
  const nextLabel: Record<string, string> = { protocol: "Define your research question", search: "Find and import references", screening: "Continue screening", extraction: "Extract study data", meta: "Review your analysis" };
  return <div className="review-overview">
    <section className="review-heading review-welcome">
      <h2>{welcome.title}</h2>
      <p>{welcome.note}</p>
      {project.protocol.objective && <p className="review-objective">{project.protocol.objective}</p>}
    </section>
    <section className="review-next"><div><small>Next step</small><h3>{nextLabel[next]}</h3><p>{pending ? pending + " references are waiting for a decision." : null}</p></div><button type="button" className="btn-primary" onClick={() => go(next)}>Continue <ArrowRight size={15}/></button></section>
    <div className="review-metrics">{[
      {label:"References imported",value:ta.length,detail:"Title & abstract stage",page:"search", icon: BookOpen},
      {label:"Awaiting screening",value:pending,detail:blinded ? "Blinded dual pass active" : conflicts + " unresolved conflicts",page:"screening", icon: ListChecks},
      {label:"Studies extracted",value:studies,detail:"Review outcomes and source data",page:"extraction", icon: Database},
      {label:"Bias assessments",value:project.rob.assessments.length,detail:"Review judgments and rationale",page:"rob", icon: ShieldCheck}
    ].map(m => <button type="button" key={m.page} aria-label={`${m.label}: ${m.value}`} onClick={() => go(m.page)}><m.icon size={17} aria-hidden /><span>{m.label}</span><strong>{m.value}</strong><small>{m.detail}</small></button>)}</div>
    <div className="review-columns"><section className="review-panel"><div className="review-panel-heading"><h3>Research question</h3><button className="btn-ghost" onClick={() => go("protocol")}>Edit protocol</button></div><dl>{Object.entries(project.pico).map(([key,value]) => <div key={key}><dt>{key}</dt><dd>{value || "Not defined yet"}</dd></div>)}</dl></section>
    <section className="review-panel"><h3>Review workspace</h3>{[{title:"Search & screening",note:"Find evidence and record eligibility decisions",page:"search"},{title:"Data & assessment",note:"Extract outcomes and evaluate risk of bias",page:"extraction"},{title:"Analysis & reporting",note:"Inspect results and prepare your manuscript",page:"meta"}].map(item => <button className="review-workflow-row" key={item.page} onClick={() => go(item.page)}><div><strong>{item.title}</strong><small>{item.note}</small></div><ArrowRight size={16}/></button>)}</section></div>
  </div>;
}
