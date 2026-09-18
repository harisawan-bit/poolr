/**
 * Collaboration Page — Team Workspace, RBAC, Discussion Hub & Scientific Audit Trail
 */
import * as React from "react";
import { useAuth } from "../context/AuthContext";
import { useCollaboration } from "../context/CollaborationContext";
import { useDriveSync } from "../lib/drive-sync";
import { TeamPanel } from "../components/TeamPanel";
import { CommentsPanel } from "../components/CommentsPanel";
import { AuditTrailView } from "../components/AuditTrailView";
import { GoogleSignInButton } from "../components/GoogleSignIn";
import { Card, Button, Pill } from "../components/ui";
import { Users, Cloud, Share2, History, Shield, Award } from "lucide-react";

export default function CollaborationPage() {
  const { isAuthenticated, user } = useAuth();
  const { teamMembers, comments, changeDeltas, authorship, currentUserRole } = useCollaboration();
  const { progress, isSyncing } = useDriveSync();
  const [activeTab, setActiveTab] = React.useState<"team" | "comments" | "audit" | "drive">("team");

  const unresolvedComments = comments.filter((c) => !c.resolved).length;

  const tabs = [
    { key: "team" as const, label: "Team & Roles", icon: Users, count: teamMembers.length + 1 },
    { key: "comments" as const, label: "Reviewer Notes", icon: Share2, count: unresolvedComments },
    { key: "audit" as const, label: "Audit & Authorship", icon: History, count: changeDeltas.length },
    { key: "drive" as const, label: "Drive Storage", icon: Cloud, count: undefined },
  ];

  if (!isAuthenticated()) {
    return (
      <div className="mx-auto max-w-lg space-y-6">
        <Card>
          <div className="flex items-center gap-2.5">
            <Users className="h-5 w-5 text-[var(--color-accent)]" />
            <div>
              <h2 className="text-[15px] font-semibold text-[var(--color-text)]">Team Collaboration Hub</h2>
              <p className="text-[11px] text-[var(--color-text-muted)]">
                Connect your Google Account to collaborate on systematic reviews using your own Google Drive storage.
              </p>
            </div>
          </div>
          <div className="mt-4">
            <GoogleSignInButton />
          </div>
        </Card>

        <Card title="Collaboration & Security Highlights">
          <ul className="mt-2 space-y-2.5 text-[12px] text-[var(--color-text-muted)]">
            <li className="flex items-start gap-2">
              <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-accent)]" />
              <div>
                <strong className="text-[var(--color-text)]">Admin-Controlled RBAC</strong>
                <p>Define what each collaborator can do: Protocol Editor, Screener, Extractor, or Read-Only Auditor.</p>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <Cloud className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-accent)]" />
              <div>
                <strong className="text-[var(--color-text)]">Bring-Your-Own-Storage (BYOS)</strong>
                <p>Projects and changes remain in your institution or personal Google Drive. Zero external servers.</p>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <History className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-accent)]" />
              <div>
                <strong className="text-[var(--color-text)]">PRISMA 2020 Revision Tracking</strong>
                <p>Every decision, extraction change, and meta calculation is logged in an append-only revision stream.</p>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <Award className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-accent)]" />
              <div>
                <strong className="text-[var(--color-text)]">ICMJE Authorship Time Verification</strong>
                <p>Monitors active time spent by each team member across all review steps to prevent authorship disputes.</p>
              </div>
            </li>
          </ul>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* User Info & Workspace Summary Card */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {user?.picture ? (
              <img
                src={user.picture}
                alt={user.name}
                className="h-9 w-9 rounded-full shrink-0"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-accent)] text-[13px] font-bold text-white shrink-0">
                {user?.name?.charAt(0).toUpperCase() || "?"}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-[13.5px] font-semibold text-[var(--color-text)]">{user?.name}</p>
              <p className="truncate text-[11px] text-[var(--color-text-muted)]">{user?.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Pill tone="include">Google Connected</Pill>
            <Pill tone={currentUserRole === "owner" ? "include" : "info"}>
              Role: {currentUserRole.toUpperCase()}
            </Pill>
          </div>
        </div>
      </Card>

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-1 rounded-lg border border-[var(--color-border)] p-1 bg-[var(--color-surface)]">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-[12px] font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-[var(--color-accent)] text-white shadow-xs"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--hover-surface)]"
            }`}
          >
            <tab.icon className="h-3.5 w-3.5" />
            <span>{tab.label}</span>
            {tab.count !== undefined && tab.count > 0 && (
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] font-semibold ${
                  activeTab === tab.key ? "bg-white/20 text-white" : "bg-[var(--color-surface-2)] text-[var(--color-text)]"
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "team" && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <TeamPanel />
          </Card>
          <div className="space-y-4">
            <Card title="Role-Based Permissions Guide">
              <div className="space-y-2 text-[12px] text-[var(--color-text-muted)]">
                <div className="rounded-md border border-[var(--color-border)] p-2 bg-[var(--color-surface-2)]">
                  <strong className="text-[var(--color-text)]">Admin / Workspace Owner:</strong> Full permissions. Manages invites, assigns roles, edits protocol, locks stages.
                </div>
                <div className="rounded-md border border-[var(--color-border)] p-2 bg-[var(--color-surface-2)]">
                  <strong className="text-[var(--color-text)]">Lead Methodologist (Editor):</strong> Edits protocol, screening adjudication, data extraction, RoB, meta-analyses, and manuscript drafting.
                </div>
                <div className="rounded-md border border-[var(--color-border)] p-2 bg-[var(--color-surface-2)]">
                  <strong className="text-[var(--color-text)]">Reviewer (Screener):</strong> Casts independent dual screening votes, extracts assigned study outcomes, and leaves step comments.
                </div>
                <div className="rounded-md border border-[var(--color-border)] p-2 bg-[var(--color-surface-2)]">
                  <strong className="text-[var(--color-text)]">Auditor (Viewer):</strong> Strict read-only view of data, plots, flowcharts, and exports.
                </div>
              </div>
            </Card>

            <Card title="Shared Google Drive Storage">
              <p className="text-[12px] text-[var(--color-text-muted)] leading-relaxed">
                When you invite team members, their Google accounts are automatically granted access to the project's folder inside your Google Drive.
              </p>
              <div className="mt-3">
                <Button size="sm" onClick={() => window.dispatchEvent(new CustomEvent("poolr:gopage", { detail: "driveSync" }))}>
                  <Cloud className="h-3.5 w-3.5 mr-1" /> Open Drive Sync Console
                </Button>
              </div>
            </Card>
          </div>
        </div>
      )}

      {activeTab === "comments" && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card title="All Reviewer Discussions">
            <CommentsPanel targetType="project" />
          </Card>
          <Card title="Contextual Collaboration Guide">
            <p className="text-[12px] text-[var(--color-text-muted)] leading-relaxed mb-3">
              Reviewers can leave inline discussion notes on every single step of the systematic review:
            </p>
            <ul className="space-y-1.5 text-[12px] text-[var(--color-text-muted)]">
              <li>• <strong>Protocol:</strong> Refine PICO criteria with methodologists.</li>
              <li>• <strong>Screening:</strong> Discuss ambiguous abstracts before consensus.</li>
              <li>• <strong>Extraction:</strong> Document imputation formulas or unit conversions.</li>
              <li>• <strong>RoB:</strong> Note reasons for downgrade in Cochrane Risk of Bias.</li>
              <li>• <strong>Manuscript:</strong> Assign co-authors and review text draft sections.</li>
            </ul>
          </Card>
        </div>
      )}

      {activeTab === "audit" && (
        <AuditTrailView />
      )}

      {activeTab === "drive" && (
        <Card title="Google Drive Workspace Integration">
          <p className="text-[12px] text-[var(--color-text-muted)] leading-relaxed mb-4">
            Manage your synchronized reviews, inspect remote files, resolve edit conflicts, and discover projects shared with you by teammates.
          </p>
          <Button size="sm" onClick={() => window.dispatchEvent(new CustomEvent("poolr:gopage", { detail: "driveSync" }))}>
            <Cloud className="h-3.5 w-3.5 mr-1" /> Go to Google Drive Sync Page
          </Button>
        </Card>
      )}
    </div>
  );
}
