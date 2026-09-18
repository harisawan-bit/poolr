/**
 * Drive Sync Page — Google Drive Project Management & BYOS Console
 */
import * as React from "react";
import { useAuth } from "../context/AuthContext";
import { useDriveSync, type DriveFile, type SharedProject } from "../lib/drive-sync";
import { GoogleSignInButton } from "../components/GoogleSignIn";
import { Card, Button, Pill } from "../components/ui";
import {
  RefreshCw,
  Upload,
  Download,
  Users,
  Folder,
  AlertCircle,
  CheckCircle,
  Clock,
  Trash2,
  FolderSync,
  ExternalLink,
  Shield,
  FileCheck,
} from "lucide-react";

export default function DriveSyncPage() {
  const { isAuthenticated, getValidToken, user } = useAuth();
  const {
    sync,
    listFiles,
    uploadProject,
    downloadProject,
    loadSharedProjects,
    sharedProjects,
    progress,
    lastResult,
    isSyncing,
  } = useDriveSync();

  const [files, setFiles] = React.useState<DriveFile[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [deleting, setDeleting] = React.useState<string | null>(null);
  const [activeTab, setActiveTab] = React.useState<"myReviews" | "sharedWithMe">("myReviews");
  const [downloadNotice, setDownloadNotice] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!isAuthenticated()) return;
    setLoading(true);
    Promise.all([listFiles(), loadSharedProjects()])
      .then(([f]) => {
        setFiles(f);
      })
      .catch(() => setFiles([]))
      .finally(() => setLoading(false));
  }, [isAuthenticated, listFiles, loadSharedProjects, refreshKey]);

  const handleDownloadAndOpen = async (fileId: string, projectName: string) => {
    try {
      setDownloadNotice(`Downloading "${projectName}" from Google Drive…`);
      const project = await downloadProject(fileId);
      if (project) {
        window.dispatchEvent(new CustomEvent("poolr:loadProject", { detail: project }));
        setDownloadNotice(`Loaded "${projectName}". Switching to workspace…`);
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent("poolr:gopage", { detail: "dashboard" }));
        }, 600);
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "Download failed");
      setDownloadNotice(null);
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
          <div className="flex items-center gap-2.5">
            <FolderSync className="h-5 w-5 text-[var(--color-accent)]" />
            <div>
              <h2 className="text-[15px] font-semibold text-[var(--color-text)]">Connect Google Drive</h2>
              <p className="text-[11.5px] text-[var(--color-text-muted)]">
                Sign in to store systematic review datasets in your own Google Drive.
              </p>
            </div>
          </div>
          <div className="mt-4">
            <GoogleSignInButton onComplete={() => setRefreshKey((k) => k + 1)} />
          </div>
        </Card>

        <Card title="How BYOS Drive Sync Works">
          <ul className="mt-2 space-y-2 text-[12px] text-[var(--color-text-muted)]">
            <li className="flex items-start gap-2">
              <Folder className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-accent)]" />
              <div>
                <strong className="text-[var(--color-text)]">Structured Workspace</strong>
                <p>Files live inside <code>My Drive/Poolr Workspace/Projects/</code>. No cluttered drives.</p>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <Users className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-accent)]" />
              <div>
                <strong className="text-[var(--color-text)]">Native Team Permissions</strong>
                <p>Team members gain Google Drive folder access. Co-review without central servers.</p>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-accent)]" />
              <div>
                <strong className="text-[var(--color-text)]">Institutional Privacy</strong>
                <p>All data remains in your Google Drive or university G-Suite. Zero third-party hosting.</p>
              </div>
            </li>
          </ul>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Active User Card & Quick Action */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <FolderSync className="h-5 w-5 text-[var(--color-accent)]" />
            <div>
              <h2 className="text-[14px] font-semibold text-[var(--color-text)]">
                Google Drive BYOS Workspace
              </h2>
              <p className="text-[11.5px] text-[var(--color-text-muted)]">
                Folder: <code className="font-mono text-[10.5px]">My Drive / Poolr Workspace / Projects /</code>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => setRefreshKey((k) => k + 1)}>
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.open("https://drive.google.com/drive/u/0/my-drive", "_blank")}
            >
              <ExternalLink className="h-3.5 w-3.5 mr-1" /> Open Drive Web
            </Button>
          </div>
        </div>
      </Card>

      {/* Sync Status Banner */}
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

      {/* Download Notice Toast */}
      {downloadNotice && (
        <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 text-[12px] text-blue-400 flex items-center gap-2">
          <FileCheck className="h-4 w-4 shrink-0" />
          <span>{downloadNotice}</span>
        </div>
      )}

      {/* Tab Switcher */}
      <div className="flex gap-1 rounded-lg border border-[var(--color-border)] p-1 bg-[var(--color-surface)]">
        <button
          onClick={() => setActiveTab("myReviews")}
          className={`flex-1 rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors ${
            activeTab === "myReviews"
              ? "bg-[var(--color-accent)] text-white shadow-xs"
              : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          }`}
        >
          My Drive Reviews ({files.length})
        </button>
        <button
          onClick={() => setActiveTab("sharedWithMe")}
          className={`flex-1 rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors ${
            activeTab === "sharedWithMe"
              ? "bg-[var(--color-accent)] text-white shadow-xs"
              : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          }`}
        >
          Shared With Me (Team Reviews) ({sharedProjects.length})
        </button>
      </div>

      {/* Tab 1: My Drive Reviews */}
      {activeTab === "myReviews" && (
        <Card>
          {loading ? (
            <p className="py-8 text-center text-[12.5px] text-[var(--color-text-muted)]">
              Querying Google Drive files…
            </p>
          ) : files.length === 0 ? (
            <div className="py-8 text-center text-[12.5px] text-[var(--color-text-muted)]">
              No Poolr reviews found in your Google Drive. Save your current review to sync it.
            </div>
          ) : (
            <div className="space-y-2">
              {files.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 hover:border-[var(--color-border-strong)] transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Folder className="h-5 w-5 shrink-0 text-[var(--color-accent)]" />
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-[var(--color-text)]">{f.name}</p>
                      <p className="flex items-center gap-2 text-[11px] text-[var(--color-text-muted)]">
                        <Clock className="h-3 w-3" /> {new Date(f.modifiedTime).toLocaleString()}
                        {f.size && <> · {(parseInt(f.size) / 1024).toFixed(1)} KB</>}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDownloadAndOpen(f.id, f.name)}
                      title="Download and open in Poolr"
                    >
                      <Download className="h-3.5 w-3.5 mr-1" /> Open
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={deleting === f.id}
                      onClick={() => handleDelete(f.id, f.name)}
                      title="Delete file"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-[var(--color-exclude)]" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Tab 2: Shared With Me */}
      {activeTab === "sharedWithMe" && (
        <Card>
          {sharedProjects.length === 0 ? (
            <div className="py-8 text-center text-[12.5px] text-[var(--color-text-muted)]">
              No shared reviews discovered. When colleagues share a review folder with your Google account, it will automatically appear here.
            </div>
          ) : (
            <div className="space-y-2">
              {sharedProjects.map((sp) => (
                <div
                  key={sp.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 hover:border-[var(--color-border-strong)] transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Users className="h-5 w-5 shrink-0 text-[var(--color-accent)]" />
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-[var(--color-text)]">{sp.name}</p>
                      <p className="text-[11px] text-[var(--color-text-muted)]">
                        Shared by: <strong>{sp.owner.name}</strong> ({sp.owner.email})
                      </p>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => handleDownloadAndOpen(sp.driveFileId, sp.name)}
                  >
                    <Download className="h-3.5 w-3.5 mr-1" /> Open Team Review
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
