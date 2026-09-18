import * as React from "react";
import { useCollaboration } from "../context/CollaborationContext";
import { Card, Button, Pill } from "./ui";
import { AlertTriangle, ArrowRight, Check, X } from "lucide-react";

export function ConflictResolverModal() {
  const { activeConflict, resolveActiveConflict } = useCollaboration();
  const [customVal, setCustomVal] = React.useState("");

  React.useEffect(() => {
    if (activeConflict) {
      setCustomVal(
        typeof activeConflict.localValue === "object"
          ? JSON.stringify(activeConflict.localValue, null, 2)
          : String(activeConflict.localValue ?? "")
      );
    }
  }, [activeConflict]);

  if (!activeConflict) return null;

  const renderVal = (v: unknown) => {
    if (v === null || v === undefined) return <em className="text-[var(--color-text-muted)]">empty</em>;
    if (typeof v === "object") return <pre className="font-mono text-[11px] whitespace-pre-wrap">{JSON.stringify(v, null, 2)}</pre>;
    return <span>{String(v)}</span>;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl animate-in fade-in zoom-in-95 duration-200">
        <Card className="border-[var(--color-border-strong)] shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-[14px] font-semibold text-[var(--color-text)]">
                  Concurrent Edit Conflict Detected
                </h2>
                <p className="text-[11px] text-[var(--color-text-muted)]">
                  Section: <strong className="text-[var(--color-text)]">{activeConflict.section}</strong> · Field:{" "}
                  <code className="rounded bg-[var(--color-surface-2)] px-1 py-0.5 text-[10.5px] font-mono">{activeConflict.field}</code>
                </p>
              </div>
            </div>
            <Pill tone="warning">Action Required</Pill>
          </div>

          {/* Diff Grid */}
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* Local Version */}
            <div className="flex flex-col justify-between rounded-lg border border-blue-500/30 bg-blue-500/5 p-3.5">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11.5px] font-semibold text-blue-400">Your Local Version</span>
                  <Pill tone="info">Uncommitted</Pill>
                </div>
                <div className="mt-2.5 max-h-40 overflow-y-auto rounded bg-[var(--color-surface)] p-2.5 text-[12px] border border-[var(--color-border)]">
                  {renderVal(activeConflict.localValue)}
                </div>
              </div>
              <Button
                variant="primary"
                size="sm"
                className="mt-3 w-full"
                onClick={() => resolveActiveConflict("local")}
              >
                <Check className="h-3.5 w-3.5 mr-1" /> Keep My Version
              </Button>
            </div>

            {/* Remote Version */}
            <div className="flex flex-col justify-between rounded-lg border border-purple-500/30 bg-purple-500/5 p-3.5">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11.5px] font-semibold text-purple-400">
                    {activeConflict.remoteAuthor || "Teammate"}'s Version
                  </span>
                  <span className="text-[10px] text-[var(--color-text-muted)]">
                    {new Date(activeConflict.remoteTimestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div className="mt-2.5 max-h-40 overflow-y-auto rounded bg-[var(--color-surface)] p-2.5 text-[12px] border border-[var(--color-border)]">
                  {renderVal(activeConflict.remoteValue)}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 w-full"
                onClick={() => resolveActiveConflict("remote")}
              >
                <ArrowRight className="h-3.5 w-3.5 mr-1" /> Accept Teammate's
              </Button>
            </div>
          </div>

          {/* Custom Merge Option */}
          <div className="mt-4 border-t border-[var(--color-border)] pt-3">
            <details className="text-[12px] text-[var(--color-text-muted)]">
              <summary className="cursor-pointer font-medium hover:text-[var(--color-text)]">
                Or merge manually into custom text
              </summary>
              <div className="mt-2 space-y-2">
                <textarea
                  value={customVal}
                  onChange={(e) => setCustomVal(e.target.value)}
                  rows={3}
                  className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-2 text-[12px] font-mono text-[var(--color-text)] focus:border-[var(--color-accent)] focus:outline-none"
                  placeholder="Combine or edit the final content here..."
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => resolveActiveConflict("custom", customVal)}
                >
                  Save Merged Value
                </Button>
              </div>
            </details>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default ConflictResolverModal;
