import * as React from "react";
import { useCollaboration, type ReviewStep, type Comment } from "../context/CollaborationContext";
import { MessageSquare, Send, CheckCircle2, Trash2, X, Plus } from "lucide-react";
import { Button, Pill } from "./ui";

interface StepCommentsProps {
  step: ReviewStep;
  targetId?: string;
  stepTitle?: string;
}

export function StepCommentsButton({ step, targetId, stepTitle }: StepCommentsProps) {
  const { getCommentsForStep } = useCollaboration();
  const [open, setOpen] = React.useState(false);
  const comments = getCommentsForStep(step, targetId);
  const unresolved = comments.filter((c) => !c.resolved).length;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 text-[12px] font-medium text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-border-strong)] hover:text-[var(--color-text)]"
        title={`Comments for ${stepTitle || step}`}
      >
        <MessageSquare className="h-3.5 w-3.5" />
        <span>Comments</span>
        {unresolved > 0 && (
          <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[var(--color-accent)] px-1 text-[10px] font-bold text-white">
            {unresolved}
          </span>
        )}
      </button>

      {open && (
        <StepCommentsModal
          step={step}
          targetId={targetId}
          stepTitle={stepTitle}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

export function StepCommentsModal({
  step,
  targetId,
  stepTitle,
  onClose,
}: StepCommentsProps & { onClose: () => void }) {
  const { getCommentsForStep, addComment, resolveComment, removeComment } = useCollaboration();
  const [text, setText] = React.useState("");
  const comments = getCommentsForStep(step, targetId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    addComment(step, text.trim(), targetId);
    setText("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/40 backdrop-blur-xs">
      <div className="flex h-full w-full max-w-md flex-col bg-[var(--color-surface)] shadow-2xl border-l border-[var(--color-border)] animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] p-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-[var(--color-accent)]" />
            <h3 className="text-[13.5px] font-semibold text-[var(--color-text)]">
              {stepTitle || step.toUpperCase()} Comments
            </h3>
            <Pill tone="neutral">{comments.length}</Pill>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Comment Thread List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {comments.length === 0 ? (
            <div className="py-12 text-center text-[12px] text-[var(--color-text-muted)]">
              No comments for this step yet. Collaborators can leave notes, questions, and decisions here.
            </div>
          ) : (
            comments.map((c) => (
              <div
                key={c.id}
                className={`rounded-lg border p-3 text-[12px] transition-colors ${
                  c.resolved
                    ? "border-[var(--color-border)] bg-[var(--color-surface-2)] opacity-70"
                    : "border-[var(--color-border-strong)] bg-[var(--color-surface)] shadow-xs"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[var(--color-text)]">{c.authorName}</span>
                    <span className="text-[10.5px] text-[var(--color-text-muted)]">
                      {new Date(c.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => resolveComment(c.id)}
                      className={`rounded p-1 text-[11px] ${
                        c.resolved ? "text-green-500 font-medium" : "text-[var(--color-text-muted)] hover:text-green-500"
                      }`}
                      title={c.resolved ? "Mark unresolved" : "Mark resolved"}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => removeComment(c.id)}
                      className="rounded p-1 text-[var(--color-text-muted)] hover:text-red-500"
                      title="Delete comment"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <p className="mt-2 leading-relaxed text-[var(--color-text)]">{c.text}</p>
                {c.resolved && (
                  <div className="mt-2 text-[10.5px] text-green-500 font-medium flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Resolved
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Input Footer */}
        <form onSubmit={handleSubmit} className="border-t border-[var(--color-border)] p-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={`Leave note for ${stepTitle || step}...`}
              className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-[12px] text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)] focus:outline-none"
            />
            <Button size="sm" type="submit" disabled={!text.trim()}>
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default StepCommentsButton;
