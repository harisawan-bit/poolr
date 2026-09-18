import * as React from "react";
import { useCollaboration, type ReviewStep } from "../context/CollaborationContext";
import { Card, Button, Pill, Input } from "./ui";
import { History, Clock, Award, Filter, Download, UserCheck, CheckCircle2 } from "lucide-react";

export function AuditTrailView() {
  const { changeDeltas, authorship, getAuthorshipReport } = useCollaboration();
  const [activeTab, setActiveTab] = React.useState<"history" | "authorship">("history");
  const [sectionFilter, setSectionFilter] = React.useState<string>("all");
  const [searchQuery, setSearchQuery] = React.useState<string>("");

  const authorshipList = React.useMemo(() => getAuthorshipReport(), [authorship, getAuthorshipReport]);

  const filteredDeltas = React.useMemo(() => {
    return changeDeltas.filter((d) => {
      if (sectionFilter !== "all" && d.section !== sectionFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          d.authorName.toLowerCase().includes(q) ||
          d.description.toLowerCase().includes(q) ||
          d.field.toLowerCase().includes(q) ||
          (d.targetId && d.targetId.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [changeDeltas, sectionFilter, searchQuery]);

  const exportAuthorshipReport = () => {
    const lines = [
      "# ICMJE & CRediT Authorship Contribution Report",
      `Project Audit generated: ${new Date().toLocaleString()}`,
      "",
      "| Contributor | Email | Total Active Time | Protocol | Screening | Extraction | RoB | Meta | Manuscript | CRediT Roles |",
      "| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |",
    ];

    authorshipList.forEach((a) => {
      const hours = (a.totalMinutes / 60).toFixed(1);
      lines.push(
        `| ${a.userName} | ${a.userEmail} | ${hours} hrs (${a.totalMinutes}m) | ${a.sectionMinutes.protocol || 0}m | ${a.sectionMinutes.screening || 0}m | ${a.sectionMinutes.extraction || 0}m | ${a.sectionMinutes.rob || 0}m | ${a.sectionMinutes.meta || 0}m | ${a.sectionMinutes.manuscript || 0}m | ${a.creditRoles.join(", ")} |`
      );
    });

    const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Authorship_Report_${new Date().toISOString().slice(0, 10)}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Subnav */}
      <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("history")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
              activeTab === "history"
                ? "bg-[var(--color-accent)] text-white"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            }`}
          >
            <History className="h-3.5 w-3.5" /> Revision History ({changeDeltas.length})
          </button>
          <button
            onClick={() => setActiveTab("authorship")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
              activeTab === "authorship"
                ? "bg-[var(--color-accent)] text-white"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            }`}
          >
            <Award className="h-3.5 w-3.5" /> Authorship & Time Spent ({authorshipList.length})
          </button>
        </div>

        {activeTab === "authorship" && (
          <Button size="sm" variant="ghost" onClick={exportAuthorshipReport}>
            <Download className="h-3.5 w-3.5 mr-1" /> Export ICMJE Report (.md)
          </Button>
        )}
      </div>

      {/* Tab 1: Revision History */}
      {activeTab === "history" && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Input
                placeholder="Filter by author, field, or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="text-[12px] h-8"
              />
            </div>
            <select
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
              className="h-8 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 text-[12px] text-[var(--color-text)] outline-none"
            >
              <option value="all">All Sections</option>
              <option value="protocol">Protocol</option>
              <option value="screening">Screening</option>
              <option value="extraction">Extraction</option>
              <option value="rob">Risk of Bias</option>
              <option value="meta">Meta-Analysis</option>
              <option value="manuscript">Manuscript</option>
            </select>
          </div>

          {filteredDeltas.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[var(--color-border)] p-8 text-center text-[12px] text-[var(--color-text-muted)]">
              No change records matching filters. Edits across the team will be logged automatically.
            </div>
          ) : (
            <div className="space-y-2">
              {filteredDeltas.map((delta) => (
                <div
                  key={delta.id}
                  className="flex items-start gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-[12px] transition-colors hover:border-[var(--color-border-strong)]"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-2)] text-[10px] font-bold text-[var(--color-accent)]">
                    r{delta.revision}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[var(--color-text)]">{delta.authorName}</span>
                      <Pill tone="neutral">{delta.section}</Pill>
                      <span className="font-mono text-[11px] text-[var(--color-text-muted)]">
                        {delta.field} {delta.targetId ? `(${delta.targetId})` : ""}
                      </span>
                      <span className="ml-auto text-[10.5px] text-[var(--color-text-muted)]">
                        {new Date(delta.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <p className="mt-1 text-[12px] text-[var(--color-text)]">{delta.description}</p>
                    <div className="mt-2 flex items-center gap-2 font-mono text-[10.5px]">
                      <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-red-500 line-through">
                        {typeof delta.oldValue === "object" ? JSON.stringify(delta.oldValue) : String(delta.oldValue ?? "none")}
                      </span>
                      <span>→</span>
                      <span className="rounded bg-green-500/10 px-1.5 py-0.5 text-green-500">
                        {typeof delta.newValue === "object" ? JSON.stringify(delta.newValue) : String(delta.newValue ?? "none")}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Authorship & Time Spent */}
      {activeTab === "authorship" && (
        <div className="space-y-4">
          <Card>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-[13.5px] font-semibold text-[var(--color-text)]">
                  ICMJE &amp; CRediT Authorship Qualification
                </h3>
                <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
                  Active time spent is tracked continuously while collaborators work across protocol, screening, extraction, analysis, and manuscript sections to prevent ghost or gift authorship disputes.
                </p>
              </div>
              <Pill tone="include">
                <UserCheck className="h-3 w-3 mr-1 inline" /> Audit Active
              </Pill>
            </div>
          </Card>

          <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
            <table className="w-full text-left text-[12px]">
              <thead className="bg-[var(--color-surface-2)] text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
                <tr>
                  <th className="px-3 py-2.5">Contributor</th>
                  <th className="px-3 py-2.5">Total Active Time</th>
                  <th className="px-3 py-2.5">Screening</th>
                  <th className="px-3 py-2.5">Extraction</th>
                  <th className="px-3 py-2.5">RoB</th>
                  <th className="px-3 py-2.5">Meta / Analysis</th>
                  <th className="px-3 py-2.5">Manuscript</th>
                  <th className="px-3 py-2.5">CRediT Roles</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)] bg-[var(--color-surface)]">
                {authorshipList.map((author) => {
                  const hours = (author.totalMinutes / 60).toFixed(1);
                  return (
                    <tr key={author.userId} className="hover:bg-[var(--hover-surface)]">
                      <td className="px-3 py-2.5">
                        <div className="font-semibold text-[var(--color-text)]">{author.userName}</div>
                        <div className="text-[10.5px] text-[var(--color-text-muted)]">{author.userEmail}</div>
                      </td>
                      <td className="px-3 py-2.5 font-semibold text-[var(--color-accent)]">
                        {hours} hrs ({author.totalMinutes}m)
                      </td>
                      <td className="px-3 py-2.5 text-[var(--color-text-muted)]">{author.sectionMinutes.screening || 0}m</td>
                      <td className="px-3 py-2.5 text-[var(--color-text-muted)]">{author.sectionMinutes.extraction || 0}m</td>
                      <td className="px-3 py-2.5 text-[var(--color-text-muted)]">{author.sectionMinutes.rob || 0}m</td>
                      <td className="px-3 py-2.5 text-[var(--color-text-muted)]">{author.sectionMinutes.meta || 0}m</td>
                      <td className="px-3 py-2.5 text-[var(--color-text-muted)]">{author.sectionMinutes.manuscript || 0}m</td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {author.creditRoles.map((role) => (
                            <span
                              key={role}
                              className="rounded bg-[var(--color-surface-2)] px-1.5 py-0.5 text-[10px] font-medium"
                            >
                              {role}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default AuditTrailView;
