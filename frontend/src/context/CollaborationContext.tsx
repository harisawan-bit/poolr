/**
 * CollaborationContext — Team state management for shared projects.
 *
 * Manages team members, roles, shared projects, and real-time
 * collaboration features (commenting, activity feed).
 */
import * as React from "react";
import { useAuth } from "./AuthContext";

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  picture?: string;
  role: "owner" | "editor" | "viewer";
  status: "online" | "offline";
  lastSeen?: string;
}

export interface Comment {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  timestamp: string;
  resolved: boolean;
  targetType: "project" | "study" | "extraction" | "rob";
  targetId?: string;
}

export interface ActivityEvent {
  id: string;
  userId: string;
  userName: string;
  action: string;
  target: string;
  timestamp: string;
  details?: string;
}

export interface CollaborationState {
  teamMembers: TeamMember[];
  comments: Comment[];
  activityFeed: ActivityEvent[];
  currentUserRole: "owner" | "editor" | "viewer" | null;
  isConnected: boolean;
}

interface CollaborationContextValue extends CollaborationState {
  addComment: (text: string, targetType: Comment["targetType"], targetId?: string) => void;
  resolveComment: (commentId: string) => void;
  removeComment: (commentId: string) => void;
  addTeamMember: (email: string, role: "editor" | "viewer") => Promise<void>;
  removeTeamMember: (userId: string) => void;
  updateMemberRole: (userId: string, role: "editor" | "viewer") => void;
  canEdit: () => boolean;
  canManageTeam: () => boolean;
  logActivity: (action: string, target: string, details?: string) => void;
}

export const CollaborationContext = React.createContext<CollaborationContextValue | null>(null);

const COLLAB_STORAGE_KEY = "poolr.collaboration";

function readStoredCollab(): CollaborationState {
  try {
    const raw = localStorage.getItem(COLLAB_STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw);
    return {
      teamMembers: parsed.teamMembers || [],
      comments: parsed.comments || [],
      activityFeed: parsed.activityFeed || [],
      currentUserRole: parsed.currentUserRole || null,
      isConnected: false,
    };
  } catch {
    return emptyState();
  }
}

function emptyState(): CollaborationState {
  return {
    teamMembers: [],
    comments: [],
    activityFeed: [],
    currentUserRole: null,
    isConnected: false,
  };
}

function writeStoredCollab(state: CollaborationState) {
  try {
    localStorage.setItem(
      COLLAB_STORAGE_KEY,
      JSON.stringify({
        teamMembers: state.teamMembers,
        comments: state.comments,
        activityFeed: state.activityFeed.slice(-200), // Keep last 200 events
        currentUserRole: state.currentUserRole,
      })
    );
  } catch {}
}

export function CollaborationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = React.useState<CollaborationState>(() => readStoredCollab());

  // Persist state changes
  React.useEffect(() => {
    writeStoredCollab(state);
  }, [state]);

  const canEdit = React.useCallback(() => {
    return state.currentUserRole === "owner" || state.currentUserRole === "editor";
  }, [state.currentUserRole]);

  const canManageTeam = React.useCallback(() => {
    return state.currentUserRole === "owner";
  }, [state.currentUserRole]);

  const addComment = React.useCallback(
    (text: string, targetType: Comment["targetType"], targetId?: string) => {
      if (!user) return;
      const comment: Comment = {
        id: `c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        authorId: user.sub,
        authorName: user.name,
        text,
        timestamp: new Date().toISOString(),
        resolved: false,
        targetType,
        targetId,
      };
      setState((s) => ({ ...s, comments: [...s.comments, comment] }));
      setState((s) => ({
        ...s,
        activityFeed: [
          ...s.activityFeed,
          {
            id: `a_${Date.now()}`,
            userId: user.sub,
            userName: user.name,
            action: "commented",
            target: targetType + (targetId ? `/${targetId}` : ""),
            timestamp: new Date().toISOString(),
            details: text.slice(0, 60),
          },
        ],
      }));
    },
    [user]
  );

  const resolveComment = React.useCallback((commentId: string) => {
    setState((s) => ({
      ...s,
      comments: s.comments.map((c) => (c.id === commentId ? { ...c, resolved: true } : c)),
    }));
  }, []);

  const removeComment = React.useCallback((commentId: string) => {
    setState((s) => ({
      ...s,
      comments: s.comments.filter((c) => c.id !== commentId),
    }));
  }, []);

  const addTeamMember = React.useCallback(
    async (email: string, role: "editor" | "viewer") => {
      if (!user) return;
      const member: TeamMember = {
        id: `tm_${Date.now()}`,
        name: email.split("@")[0],
        email,
        role,
        status: "offline",
        lastSeen: undefined,
      };
      setState((s) => ({
        ...s,
        teamMembers: [...s.teamMembers, member],
        activityFeed: [
          ...s.activityFeed,
          {
            id: `a_${Date.now()}`,
            userId: user.sub,
            userName: user.name,
            action: "added team member",
            target: email,
            timestamp: new Date().toISOString(),
            details: `as ${role}`,
          },
        ],
      }));
    },
    [user]
  );

  const removeTeamMember = React.useCallback(
    (userId: string) => {
      if (!user) return;
      const member = state.teamMembers.find((m) => m.id === userId);
      setState((s) => ({
        ...s,
        teamMembers: s.teamMembers.filter((m) => m.id !== userId),
        activityFeed: [
          ...s.activityFeed,
          {
            id: `a_${Date.now()}`,
            userId: user.sub,
            userName: user.name,
            action: "removed team member",
            target: member?.email || userId,
            timestamp: new Date().toISOString(),
          },
        ],
      }));
    },
    [user, state.teamMembers]
  );

  const updateMemberRole = React.useCallback(
    (userId: string, role: "editor" | "viewer") => {
      setState((s) => ({
        ...s,
        teamMembers: s.teamMembers.map((m) => (m.id === userId ? { ...m, role } : m)),
      }));
    },
    []
  );

  const logActivity = React.useCallback(
    (action: string, target: string, details?: string) => {
      if (!user) return;
      setState((s) => ({
        ...s,
        activityFeed: [
          ...s.activityFeed,
          {
            id: `a_${Date.now()}`,
            userId: user.sub,
            userName: user.name,
            action,
            target,
            timestamp: new Date().toISOString(),
            details,
          },
        ],
      }));
    },
    [user]
  );

  const value = React.useMemo<CollaborationContextValue>(
    () => ({
      ...state,
      addComment,
      resolveComment,
      removeComment,
      addTeamMember,
      removeTeamMember,
      updateMemberRole,
      canEdit,
      canManageTeam,
      logActivity,
    }),
    [
      state,
      addComment,
      resolveComment,
      removeComment,
      addTeamMember,
      removeTeamMember,
      updateMemberRole,
      canEdit,
      canManageTeam,
      logActivity,
    ]
  );

  return <CollaborationContext.Provider value={value}>{children}</CollaborationContext.Provider>;
}

export function useCollaboration(): CollaborationContextValue {
  const ctx = React.useContext(CollaborationContext);
  if (!ctx) throw new Error("useCollaboration must be used within CollaborationProvider");
  return ctx;
}
