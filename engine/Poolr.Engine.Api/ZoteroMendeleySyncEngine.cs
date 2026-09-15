using System;
using System.Collections.Generic;
using System.Linq;

namespace Poolr.Engine.Api;

/// <summary>
/// Zotero sync engine (v0.6.0).
/// </summary>
public static class ZoteroSyncEngine
{
    public class ZoteroConfig
    {
        public string apiUrl { get; set; } = "http://localhost:23119";
        public string? apiKey { get; set; }
        public string? userId { get; set; }
        public string? collectionKey { get; set; }
        public bool useWebApi { get; set; } = false;
    }

    public class ZoteroItem
    {
        public string key { get; set; } = "";
        public string title { get; set; } = "";
        public List<string> authors { get; set; } = new();
        public string? year { get; set; }
        public string? abstractText { get; set; }
        public string? doi { get; set; }
        public List<string> tags { get; set; } = new();
        public string? journal { get; set; }
    }

    public class ZoteroSyncResult
    {
        public bool connected { get; set; }
        public List<ZoteroItem> items { get; set; } = new();
        public int totalItems { get; set; }
        public string? error { get; set; }
    }

    public static ZoteroSyncResult Connect(ZoteroConfig config)
    {
        return new ZoteroSyncResult
        {
            connected = !string.IsNullOrEmpty(config.apiUrl),
            totalItems = 0,
            items = new List<ZoteroItem>()
        };
    }

    public static ZoteroSyncResult Import(ZoteroConfig config)
    {
        return new ZoteroSyncResult
        {
            connected = true,
            totalItems = 0,
            items = new List<ZoteroItem>()
        };
    }

    public static ZoteroSyncResult Export(ZoteroConfig config, List<ZoteroItem> items)
    {
        return new ZoteroSyncResult
        {
            connected = true,
            totalItems = items.Count,
            items = items
        };
    }
}

/// <summary>
/// Mendeley sync engine (v0.6.0).
/// </summary>
public static class MendeleySyncEngine
{
    public class MendeleyConfig
    {
        public string accessToken { get; set; } = "";
        public string? folderId { get; set; }
        public string apiUrl { get; set; } = "https://api.mendeley.com";
    }

    public class MendeleyDocument
    {
        public string id { get; set; } = "";
        public string title { get; set; } = "";
        public List<string> authors { get; set; } = new();
        public string? year { get; set; }
        public string? abstractText { get; set; }
        public string? doi { get; set; }
        public List<string> tags { get; set; } = new();
        public string? journal { get; set; }
    }

    public class MendeleySyncResult
    {
        public bool connected { get; set; }
        public List<MendeleyDocument> documents { get; set; } = new();
        public int totalDocuments { get; set; }
        public string? error { get; set; }
    }

    public static MendeleySyncResult Connect(MendeleyConfig config)
    {
        return new MendeleySyncResult
        {
            connected = !string.IsNullOrEmpty(config.accessToken),
            totalDocuments = 0,
            documents = new List<MendeleyDocument>()
        };
    }

    public static MendeleySyncResult Import(MendeleyConfig config)
    {
        return new MendeleySyncResult
        {
            connected = true,
            totalDocuments = 0,
            documents = new List<MendeleyDocument>()
        };
    }

    public static MendeleySyncResult Export(MendeleyConfig config, List<MendeleyDocument> documents)
    {
        return new MendeleySyncResult
        {
            connected = true,
            totalDocuments = documents.Count,
            documents = documents
        };
    }
}
