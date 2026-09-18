/**
 * Comments Panel — inline commenting system for collaboration.
 */
import * as React from "react";
import { useCollaboration, type ReviewStep, type Comment } from "../context/CollaborationContext";
import { MessageSquare, Check, X, Send } from "lucide-react";
import { Button, Pill } from "./ui";

export function CommentsPanel({
  targetType = "project",
  targetId,
  compact = false,
}: {
  targetType?: ReviewStep | string;
  targetId?: string;
  compact?: boolean;
}) {
  const { comments, addComment, resolveComment, removeComment, currentUserRole } = useCollaboration();
  const [newComment, setNewComment] = React.useState("");
  const step = (targetType as ReviewStep) || "project";

  const filtered = comments.filter(
    (c) => c.step === step && (targetId ? c.targetId === targetId : true)
  );
  const unresolved = filtered.filter((c) => !c.resolved);
  const resolved = filtered.filter((c) => c.resolved);

  const handleSubmit = () => {
    if (!newComment.trim()) return;
    addComment(step, newComment.trim(), targetId);
    setNewComment("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const canComment = currentUserRole !== "viewer";

  return (
    <div className={`flex flex-col ${compact ? "gap-1" : "gap-3"}`}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-[var(--color-accent)]" />
        {!compact && (
          <span className="text-[12px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
            Comments
          </span>
        )}
        {unresolved.length > 0 && <Pill tone="warning">{unresolved.length}</Pill>}
      </div>

      {/* New comment input */}
      {canComment && (
        <div className="space-y-1">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add a comment… (Ctrl+Enter to send)"
            rows={2}
            className="w-full resize-none rounded-lg border border-[var(--color-border)] px-2 py-1.5 text-[12px] outline-none focus:border-[var(--color-accent)]"
          />
          <Button size="sm" onClick={handleSubmit} disabled={!newComment.trim()}>
            <Send className="h-3 w-3" /> Send
          </Button>
        </div>
      )}

      {/* Unresolved comments */}
      {unresolved.length > 0 && (
        <div className="space-y-2">
          {unresolved.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              onResolve={() => resolveComment(comment.id)}
              onRemove={() => removeComment(comment.id)}
            />
          ))}
        </div>
      )}

      {/* Resolved comments (collapsed) */}
      {resolved.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
            {resolved.length} resolved
          </summary>
          <div className="mt-2 space-y-2">
            {resolved.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                onResolve={() => resolveComment(comment.id)}
                onRemove={() => removeComment(comment.id)}
                isResolved
              />
            ))}
          </div>
        </details>
      )}

      {filtered.length === 0 && !compact && (
        <p className="py-2 text-center text-[11px] text-[var(--color-text-muted)]">
          No comments yet. Start a discussion.
        </p>
      )}
    </div>
  );
}

function CommentItem({
  comment,
  onResolve,
  onRemove,
  isResolved,
}: {
  comment: Comment;
  onResolve: () => void;
  onRemove: () => void;
  isResolved?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border px-2 py-1.5 ${
        isResolved
          ? "border-[var(--color-border)]/50 opacity-60"
          : "border-[var(--color-border)]"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-medium">{comment.authorName}</p>
          <p className={`mt-0.5 text-[12px] ${isResolved ? "line-through" : ""}`}>
            {comment.text}
          </p>
          <p className="mt-0.5 text-[10px] text-[var(--color-text-muted)]">
            {new Date(comment.timestamp).toLocaleString()}
          </p>
        </div>
        <div className="flex gap-0.5">
          {!isResolved && (
            <button
              onClick={onResolve}
              className="rounded p-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-include)]"
              title="Resolve"
            >
              <Check className="h-3 w-3" />
            </button>
          )}
          <button
            onClick={onRemove}
            className="rounded p-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-exclude)]"
            title="Delete"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
