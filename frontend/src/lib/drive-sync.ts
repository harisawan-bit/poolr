/**
 * Google Drive Sync Engine & BYOS (Bring Your Own Storage) Architecture
 *
 * Provides structured, bi-directional sync between local Poolr projects and Google Drive.
 * All project files and sub-manifests are organized in a clean hierarchy:
 *   My Drive/
 *   └── Poolr Workspace/
 *       └── Projects/
 *           └── {ProjectName}_{ProjectId}/
 *               ├── project.json
 *               ├── permissions.json
 *               ├── changelog.json
 *               ├── comments.json
 *               ├── authorship.json
 *               └── manuscript.json
 */

import * as React from "react";
import type { Project } from "../lib/project";
import { normalizeProject } from "../lib/project";
import { useAuth } from "../context/AuthContext";

// ── Types ──

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  size?: string;
  parents?: string[];
  appProperties?: Record<string, string>;
}

export interface SyncConflict {
  projectId: string;
  projectName: string;
  localModified: string;
  remoteModified: string;
  localPath: string;
  remoteFileId: string;
  remoteData?: Project;
}

export interface SyncResult {
  uploaded: number;
  downloaded: number;
  conflicts: SyncConflict[];
  errors: string[];
  timestamp: string;
}

export interface SyncProgress {
  phase: "idle" | "listing" | "comparing" | "uploading" | "downloading" | "resolving" | "done" | "error";
  current: number;
  total: number;
  message: string;
}

export interface TeamMember {
  email: string;
  name: string;
  picture?: string;
  role: "owner" | "editor" | "reviewer" | "viewer";
  joinedAt: string;
  activeMinutes?: number;
}

export interface SharedProject {
  id: string;
  name: string;
  folderId: string;
  owner: TeamMember;
  members: TeamMember[];
  driveFileId: string;
  lastSyncedAt: string | null;
  status: "synced" | "pending" | "conflict" | "error";
}

// ── API helpers ──

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";

