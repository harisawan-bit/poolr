using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using System.Text.Json;
using Poolr.Engine.Api;
using Xunit;

namespace Poolr.Engine.Tests;

public class AuditRegressionTests
{
    [Fact]
    public void ProjectStore_SaveAndLoad_FallsBackToBackupOnCorruptPrimary()
    {
        var dir = Path.Combine(Path.GetTempPath(), "poolr-store-test-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(dir);
        try
        {
            var path = Path.Combine(dir, "poolr.json");
            ProjectStore.Save(path, new Dictionary<string, object> { ["title"] = "v1" });
            ProjectStore.Save(path, new Dictionary<string, object> { ["title"] = "v2" });
            File.WriteAllText(path, "{corrupt json");
            var restored = Assert.IsType<JsonElement>(ProjectStore.Load(path));
            Assert.Equal("v1", restored.GetProperty("title").GetString());
        }
        finally
        {
            Directory.Delete(dir, true);
        }
    }

    [Fact]
    public void Exporter_ToDocx_ProducesValidArchiveWithEscapedXml()
    {
        var project = new Dictionary<string, object>
        {
            ["meta"] = new Dictionary<string, object>
            {
                ["results"] = new Dictionary<string, object>
                {
                    ["measure"] = "OR <1>",
                    ["pooled"] = new Dictionary<string, object> { ["effect"] = 1.25, ["ci_lower"] = 0.9, ["ci_upper"] = 1.7 }
                }
            }
        };
        var bytes = Exporter.ToDocx(project);
        using var zip = new ZipArchive(new MemoryStream(bytes), ZipArchiveMode.Read);
        var entry = zip.GetEntry("word/document.xml");
        Assert.NotNull(entry);
        using var reader = new StreamReader(entry!.Open());
        var xml = reader.ReadToEnd();
        Assert.Contains("OR &lt;1&gt;", xml);
    }

    [Fact]
    public void CollaborationEngine_LoadSnapshot_RejectsPathTraversal()
    {
        Assert.Throws<ArgumentException>(() => CollaborationEngine.LoadSnapshot("../secrets"));
        Assert.Throws<ArgumentException>(() => CollaborationEngine.LoadSnapshot(""));
    }

    [Fact]
    public void ReportingEngine_GenerateHtmlReport_EscapesUserInput()
    {
        var html = ReportingEngine.GenerateHtmlReport(new ReportingEngine.HtmlReportRequest
        {
            project = new ReportingEngine.ProjectData
            {
                title = "<script>alert(1)</script>",
                objective = "A & B",
                measure = "OR",
                certainty = "High"
            }
        });
        Assert.DoesNotContain("<script>alert(1)</script>", html);
        Assert.Contains("&lt;script&gt;alert(1)&lt;/script&gt;", html);
    }
}
