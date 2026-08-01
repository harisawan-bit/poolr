using System;
using System.IO;
using System.Text.Json;

namespace Poolr.Engine.Api;

/// <summary>
/// Persistence for poolr.json. Atomic write (temp file + rename) with a rolling .bak,
/// so a multi-day MA survives a force-close (Phase E requirement). Matches the
/// python/poolr/main.py project_data schema (loose dictionary round-trip).
/// </summary>
public static class ProjectStore
{
    private static readonly JsonSerializerOptions Opt = new() { WriteIndented = true };

    public static object Load(string path)
    {
        if (!File.Exists(path))
            throw new FileNotFoundException("No poolr.json found at the given path.", path);
        var txt = File.ReadAllText(path);
        using var doc = JsonDocument.Parse(txt);
        return JsonSerializer.Deserialize<object>(txt)
            ?? throw new InvalidDataException("poolr.json is empty or invalid.");
    }

    public static string Save(string path, object project)
    {
        var dir = Path.GetDirectoryName(Path.GetFullPath(path)) ?? ".";
        Directory.CreateDirectory(dir);
        var json = JsonSerializer.Serialize(project, Opt);
        var tmp = path + ".tmp";
        var bak = path + ".bak";

        // rolling backup of the previous good file (written BEFORE the temp swap,
        // so a crash mid-write always leaves the last good copy at <path>.bak)
        if (File.Exists(path))
        {
            try { File.Copy(path, bak, overwrite: true); } catch { /* best-effort */ }
        }
        // atomic write: fully materialise the temp file, then replace the target in a
        // single move. File.Move(overwrite:true) maps to MoveFileEx/REPLACE_EXISTING, so
        // there is no window where <path> is missing (the old Delete+Move had one).
        File.WriteAllText(tmp, json);
        try
        {
            File.Move(tmp, path, overwrite: true);
        }
        catch (IOException)
        {
            // Fallback for filesystems that reject an overwriting move.
            if (File.Exists(path)) File.Delete(path);
            File.Move(tmp, path);
        }
        return path;
    }
}
