"use client";

/** 3.1 Collaboration indicators — shows last edit, online status. */

export interface CollaborationEvent {
  id: string;
  userId: string;
  userName: string;
  avatar: string;
  timestamp: string;
  action: string;
  target: string;
}

export function getCollaborationPlaceholder(): { events: CollaborationEvent[]; onlineUsers: Array<{ id: string; name: string; avatar: string }> } {
  return { events: [], onlineUsers: [] };
}
