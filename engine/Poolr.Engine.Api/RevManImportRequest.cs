namespace Poolr.Engine.Api;

/// <summary>Request model for RevMan 5 import.</summary>
public class RevManImportRequest { public string format { get; set; } = "xml"; public string content { get; set; } = ""; }
