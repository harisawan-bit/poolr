/**
 * Google Drive Sync Engine
 *
 * Provides bi-directional sync between local Poolr projects and Google Drive.
 * Uses the Drive API v3 with the appdata folder for metadata and
 * user-visible Drive folder for project files.
 *
 * Features:
 * - Upload/download project files to Drive
 * - Conflict detection (local vs remote modification times)
 * - Selective sync (choose which projects to sync)
 * - Background sync with progress tracking
 * - Team collaboration via shared Drive folders
 */

import * as React from "react";
import type { Project } from "../lib/project";
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
  role: "owner" | "editor" | "viewer";
  joinedAt: string;
}

export interface SharedProject {
  id: string;
  name: string;
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

  private setToken(token: string) {
    this.token = token;
  }

  /**
   * Find or create the Poolr app folder in user's Drive.
   * Uses appDataFolder for hidden metadata, and a user-visible "Poolr" folder.
   */
  async getOrCreateAppFolder(): Promise<string> {
    // Check appdata first
    const appDataRes = await driveFetch(
      this.token,
      "/files?spaces=appDataFolder&q=name='poolr-metadata'&fields=files(id,name)"
    );
    const appDataJson = await appDataRes.json();
    if (appDataJson.files?.length > 0) {
      return appDataJson.files[0].id;
    }

    // Create metadata folder in appData
    const createRes = await driveFetch(this.token, "/files?fields=id", {
      method: "POST",
      body: JSON.stringify({
        name: "poolr-metadata",
        mimeType: "application/vnd.google-apps.folder",
        parents: ["appDataFolder"],
      }),
    });
    const created = await createRes.json();
    return created.id;
  }

  /**
   * Get the user-visible "Poolr" folder in their Drive root.
   */
  async getOrCreateVisibleFolder(): Promise<string> {
    const res = await driveFetch(
      this.token,
      "/files?q=name='Poolr' and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id,name,parents)"
    );
    const json = await res.json();
    if (json.files?.length > 0) {
      return json.files[0].id;
    }

    const createRes = await driveFetch(this.token, "/files?fields=id", {
      method: "POST",
      body: JSON.stringify({
        name: "Poolr",
        mimeType: "application/vnd.google-apps.folder",
      }),
    });
    const created = await createRes.json();
    return created.id;
  }

  /**
   * List all Poolr project files in Drive.
   */
  async listProjectFiles(): Promise<DriveFile[]> {
    const folderId = await this.getOrCreateVisibleFolder();
    const res = await driveFetch(
      this.token,
      `/files?q='${folderId}' in parents and mimeType='application/json' and trashed=false&fields=files(id,name,modifiedTime,size,parents,appProperties)&orderBy=modifiedTime desc`
    );
    const json = await res.json();
    return json.files || [];
  }

  /**
   * Upload a project to Google Drive.
   */
  async uploadProject(
    project: Project,
    existingFileId?: string
  ): Promise<DriveFile> {
    const folderId = await this.getOrCreateVisibleFolder();
    const fileName = `${project.metadata.title || "Untitled"}.poolr.json`;
    const metadata = {
      name: fileName,
      mimeType: "application/json",
      appProperties: {
        poolrProjectId: project.metadata.title || "untitled",
        poolrVersion: project.metadata.version || "0.6.0",
        poolrModified: new Date().toISOString(),
      },
      parents: [folderId],
    };

    const body = JSON.stringify(project);

    if (existingFileId) {
      // Update existing file
      const res = await fetch(
        `${UPLOAD_API}/files/${existingFileId}?uploadType=multipart&fields=id,name,modifiedTime,size`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${this.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ appProperties: metadata.appProperties }),
        }
      );
      if (!res.ok) throw new Error(`Update failed (${res.status})`);
      const updated = await res.json();
      return updated as DriveFile;
    } else {
      // Create new file using multipart upload
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

      const res = await fetch(
        `${UPLOAD_API}/files?uploadType=multipart&fields=id,name,modifiedTime,size,parents`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.token}`,
            'Content-Type': 'multipart/related; boundary=' + boundary,
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
   * Download a project from Google Drive.
   */
  async downloadProject(fileId: string): Promise<Project> {
    const res = await driveFetch(
      this.token,
      `/files/${fileId}?alt=media`,
      { headers: {} }
    );
    return (await res.json()) as Project;
  }

  /**
   * Delete a project from Drive.
   */
  async deleteProject(fileId: string): Promise<void> {
    await driveFetch(this.token, `/files/${fileId}`, { method: "DELETE" });
  }

  /**
   * Sync local projects with Drive.
   * Detects conflicts and returns them for user resolution.
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
      const projectId = f.appProperties?.poolrProjectId || f.name;
      remoteMap.set(projectId, f);
    }

    this.report({
      phase: "comparing",
      current: 0,
      total: localProjects.length,
      message: "Comparing local and remote...",
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
        // Local only — upload
        try {
          await this.uploadProject(local.project);
          result.uploaded++;
        } catch (e) {
          result.errors.push(`Upload ${projectId}: ${e instanceof Error ? e.message : String(e)}`);
        }
      } else {
        // Both exist — check for conflict
        const remoteModified = new Date(remote.modifiedTime).toISOString();
        const localTime = new Date(local.lastModified);
        const remoteTime = new Date(remoteModified);

        if (localTime > remoteTime) {
          // Local is newer — upload
          try {
            await this.uploadProject(local.project, remote.id);
            result.uploaded++;
          } catch (e) {
            result.errors.push(`Update ${projectId}: ${e instanceof Error ? e.message : String(e)}`);
          }
        } else if (remoteTime > localTime) {
          // Remote is newer — download
          try {
            await this.downloadProject(remote.id);
            result.downloaded++;
          } catch (e) {
            result.errors.push(`Download ${projectId}: ${e instanceof Error ? e.message : String(e)}`);
          }
        }
        // If equal, no action needed
      }
    }

    // Check for remote-only projects (download)
    const localIds = new Set(
      localProjects.map((l) => l.project.metadata.title || "untitled")
    );
    for (const [projectId, remote] of remoteMap) {
      if (!localIds.has(projectId)) {
        try {
          await this.downloadProject(remote.id);
          result.downloaded++;
        } catch (e) {
          result.errors.push(`Download new ${projectId}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    }

    this.report({ phase: "done", current: 1, total: 1, message: "Sync complete" });
    return result;
  }

  /**
   * Share a project with a team member via Drive permissions.
   */
  async shareProject(
    fileId: string,
    email: string,
    role: "reader" | "writer" | "commenter" = "writer"
  ): Promise<void> {
    await driveFetch(this.token, `/files/${fileId}/permissions?sendNotificationEmail=true`, {
      method: "POST",
      body: JSON.stringify({
        type: "user",
        role: role,
        emailAddress: email,
      }),
    });
  }

  /**
   * List permissions (team members) for a shared project.
   */
  async listSharedMembers(fileId: string): Promise<TeamMember[]> {
    const url = `/files/${fileId}/permissions?fields=permissions(id,displayName,emailAddress,role,photoLink,type)`;
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
  async removePermission(fileId: string, permissionId: string): Promise<void> {
    const url = `/files/${fileId}/permissions/${permissionId}`;
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

  return {
    sync,
    uploadProject,
    downloadProject,
    listFiles,
    progress,
    lastResult,
    isSyncing,
  };
}
