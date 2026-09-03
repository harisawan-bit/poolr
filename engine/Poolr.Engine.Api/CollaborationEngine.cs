using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;

namespace Poolr.Engine.Api;

/// <summary>
/// Phase 12 — Collaboration engine (v0.5.7).
/// Version history, project snapshots, diff, merge support.
/// Google Drive sync is a client-side concern; this provides the local foundation.
/// </summary>
public static class CollaborationEngine
{
    private const string SnapshotDir = ".poolr/snapshots";

    public class SnapshotRequest
    {
        public string projectPath { get; set; } = "";
        public string projectJson { get; set; } = "";
        public string message { get; set; } = "";
    }

    public class Snapshot
    {
        public string id { get; set; } = "";
        public DateTime timestamp { get; set; }
        public string message { get; set; } = "";
        public string hash { get; set; } = "";
    }

    public class DiffRequest
    {
        public string projectPath { get; set; } = "";
        public string snapshotId1 { get; set; } = "";
        public string snapshotId2 { get; set; } = "";
    }

    public class DiffResult
    {
        public List<string> added { get; set; } = new();
        public List<string> removed { get; set; } = new();
        public List<string> modified { get; set; } = new();
    }

    public class RestoreRequest
    {
        public string projectPath { get; set; } = "";
        public string snapshotId { get; set; } = "";
    }

    public static string CreateSnapshot(SnapshotRequest req)
    {
        if (!Directory.Exists(SnapshotDir))
            Directory.CreateDirectory(SnapshotDir);

        var id = DateTime.UtcNow.ToString("yyyyMMddHHmmss");
        var snapshotPath = Path.Combine(SnapshotDir, $"{id}.json");
        File.WriteAllText(snapshotPath, req.projectJson);

        var meta = new Snapshot
        {
            id = id,
            timestamp = DateTime.UtcNow,
            message = req.message,
            hash = ComputeHash(req.projectJson)
        };
        File.WriteAllText(Path.Combine(SnapshotDir, $"{id}.meta"), JsonSerializer.Serialize(meta));

        return id;
    }

    public static List<Snapshot> ListSnapshots()
    {
        if (!Directory.Exists(SnapshotDir))
            return new List<Snapshot>();

        return Directory.GetFiles(SnapshotDir, "*.meta")
            .Select(f => JsonSerializer.Deserialize<Snapshot>(File.ReadAllText(f))!)
            .OrderByDescending(s => s.timestamp)
            .ToList();
    }

    public static DiffResult GetDiff(DiffRequest req)
    {
        var snap1 = LoadSnapshot(req.snapshotId1);
        var snap2 = LoadSnapshot(req.snapshotId2);

        var result = new DiffResult();

        // Simple JSON field-level diff
        var json1 = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(snap1);
        var json2 = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(snap2);

        if (json1 != null && json2 != null)
        {
            var keys1 = json1.Keys.ToHashSet();
            var keys2 = json2.Keys.ToHashSet();

            result.added = keys2.Except(keys1).ToList();
            result.removed = keys1.Except(keys2).ToList();
            result.modified = keys1.Intersect(keys2)
                .Where(k => json1[k].GetRawText() != json2[k].GetRawText())
                .ToList();
        }

        return result;
    }

    public static string RestoreSnapshot(RestoreRequest req)
    {
        var snap = LoadSnapshot(req.snapshotId);
        return snap;
    }

    private static string LoadSnapshot(string id)
    {
        var path = Path.Combine(SnapshotDir, $"{id}.json");
        if (!File.Exists(path))
            throw new ArgumentException($"Snapshot {id} not found");
        return File.ReadAllText(path);
    }

    private static string ComputeHash(string input)
    {
        using var sha = System.Security.Cryptography.SHA256.Create();
        var bytes = System.Text.Encoding.UTF8.GetBytes(input);
        var hash = sha.ComputeHash(bytes);
        return Convert.ToBase64String(hash)[..16];
    }
}
