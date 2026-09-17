/**
 * Activity Feed — shows recent team actions and project events.
 */
import { useCollaboration } from "../context/CollaborationContext";
import { Activity, FileText, Users, Upload, Download, MessageSquare, Edit3, Trash2 } from "lucide-react";

export function ActivityFeed({ compact = false }: { compact?: boolean }) {
  const { activityFeed } = useCollaboration();

  const recentEvents = activityFeed.slice(-50).reverse();

  const actionIcon = (action: string) => {
    if (action.includes("upload")) return <Upload className="h-3 w-3" />;
    if (action.includes("download")) return <Download className="h-3 w-3" />;
    if (action.includes("comment")) return <MessageSquare className="h-3 w-3" />;
    if (action.includes("team member")) return <Users className="h-3 w-3" />;
    if (action.includes("edit") || action.includes("update")) return <Edit3 className="h-3 w-3" />;
    if (action.includes("delete") || action.includes("remove")) return <Trash2 className="h-3 w-3" />;
    return <FileText className="h-3 w-3" />;
  };

  return (
    <div className={`flex flex-col ${compact ? "gap-1" : "gap-3"}`}>
      <div className="flex items-center gap-2">
        <Activity className="h-4 w-4 text-[var(--color-accent)]" />
        {!compact && (
          <span className="text-[12px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
            Activity
          </span>
        )}
      </div>

      {recentEvents.length === 0 ? (
        <p className={`text-[11px] text-[var(--color-text-muted)] ${compact ? "" : "py-2 text-center"}`}>
          No activity yet.
        </p>
      ) : (
        <div className="space-y-1">
          {recentEvents.slice(0, compact ? 5 : 20).map((event) => (
            <div
              key={event.id}
              className="flex items-start gap-2 rounded px-2 py-1 text-[11px] hover:bg-[var(--color-border)]/20"
            >
              <span className="mt-0.5 text-[var(--color-text-muted)]">
                {actionIcon(event.action)}
              </span>
              <div className="flex-1 min-w-0">
                <p>
                  <span className="font-medium">{event.userName}</span>{" "}
                  <span className="text-[var(--color-text-muted)]">{event.action}</span>{" "}
                  <span className="font-medium">{event.target}</span>
                </p>
                {event.details && (
                  <p className="truncate text-[10px] text-[var(--color-text-muted)]">
                    {event.details}
                  </p>
                )}
              </div>
              <span className="shrink-0 text-[10px] text-[var(--color-text-muted)]">
                {formatRelativeTime(event.timestamp)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatRelativeTime(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diff = now - then;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}
