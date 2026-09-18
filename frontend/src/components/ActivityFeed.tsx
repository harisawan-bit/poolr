/**
 * Activity Feed — shows recent team actions and project events.
 */
import { useCollaboration } from "../context/CollaborationContext";
import { Activity, FileText, Users, Upload, Download, MessageSquare, Edit3, Trash2 } from "lucide-react";

export function ActivityFeed({ compact = false }: { compact?: boolean }) {
  const { changeDeltas } = useCollaboration();

  const recentEvents = (changeDeltas || []).slice(-50).reverse();

  const actionIcon = (section: string) => {
    if (section === "screening") return <Edit3 className="h-3 w-3" />;
    if (section === "extraction") return <FileText className="h-3 w-3" />;
    if (section === "rob") return <Activity className="h-3 w-3" />;
    if (section === "meta") return <Activity className="h-3 w-3" />;
    if (section === "manuscript") return <FileText className="h-3 w-3" />;
    return <FileText className="h-3 w-3" />;
  };

  return (
    <div className={`flex flex-col ${compact ? "gap-1" : "gap-3"}`}>
      <div className="flex items-center gap-2">
        <Activity className="h-4 w-4 text-[var(--color-accent)]" />
        {!compact && (
          <span className="text-[12px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
            Activity Trail
          </span>
        )}
      </div>

      {recentEvents.length === 0 ? (
        <p className={`text-[11px] text-[var(--color-text-muted)] ${compact ? "" : "py-2 text-center"}`}>
          No audit activity logged yet.
        </p>
      ) : (
        <div className="space-y-1">
          {recentEvents.slice(0, compact ? 5 : 20).map((event) => (
            <div
              key={event.id}
              className="flex items-start gap-2 rounded px-2 py-1 text-[11px] hover:bg-[var(--color-border)]/20"
            >
              <span className="mt-0.5 text-[var(--color-text-muted)]">
                {actionIcon(event.section)}
              </span>
              <div className="flex-1 min-w-0">
                <p>
                  <span className="font-medium">{event.authorName}</span>{" "}
                  <span className="text-[var(--color-text-muted)]">modified</span>{" "}
                  <span className="font-medium">{event.section}</span>
                </p>
                {event.description && (
                  <p className="truncate text-[10px] text-[var(--color-text-muted)]">
                    {event.description}
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