async function driveFetch(
  token: string,
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const res = await fetch(`${DRIVE_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`Drive API ${path} failed (${res.status}): ${err}`);
  }
  return res;
}

// ── Drive Sync Engine ──

export class DriveSyncEngine {
  private token: string;
  private onProgress: ((p: SyncProgress) => void) | null = null;

  constructor(token: string, onProgress?: (p: SyncProgress) => void) {
    this.token = token;
    this.onProgress = onProgress || null;
  }

  private report(progress: SyncProgress) {
    if (this.onProgress) this.onProgress(progress);
  }

  /**
   * Get or create the root "Poolr Workspace" folder in user's Drive.
   */
  async getOrCreateRootFolder(): Promise<string> {
    const res = await driveFetch(
      this.token,
      "/files?q=name='Poolr Workspace' and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id,name)"
    );
    const json = await res.json();
    if (json.files?.length > 0) {
      return json.files[0].id;
    }

    const createRes = await driveFetch(this.token, "/files?fields=id", {
      method: "POST",
      body: JSON.stringify({
        name: "Poolr Workspace",
        mimeType: "application/vnd.google-apps.folder",
      }),
    });
    const created = await createRes.json();
    return created.id;
  }

  /**
   * Get or create the "Projects" subfolder inside "Poolr Workspace".
   */
  async getOrCreateProjectsFolder(): Promise<string> {
    const rootId = await this.getOrCreateRootFolder();
    const res = await driveFetch(
      this.token,
      `/files?q='${rootId}' in parents and name='Projects' and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id,name)`
    );
    const json = await res.json();
    if (json.files?.length > 0) {
      return json.files[0].id;
    }

    const createRes = await driveFetch(this.token, "/files?fields=id", {
      method: "POST",
      body: JSON.stringify({
        name: "Projects",
        mimeType: "application/vnd.google-apps.folder",
        parents: [rootId],
      }),
    });
    const created = await createRes.json();
    return created.id;
  }

  /**
   * Get or create an isolated folder for a specific project.
   */
  async getOrCreateProjectFolder(projectTitle: string, projectId: string): Promise<string> {
    const projectsFolderId = await this.getOrCreateProjectsFolder();
    const folderName = `${projectTitle.replace(/[/\\?%*:|"<>]/g, "-").trim() || "Untitled"}_${projectId.slice(0, 8)}`;
    
    const res = await driveFetch(
      this.token,
      `/files?q='${projectsFolderId}' in parents and name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id,name)`
    );
    const json = await res.json();
    if (json.files?.length > 0) {
      return json.files[0].id;
    }

    const createRes = await driveFetch(this.token, "/files?fields=id", {
      method: "POST",
      body: JSON.stringify({
        name: folderName,
        mimeType: "application/vnd.google-apps.folder",
        parents: [projectsFolderId],
      }),
    });
    const created = await createRes.json();
    return created.id;
  }

  /**
   * List all Poolr project files in Drive.
   */
  async listProjectFiles(): Promise<DriveFile[]> {
    const res = await driveFetch(
      this.token,
      `/files?q=(name contains '.poolr.json' or name = 'project.json') and trashed=false&fields=files(id,name,modifiedTime,size,parents,appProperties)&orderBy=modifiedTime desc`
    );
    const json = await res.json();
    return json.files || [];
  }

  /**
   * Upload or update a project to Google Drive using RFC 2387 multipart upload.
   * Uploads the full project payload and metadata reliably.
   */
  async uploadProject(
    project: Project,
    existingFileId?: string
  ): Promise<DriveFile> {
    const safeTitle = project.metadata.title?.replace(/[/\\?%*:|"<>]/g, "-").trim() || "Untitled";
    const projectId = (project.metadata as any).id || safeTitle;
    const projectFolderId = await this.getOrCreateProjectFolder(safeTitle, projectId);
    const fileName = "project.json";

    const metadata = {
      name: fileName,
      mimeType: "application/json",
      appProperties: {
        poolrProjectId: projectId,
        poolrTitle: project.metadata.title || "Untitled",
        poolrVersion: project.metadata.version || "0.6.3",
        poolrModified: new Date().toISOString(),
      },
      ...(!existingFileId ? { parents: [projectFolderId] } : {}),
    };

    const body = JSON.stringify(project, null, 2);
    const boundary = "poolr_boundary_" + Date.now();
    const multipartBody = [
      `--${boundary}`,
      "Content-Type: application/json; charset=UTF-8",
      "",
      JSON.stringify(metadata),
      `--${boundary}`,
      "Content-Type: application/json",
      "",
      body,
      `--${boundary}--`,
    ].join("\r\n");

    if (existingFileId) {
      // Update existing file content and metadata
      const res = await fetch(
        `${UPLOAD_API}/files/${existingFileId}?uploadType=multipart&fields=id,name,modifiedTime,size,parents,appProperties`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${this.token}`,
            "Content-Type": `multipart/related; boundary=${boundary}`,
          },
          body: multipartBody,
        }
      );
      if (!res.ok) {
        const err = await res.text().catch(() => "");
        throw new Error(`Update failed (${res.status}): ${err}`);
      }
      return (await res.json()) as DriveFile;
    } else {
      // Create new file
      const res = await fetch(
        `${UPLOAD_API}/files?uploadType=multipart&fields=id,name,modifiedTime,size,parents,appProperties`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.token}`,
            "Content-Type": `multipart/related; boundary=${boundary}`,
          },
          body: multipartBody,
        }
      );
      if (!res.ok) {
        const err = await res.text().catch(() => "");
        throw new Error(`Upload failed (${res.status}): ${err}`);
      }
      return (await res.json()) as DriveFile;
    }
  }

  /**
   * Upload or update an auxiliary subfile (changelog.json, permissions.json, etc.)
   */
  async uploadSubfile(folderId: string, filename: string, data: unknown): Promise<void> {
    const listRes = await driveFetch(
      this.token,
      `/files?q='${folderId}' in parents and name='${filename}' and trashed=false&fields=files(id)`
    );
    const listJson = await listRes.json();
    const existingId = listJson.files?.[0]?.id;

    const body = typeof data === "string" ? data : JSON.stringify(data, null, 2);
    const boundary = "poolr_sub_" + Date.now();
    const metadata = {
      name: filename,
      mimeType: "application/json",
      ...(!existingId ? { parents: [folderId] } : {}),
    };
    const multipartBody = [
      `--${boundary}`,
      "Content-Type: application/json; charset=UTF-8",
      "",
      JSON.stringify(metadata),
      `--${boundary}`,
      "Content-Type: application/json",
      "",
      body,
      `--${boundary}--`,
    ].join("\r\n");

    const endpoint = existingId
      ? `${UPLOAD_API}/files/${existingId}?uploadType=multipart`
      : `${UPLOAD_API}/files?uploadType=multipart`;

    await fetch(endpoint, {
      method: existingId ? "PATCH" : "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    });
  }

  /**
   * Download a project from Google Drive.
   */
  async downloadProject(fileId: string): Promise<Project> {
    const res = await driveFetch(
      this.token,
      `/files/${fileId}?alt=media`,
      { headers: {} }
    );
    const raw = await res.json();
    return normalizeProject(raw);
  }

  /**
   * Download an auxiliary subfile from a project folder.
   */
  async downloadSubfile<T>(folderId: string, filename: string): Promise<T | null> {
    try {
      const listRes = await driveFetch(
        this.token,
        `/files?q='${folderId}' in parents and name='${filename}' and trashed=false&fields=files(id)`
      );
      const listJson = await listRes.json();
      const fileId = listJson.files?.[0]?.id;
      if (!fileId) return null;

      const res = await driveFetch(this.token, `/files/${fileId}?alt=media`);
      return (await res.json()) as T;
    } catch {
      return null;
    }
  }

  /**
   * Delete a project file or folder from Drive.
   */
  async deleteProject(fileId: string): Promise<void> {
    await driveFetch(this.token, `/files/${fileId}`, { method: "DELETE" });
  }

  /**
   * Discover projects shared with the user by team members.
   */
  async fetchSharedProjects(): Promise<SharedProject[]> {
    try {
      const res = await driveFetch(
        this.token,
        "/files?q=sharedWithMe=true and trashed=false and (mimeType='application/vnd.google-apps.folder' or name contains '.poolr.json')&fields=files(id,name,owners,modifiedTime,mimeType,parents)&orderBy=modifiedTime desc"
      );
      const json = await res.json();
      const files = json.files || [];
      const shared: SharedProject[] = [];

      for (const f of files) {
        if (f.mimeType === "application/vnd.google-apps.folder") {
          const innerRes = await driveFetch(
            this.token,
            `/files?q='${f.id}' in parents and (name='project.json' or name contains '.poolr.json') and trashed=false&fields=files(id,name,modifiedTime)`
          );
          const innerJson = await innerRes.json();
          if (innerJson.files?.length > 0) {
            const ownerInfo = f.owners?.[0];
            shared.push({
              id: f.id,
              name: f.name,
              folderId: f.id,
              owner: {
                email: ownerInfo?.emailAddress || "owner@team.org",
                name: ownerInfo?.displayName || ownerInfo?.emailAddress || "Team Lead",
                picture: ownerInfo?.photoLink,
                role: "owner",
                joinedAt: f.modifiedTime,
              },
              members: [],
              driveFileId: innerJson.files[0].id,
              lastSyncedAt: innerJson.files[0].modifiedTime,
              status: "synced",
            });
          }
        } else {
          const ownerInfo = f.owners?.[0];
          shared.push({
            id: f.id,
            name: f.name.replace(".poolr.json", ""),
            folderId: f.parents?.[0] || f.id,
            owner: {
              email: ownerInfo?.emailAddress || "owner@team.org",
              name: ownerInfo?.displayName || ownerInfo?.emailAddress || "Team Lead",
              picture: ownerInfo?.photoLink,
              role: "owner",
              joinedAt: f.modifiedTime,
            },
            members: [],
            driveFileId: f.id,
            lastSyncedAt: f.modifiedTime,
            status: "synced",
          });
        }
      }
      return shared;
    } catch (err) {
      console.warn("Failed to fetch shared projects:", err);
      return [];
    }
  }

  /**
   * Sync local projects with Drive.
   */
  async syncProjects(
    localProjects: Array<{ path: string; project: Project; lastModified: string }>
  ): Promise<SyncResult> {
    const result: SyncResult = {
      uploaded: 0,
      downloaded: 0,
      conflicts: [],
      errors: [],
      timestamp: new Date().toISOString(),
    };

    this.report({ phase: "listing", current: 0, total: 1, message: "Listing Drive files..." });

    let remoteFiles: DriveFile[];
    try {
      remoteFiles = await this.listProjectFiles();
    } catch (e) {
      result.errors.push(`Failed to list Drive files: ${e instanceof Error ? e.message : String(e)}`);
      this.report({ phase: "error", current: 0, total: 1, message: result.errors[0] });
      return result;
    }

    const remoteMap = new Map<string, DriveFile>();
    for (const f of remoteFiles) {
      const projectId = f.appProperties?.poolrProjectId || f.name.replace(".poolr.json", "");
      remoteMap.set(projectId, f);
    }

    this.report({
      phase: "comparing",
      current: 0,
      total: localProjects.length,
      message: "Comparing local and remote reviews...",
    });

    for (let i = 0; i < localProjects.length; i++) {
      const local = localProjects[i];
      const projectId = local.project.metadata.title || "untitled";
      const remote = remoteMap.get(projectId);

      this.report({
        phase: "comparing",
        current: i + 1,
        total: localProjects.length,
        message: `Checking ${projectId}...`,
      });

      if (!remote) {
        try {
          await this.uploadProject(local.project);
          result.uploaded++;
        } catch (e) {
          result.errors.push(`Upload ${projectId}: ${e instanceof Error ? e.message : String(e)}`);
        }
      } else {
        const remoteModified = new Date(remote.modifiedTime).toISOString();
        const localTime = new Date(local.lastModified);
        const remoteTime = new Date(remoteModified);

        if (localTime > remoteTime) {
          try {
            await this.uploadProject(local.project, remote.id);
            result.uploaded++;
          } catch (e) {
            result.errors.push(`Update ${projectId}: ${e instanceof Error ? e.message : String(e)}`);
          }
        } else if (remoteTime > localTime) {
          try {
            const remoteProject = await this.downloadProject(remote.id);
            result.conflicts.push({
              projectId,
              projectName: local.project.metadata.title || "Untitled",
              localModified: local.lastModified,
              remoteModified: remote.modifiedTime,
              localPath: local.path,
              remoteFileId: remote.id,
              remoteData: remoteProject,
            });
          } catch (e) {
            result.errors.push(`Inspect remote ${projectId}: ${e instanceof Error ? e.message : String(e)}`);
          }
        }
      }
    }

    this.report({ phase: "done", current: 1, total: 1, message: "Sync complete" });
    return result;
  }

  /**
   * Share a project folder with a team member via Google Drive Permissions API.
   */
  async shareProjectFolder(
    folderId: string,
    email: string,
    role: "writer" | "commenter" | "reader" = "writer"
  ): Promise<void> {
    await driveFetch(this.token, `/files/${folderId}/permissions?sendNotificationEmail=true`, {
      method: "POST",
      body: JSON.stringify({
        type: "user",
        role: role,
        emailAddress: email,
      }),
    });
  }

  /**
   * List permissions (team members) for a project folder.
   */
  async listSharedMembers(folderId: string): Promise<TeamMember[]> {
    const url = `/files/${folderId}/permissions?fields=permissions(id,displayName,emailAddress,role,photoLink,type)`;
    const res = await driveFetch(this.token, url);
    const json = await res.json();
    return (json.permissions || [])
      .filter((p: any) => p.type === "user")
      .map((p: any) => ({
        email: p.emailAddress,
        name: p.displayName || p.emailAddress,
        picture: p.photoLink,
        role: p.role === "owner" ? "owner" : p.role === "writer" ? "editor" : "viewer",
        joinedAt: new Date().toISOString(),
      }));
  }

  /**
   * Remove a team member's access.
   */
  async removePermission(folderId: string, permissionId: string): Promise<void> {
    const url = `/files/${folderId}/permissions/${permissionId}`;
    await driveFetch(this.token, url, {
      method: "DELETE",
    });
  }
}

// ── React hook for Drive sync ──

export function useDriveSync() {
  const { getValidToken, isAuthenticated } = useAuth();
  const [progress, setProgress] = React.useState<SyncProgress>({
    phase: "idle",
    current: 0,
    total: 0,
    message: "",
  });
  const [lastResult, setLastResult] = React.useState<SyncResult | null>(null);
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [sharedProjects, setSharedProjects] = React.useState<SharedProject[]>([]);

  const sync = React.useCallback(
    async (
      localProjects: Array<{ path: string; project: Project; lastModified: string }>
    ): Promise<SyncResult | null> => {
      if (!isAuthenticated()) return null;
      const token = await getValidToken();
      if (!token) return null;

      setIsSyncing(true);
      try {
        const engine = new DriveSyncEngine(token, setProgress);
        const result = await engine.syncProjects(localProjects);
        setLastResult(result);
        return result;
      } catch (e) {
        const errorResult: SyncResult = {
          uploaded: 0,
          downloaded: 0,
          conflicts: [],
          errors: [e instanceof Error ? e.message : String(e)],
          timestamp: new Date().toISOString(),
        };
        setLastResult(errorResult);
        return errorResult;
      } finally {
        setIsSyncing(false);
      }
    },
    [getValidToken, isAuthenticated]
  );

  const uploadProject = React.useCallback(
    async (project: Project, existingFileId?: string): Promise<DriveFile | null> => {
      if (!isAuthenticated()) return null;
      const token = await getValidToken();
      if (!token) return null;
      const engine = new DriveSyncEngine(token, setProgress);
      return engine.uploadProject(project, existingFileId);
    },
    [getValidToken, isAuthenticated]
  );

  const downloadProject = React.useCallback(
    async (fileId: string): Promise<Project | null> => {
      if (!isAuthenticated()) return null;
      const token = await getValidToken();
      if (!token) return null;
      const engine = new DriveSyncEngine(token, setProgress);
      return engine.downloadProject(fileId);
    },
    [getValidToken, isAuthenticated]
  );

  const listFiles = React.useCallback(async (): Promise<DriveFile[]> => {
    if (!isAuthenticated()) return [];
    const token = await getValidToken();
    if (!token) return [];
    const engine = new DriveSyncEngine(token, setProgress);
    return engine.listProjectFiles();
  }, [getValidToken, isAuthenticated]);

  const loadSharedProjects = React.useCallback(async (): Promise<SharedProject[]> => {
    if (!isAuthenticated()) return [];
    const token = await getValidToken();
    if (!token) return [];
    const engine = new DriveSyncEngine(token, setProgress);
    const shared = await engine.fetchSharedProjects();
    setSharedProjects(shared);
    return shared;
  }, [getValidToken, isAuthenticated]);

  const shareWithTeammate = React.useCallback(
    async (folderId: string, email: string, role: "editor" | "reviewer" | "viewer"): Promise<boolean> => {
      if (!isAuthenticated()) return false;
      const token = await getValidToken();
      if (!token) return false;
      const engine = new DriveSyncEngine(token);
      const driveRole = role === "viewer" ? "reader" : role === "reviewer" ? "commenter" : "writer";
      await engine.shareProjectFolder(folderId, email, driveRole);
      return true;
    },
    [getValidToken, isAuthenticated]
  );

  return {
    sync,
    uploadProject,
    downloadProject,
    listFiles,
    loadSharedProjects,
    shareWithTeammate,
    sharedProjects,
    progress,
    lastResult,
    isSyncing,
  };
}
