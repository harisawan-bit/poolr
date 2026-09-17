/**
 * Team Panel — sidebar panel showing team members, roles, and online status.
 */
import * as React from "react";
import { useCollaboration, type TeamMember } from "../context/CollaborationContext";
import { UserPlus, UserMinus, Shield, Edit3, Eye, Crown } from "lucide-react";
import { Button, Pill } from "./ui";

export function TeamPanel({ compact = false }: { compact?: boolean }) {
  const {
    teamMembers,
    addTeamMember,
    removeTeamMember,
    updateMemberRole,
    canManageTeam,
  } = useCollaboration();

  const [showInvite, setShowInvite] = React.useState(false);
  const [inviteEmail, setInviteEmail] = React.useState("");
  const [inviteRole, setInviteRole] = React.useState<"editor" | "viewer">("editor");
  const [inviteError, setInviteError] = React.useState<string | null>(null);

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !inviteEmail.includes("@")) {
      setInviteError("Please enter a valid email address");
      return;
    }
    await addTeamMember(inviteEmail.trim(), inviteRole);
    setInviteEmail("");
    setShowInvite(false);
    setInviteError(null);
  };

  const roleIcon = (role: TeamMember["role"]) => {
    switch (role) {
      case "owner": return <Crown className="h-3 w-3" />;
      case "editor": return <Edit3 className="h-3 w-3" />;
      case "viewer": return <Eye className="h-3 w-3" />;
    }
  };

  const roleColor = (role: TeamMember["role"]) => {
    switch (role) {
      case "owner": return "text-amber-500";
      case "editor": return "text-[var(--color-accent)]";
      case "viewer": return "text-[var(--color-text-muted)]";
    }
  };

  return (
    <div className={`flex flex-col ${compact ? "gap-1" : "gap-3"}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-[var(--color-accent)]" />
          {!compact && <span className="text-[12px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Team</span>}
          <Pill tone="neutral">{teamMembers.length + 1}</Pill>
        </div>
        {canManageTeam() && !compact && (
          <Button size="sm" variant="ghost" onClick={() => setShowInvite(true)}>
            <UserPlus className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Invite form */}
      {showInvite && (
        <div className="space-y-2 rounded-lg border border-[var(--color-border)] p-2">
          <input
            type="email"
            placeholder="colleague@institution.edu"
            value={inviteEmail}
            onChange={(e) => { setInviteEmail(e.target.value); setInviteError(null); }}
            className="w-full rounded border border-[var(--color-border)] px-2 py-1 text-[12px] outline-none focus:border-[var(--color-accent)]"
          />
          <div className="flex gap-1">
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as any)}
              className="flex-1 rounded border border-[var(--color-border)] px-2 py-1 text-[12px]"
            >
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
            <Button size="sm" onClick={handleInvite}>Add</Button>
          </div>
          {inviteError && <p className="text-[11px] text-[var(--color-exclude)]">{inviteError}</p>}
          <Button size="sm" variant="ghost" onClick={() => { setShowInvite(false); setInviteEmail(""); }} className="w-full">
            Cancel
          </Button>
        </div>
      )}

      {/* Current user (owner) */}
      <div className="flex items-center gap-2 rounded-lg px-2 py-1.5">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-accent)] text-[10px] font-bold text-white">
          You
        </div>
        <div className="flex-1 min-w-0">
          <p className="truncate text-[12px] font-medium">You</p>
        </div>
        <span className={`flex items-center gap-1 text-[11px] ${roleColor("owner")}`}>
          {roleIcon("owner")} Owner
        </span>
      </div>

      {/* Team members */}
      {teamMembers.map((member) => (
        <div
          key={member.id}
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-[var(--color-border)]/20"
        >
          <div className="relative">
            {member.picture ? (
              <img
                src={member.picture}
                alt={member.name}
                className="h-6 w-6 rounded-full"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-border)] text-[10px] font-bold">
                {member.name.charAt(0).toUpperCase()}
              </div>
            )}
            <span
              className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-[var(--color-bg)] ${
                member.status === "online" ? "bg-green-500" : "bg-gray-400"
              }`}
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate text-[12px] font-medium">{member.name}</p>
            <p className="truncate text-[10px] text-[var(--color-text-muted)]">{member.email}</p>
          </div>
          <span className={`flex items-center gap-1 text-[11px] ${roleColor(member.role)}`}>
            {roleIcon(member.role)}
          </span>
          {canManageTeam() && (
            <div className="flex gap-0.5">
              <button
                onClick={() => updateMemberRole(member.id, member.role === "editor" ? "viewer" : "editor")}
                className="rounded p-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-accent)]"
                title="Change role"
              >
                <Edit3 className="h-3 w-3" />
              </button>
              <button
                onClick={() => removeTeamMember(member.id)}
                className="rounded p-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-exclude)]"
                title="Remove"
              >
                <UserMinus className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      ))}

      {teamMembers.length === 0 && !compact && (
        <p className="px-2 py-3 text-center text-[11px] text-[var(--color-text-muted)]">
          No team members yet. Invite collaborators to work together.
        </p>
      )}
    </div>
  );
}
