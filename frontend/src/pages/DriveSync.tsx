/**
 * Drive Sync Page — Google Drive project management.
 *
 * Shows sync status, remote files, conflicts, and team membership.
 */
import * as React from "react";
import { useAuth } from "../context/AuthContext";
import { useDriveSync, type DriveFile } from "../lib/drive-sync";
import { GoogleSignInButton } from "../components/GoogleSignIn";
import { Card, Button, Pill } from "../components/ui";
import { RefreshCw, Upload, Download, Users, Folder, AlertCircle, CheckCircle, Clock, Trash2 } from "lucide-react";

export default function DriveSyncPage() {
  const { isAuthenticated, getValidToken } = useAuth();
  const { sync, listFiles, uploadProject, downloadProject, progress, lastResult, isSyncing } = useDriveSync();
  const [files, setFiles] = React.useState<DriveFile[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [deleting, setDeleting] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!isAuthenticated()) return;
    setLoading(true);
    listFiles()
      .then(setFiles)
      .catch(() => setFiles([]))
      .finally(() => setLoading(false));
  }, [isAuthenticated, listFiles, refreshKey]);

  const handleUpload = async (project: any) => {
    await uploadProject(project);
    setRefreshKey((k) => k + 1);
  };

  const handleDownload = async (fileId: string) => {
    const project = await downloadProject(fileId);
    if (project) {
      window.dispatchEvent(new CustomEvent("poolr:loadProject", { detail: project }));
    }
  };

  const handleDelete = async (fileId: string, fileName: string) => {
    if (!confirm(`Delete "${fileName}" from Google Drive? This cannot be undone.`)) return;
    setDeleting(fileId);
    try {
      const token = await getValidToken();
      if (token) {
        const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`Delete failed (${res.status})`);
      }
      setRefreshKey((k) => k + 1);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(null);
    }
  };

  if (!isAuthenticated()) {
    return (
      <div className="mx-auto max-w-md space-y-6">
        <Card>
          <h2 className="text-[15px] font-semibold">Connect Google Drive</h2>
          <p className="mt-2 text-[12.5px] text-[var(--color-text-muted)]">
            Sign in with your Google account to sync projects across devices and collaborate with your team.
          </p>
          <div className="mt-4">
            <GoogleSignInButton onComplete={() => setRefreshKey((k) => k + 1)} />
          </div>
        </Card>

        <Card>
          <h3 className="text-[13px] font-semibold">What does Google sync do?</h3>
          <ul className="mt-2 space-y-2 text-[12.5px] text-[var(--color-text-muted)]">
            <li className="flex items-start gap-2">
              <Upload className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-accent)]" />
              Back up projects to your Drive automatically
            </li>
            <li className="flex items-start gap-2">
              <Download className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-accent)]" />
              Resume work on any device with Poolr installed
            </li>
            <li className="flex items-start gap-2">
              <Users className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-accent)]" />
              Invite team members to screen and extract together
            </li>
            <li className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-accent)]" />
              Detect and resolve edit conflicts
            </li>
          </ul>
        </Card>

        <Card>
          <h3 className="text-[13px] font-semibold">Privacy & Security</h3>
          <ul className="mt-2 space-y-1.5 text-[12.5px] text-[var(--color-text-muted)]">
            <li>• Only scopes for Drive file access and profile info</li>
            <li>• Projects stored in your own Google Drive</li>
            <li>• No data shared with Poolr servers (we have none)</li>
            <li>• Revoke access anytime from your Google Account</li>
          </ul>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Sync status banner */}
      {isSyncing && (
        <Card>
          <div className="flex items-center gap-3">
            <RefreshCw className="h-4 w-4 animate-spin text-[var(--color-accent)]" />
            <div className="flex-1">
              <p className="text-[13px] font-medium">{progress.message}</p>
              {progress.total > 0 && (
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-border)]">
                  <div
                    className="h-full rounded-full bg-[var(--color-accent)] transition-all"
                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                  />
                </div>
              )}
            </div>
            <Pill tone="neutral">
              {progress.phase === "uploading" && "Uploading…"}
              {progress.phase === "downloading" && "Downloading…"}
              {progress.phase === "comparing" && `${progress.current}/${progress.total}`}
              {progress.phase === "listing" && "Listing…"}
            </Pill>
          </div>
        </Card>
      )}

      {/* Last result summary */}
      {lastResult && !isSyncing && (
        <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
          {lastResult.uploaded > 0 && (
            <Pill tone="include"><CheckCircle className="h-3 w-3" /> {lastResult.uploaded} uploaded</Pill>
          )}
          {lastResult.downloaded > 0 && (
            <Pill tone="include"><CheckCircle className="h-3 w-3" /> {lastResult.downloaded} downloaded</Pill>
          )}
          {lastResult.conflicts.length > 0 && (
            <Pill tone="warning"><AlertCircle className="h-3 w-3" /> {lastResult.conflicts.length} conflicts</Pill>
          )}
          {lastResult.errors.length > 0 && (
            <Pill tone="exclude"><AlertCircle className="h-3 w-3" /> {lastResult.errors.length} errors</Pill>
          )}
          <button
            onClick={() => setRefreshKey((k) => k + 1)}
            className="ml-auto text-[12px] text-[var(--color-accent)] hover:underline"
          >
            Refresh
          </button>
        </div>
      )}

      {/* Drive files list */}
      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Folder className="h-4 w-4 text-[var(--color-accent)]" />
            <h3 className="text-[13px] font-semibold">Drive Projects</h3>
            <Pill tone="neutral">{files.length}</Pill>
          </div>
          <Button size="sm" onClick={() => setRefreshKey((k) => k + 1)}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        </div>

        {loading ? (
          <p className="mt-3 text-[12.5px] text-[var(--color-text-muted)]">Loading Drive files…</p>
        ) : files.length === 0 ? (
          <p className="mt-3 text-[12.5px] text-[var(--color-text-muted)]">
            No Poolr projects in Drive yet. Save a project locally, then click Sync to upload.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {files.map((f) => (
              <div
                key={f.id}
                className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] px-3 py-2"
              >
                <div className="flex-1 min-w-0">
                  <p className="truncate text-[13px] font-medium">{f.name}</p>
                  <p className="mt-0.5 flex items-center gap-2 text-[11px] text-[var(--color-text-muted)]">
                    <Clock className="h-3 w-3" />
                    {new Date(f.modifiedTime).toLocaleString()}
                    {f.size && <> · {(parseInt(f.size) / 1024).toFixed(1)} KB</>}
                  </p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => handleDownload(f.id)}>
                  <Download className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={deleting === f.id}
                  onClick={() => handleDelete(f.id, f.name)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
