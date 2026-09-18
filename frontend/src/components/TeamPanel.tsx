/**
 * Team Panel — Enterprise Team Management, RBAC & Google Drive Sharing
 */
import * as React from "react";
import { useCollaboration, type TeamMember, type Role } from "../context/CollaborationContext";
import { useDriveSync } from "../lib/drive-sync";
import { UserPlus, UserMinus, Shield, Edit3, Eye, Crown, CheckCircle2, Cloud, Clock } from "lucide-react";
import { Button, Pill } from "./ui";

export function TeamPanel({ compact = false, folderId }: { compact?: boolean; folderId?: string }) {
  const {
    teamMembers,
    addTeamMember,
    removeTeamMember,
    updateMemberRole,
    canManageTeam,
  } = useCollaboration();

  const { shareWithTeammate } = useDriveSync();

  const [showInvite, setShowInvite] = React.useState(false);
  const [inviteEmail, setInviteEmail] = React.useState("");
  const [inviteName, setInviteName] = React.useState("");
  const [inviteRole, setInviteRole] = React.useState<Role>("editor");
  const [inviteError, setInviteError] = React.useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = React.useState<string | null>(null);
  const [isInviting, setIsInviting] = React.useState(false);

  const handleInvite = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      setInviteError("Please enter a valid email address");
      return;
    }

    setIsInviting(true);
    setInviteError(null);
    setInviteSuccess(null);

    try {
      // 1. Add to local/workspace collaboration manifest
      await addTeamMember(email, inviteRole, inviteName.trim() || undefined);

      // 2. If folderId is provided or active, grant Drive permission
      if (folderId) {
        await shareWithTeammate(folderId, email, inviteRole === "viewer" ? "viewer" : inviteRole === "reviewer" ? "reviewer" : "editor");
      }

      setInviteSuccess(`Invited ${email} as ${inviteRole}. Shared via Google Drive.`);
      setInviteEmail("");
      setInviteName("");
      setTimeout(() => {
        setShowInvite(false);
        setInviteSuccess(null);
      }, 2000);
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "Failed to send invitation");
    } finally {
      setIsInviting(false);
    }
  };

  const roleBadge = (role: Role) => {
    switch (role) {
      case "owner":
        return <Pill tone="include"><Crown className="h-3 w-3 inline mr-0.5 text-amber-500" /> Admin</Pill>;
      case "editor":
        return <Pill tone="info"><Edit3 className="h-3 w-3 inline mr-0.5 text-blue-500" /> Lead</Pill>;
      case "reviewer":
        return <Pill tone="neutral"><Eye className="h-3 w-3 inline mr-0.5 text-purple-500" /> Reviewer</Pill>;
      case "viewer":
        return <Pill tone="neutral">Auditor</Pill>;
    }
  };

  return (
    <div className={`flex flex-col ${compact ? "gap-1" : "gap-3"}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-[var(--color-accent)]" />
          {!compact && (
            <span className="text-[12px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              Team &amp; Access
            </span>
          )}
          <Pill tone="neutral">{teamMembers.length + 1}</Pill>
        </div>
        {canManageTeam() && !compact && (
          <Button size="sm" variant="ghost" onClick={() => setShowInvite((s) => !s)}>
            <UserPlus className="h-3.5 w-3.5 mr-1" /> Add Member
          </Button>
        )}
      </div>

      {/* Invite Form */}
      {showInvite && (
        <div className="space-y-2.5 rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface-2)] p-3 text-[12px]">
          <div className="font-semibold text-[var(--color-text)]">Invite Collaborator to Google Drive Workspace</div>
          <p className="text-[11px] text-[var(--color-text-muted)]">
            Collaborator will receive Google Drive file permissions and can open this review directly on their device.
          </p>

          <input
            type="text"
            placeholder="Collaborator Name (e.g. Dr. Sarah Chen)"
            value={inviteName}
            onChange={(e) => setInviteName(e.target.value)}
            className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-[12px] outline-none focus:border-[var(--color-accent)]"
          />

          <input
            type="email"
            placeholder="colleague@institution.edu"
            value={inviteEmail}
            onChange={(e) => {
              setInviteEmail(e.target.value);
              setInviteError(null);
            }}
            className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-[12px] outline-none focus:border-[var(--color-accent)]"
          />

          <div className="flex items-center gap-2">
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as Role)}
              className="flex-1 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-[12px]"
            >
              <option value="editor">Lead Methodologist (Edit Protocol, Screen, Extract, Meta)</option>
              <option value="reviewer">Reviewer (Dual Screen &amp; Extract Data)</option>
              <option value="viewer">Auditor (Read Only, View Plots &amp; Export)</option>
            </select>
            <Button size="sm" onClick={handleInvite} disabled={isInviting}>
              {isInviting ? "Inviting…" : "Invite"}
            </Button>
          </div>

          {inviteError && <p className="text-[11px] text-red-500">{inviteError}</p>}
          {inviteSuccess && (
            <p className="text-[11px] text-green-500 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> {inviteSuccess}
            </p>
          )}

          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setShowInvite(false);
              setInviteEmail("");
            }}
            className="w-full text-[11px]"
          >
            Cancel
          </Button>
        </div>
      )}

      {/* Current User (Owner) */}
      <div className="flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-accent)] text-[11px] font-bold text-white shrink-0">
            You
          </div>
          <div className="min-w-0">
            <p className="truncate text-[12.5px] font-semibold">Workspace Owner (You)</p>
            <p className="truncate text-[11px] text-[var(--color-text-muted)]">Full permissions · Admin</p>
          </div>
        </div>
        {roleBadge("owner")}
      </div>

      {/* Team Member List */}
      <div className="space-y-1.5">
        {teamMembers.map((member) => (
          <div
            key={member.id}
            className="flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5 hover:border-[var(--color-border-strong)] transition-colors"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {member.picture ? (
                <img
                  src={member.picture}
                  alt={member.name}
                  className="h-7 w-7 rounded-full shrink-0"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-surface-2)] text-[11px] font-semibold shrink-0">
                  {member.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-[12px] font-medium">{member.name}</p>
                <p className="truncate text-[10.5px] text-[var(--color-text-muted)]">{member.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {roleBadge(member.role)}
              {canManageTeam() && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() =>
                      updateMemberRole(
                        member.id,
                        member.role === "editor"
                          ? "reviewer"
                          : member.role === "reviewer"
                          ? "viewer"
                          : "editor"
                      )
                    }
                    className="rounded p-1 text-[var(--color-text-muted)] hover:text-[var(--color-accent)]"
                    title="Cycle role (Editor -> Reviewer -> Viewer)"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => removeTeamMember(member.id)}
                    className="rounded p-1 text-[var(--color-text-muted)] hover:text-red-500"
                    title="Remove from team"
                  >
                    <UserMinus className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {teamMembers.length === 0 && !compact && (
        <div className="rounded-lg border border-dashed border-[var(--color-border)] p-4 text-center text-[11px] text-[var(--color-text-muted)]">
          No team members added yet. Click <strong>Add Member</strong> to invite reviewers via Google Drive.
        </div>
      )}
    </div>
  );
}

export default TeamPanel;
