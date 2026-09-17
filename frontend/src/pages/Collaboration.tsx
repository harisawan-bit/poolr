/**
 * Collaboration Page — team workspace hub.
 *
 * Shows team management, shared projects, comments, and activity.
 * Integrates Google Drive for project sharing and sync.
 */
import * as React from "react";
import { useAuth } from "../context/AuthContext";
import { useCollaboration } from "../context/CollaborationContext";
import { useDriveSync } from "../lib/drive-sync";
import { TeamPanel } from "../components/TeamPanel";
import { CommentsPanel } from "../components/CommentsPanel";
import { ActivityFeed } from "../components/ActivityFeed";
import { GoogleSignInButton } from "../components/GoogleSignIn";
import { Card, Button, Pill } from "../components/ui";
import { Users, Cloud, Share2, Bell } from "lucide-react";

export default function CollaborationPage() {
  const { isAuthenticated, user } = useAuth();
  const { teamMembers, comments, activityFeed } = useCollaboration();
  const { progress, lastResult, isSyncing } = useDriveSync();
  const [activeTab, setActiveTab] = React.useState<"team" | "comments" | "activity" | "settings">("team");

  const tabs = [
    { key: "team" as const, label: "Team", icon: Users, count: teamMembers.length },
    { key: "comments" as const, label: "Comments", icon: Share2, count: comments.filter((c) => !c.resolved).length },
    { key: "activity" as const, label: "Activity", icon: Bell, count: activityFeed.length },
  ];

  if (!isAuthenticated()) {
    return (
      <div className="mx-auto max-w-lg space-y-6">
        <Card>
          <h2 className="text-[15px] font-semibold">Team Collaboration</h2>
          <p className="mt-2 text-[12.5px] text-[var(--color-text-muted)]">
            Sign in with Google to enable team features: shared projects,
            real-time commenting, role-based access control, and Drive sync.
          </p>
          <div className="mt-4">
            <GoogleSignInButton />
          </div>
        </Card>

        <Card>
          <h3 className="text-[13px] font-semibold">Collaboration features</h3>
          <ul className="mt-2 space-y-2 text-[12.5px] text-[var(--color-text-muted)]">
            <li className="flex items-start gap-2">
              <Users className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-accent)]" />
              <div>
                <strong className="text-[var(--color-text)]">Team Management</strong>
                <p>Invite reviewers with editor or viewer roles</p>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <Share2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-accent)]" />
              <div>
                <strong className="text-[var(--color-text)]">Shared Comments</strong>
                <p>Discuss studies, resolve disagreements inline</p>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <Cloud className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-accent)]" />
              <div>
                <strong className="text-[var(--color-text)]">Google Drive Sync</strong>
                <p>Automatic backup and cross-device access</p>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <Bell className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-accent)]" />
              <div>
                <strong className="text-[var(--color-text)]">Activity Feed</strong>
                <p>Track who changed what, when</p>
              </div>
            </li>
          </ul>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* User info banner */}
      <Card>
        <div className="flex items-center gap-3">
          {user?.picture ? (
            <img
              src={user.picture}
              alt={user.name}
              className="h-10 w-10 rounded-full"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-accent)] text-[16px] font-bold text-white">
              {user?.name?.charAt(0).toUpperCase() || "?"}
            </div>
          )}
          <div className="flex-1">
            <p className="text-[14px] font-semibold">{user?.name}</p>
            <p className="text-[12px] text-[var(--color-text-muted)]">{user?.email}</p>
          </div>
          <Pill tone="include">Connected</Pill>
        </div>
      </Card>

      {/* Tab navigation */}
      <div className="flex gap-1 rounded-lg border border-[var(--color-border)] p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-[12px] font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-[var(--color-accent)] text-white"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            }`}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
            {tab.count > 0 && (
              <span className={`rounded-full px-1.5 text-[10px] ${
                activeTab === tab.key ? "bg-white/20" : "bg-[var(--color-border)]"
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "team" && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <TeamPanel />
          </Card>
          <Card>
            <div className="space-y-3">
              <h3 className="text-[13px] font-semibold">Share a project</h3>
              <p className="text-[12.5px] text-[var(--color-text-muted)]">
                Upload a project to Google Drive and invite team members to collaborate.
              </p>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => window.dispatchEvent(new CustomEvent("poolr:gopage", { detail: "drive-sync" }))}>
                  <Cloud className="h-3.5 w-3.5" /> Open Drive Sync
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {activeTab === "comments" && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CommentsPanel targetType="project" />
          </Card>
          <Card>
            <h3 className="text-[13px] font-semibold">Quick tips</h3>
            <ul className="mt-2 space-y-1.5 text-[12.5px] text-[var(--color-text-muted)]">
              <li>• Use comments to discuss screening decisions</li>
              <li>• Tag studies with specific feedback</li>
              <li>• Resolve comments once consensus is reached</li>
              <li>• Comments persist across devices via Drive sync</li>
            </ul>
          </Card>
        </div>
      )}

      {activeTab === "activity" && (
        <Card>
          <ActivityFeed />
        </Card>
      )}
    </div>
  );
}
