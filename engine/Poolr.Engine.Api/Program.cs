using Microsoft.AspNetCore.Mvc;
using Poolr.Engine.Api;

var builder = WebApplication.CreateBuilder(args);

// Listen on localhost only — the Tauri shell bridges the webview to this sidecar.
builder.WebHost.UseUrls("http://127.0.0.1:5180");

var app = builder.Build();

app.MapGet("/health", () => Results.Ok(new { ok = true, version = "0.4.0", engine = "csharp" }));
app.MapGet("/version", () => Results.Ok(new { version = "0.4.0" }));

// Phase B — C# meta-analysis port (numerically identical to python/poolr/meta/analysis.py).
app.MapPost("/api/meta", ([FromBody] MetaRequest req) =>
{
    try
    {
        var ma = new MetaAnalysis(req.model, req.measure, req.method, req.subgroup, req.pub_bias);
        var result = ma.Run(req.data ?? new());
        return Results.Ok(result);
    }
    catch (Exception ex)
    {
        return Results.BadRequest(new { error = ex.Message });
    }
});

// Phase B5 — figures (SVG). Returns image/svg+xml.
app.MapPost("/api/figure/forest", ([FromBody] MetaResponse req) =>
    Results.Text(Figures.ForestPlot(req), "image/svg+xml"));
app.MapPost("/api/figure/funnel", ([FromBody] MetaResponse req) =>
    Results.Text(Figures.FunnelPlot(req), "image/svg+xml"));

// Phase B6 — export. ?format=json|md|latex|docx
app.MapPost("/api/export", ([FromBody] Dictionary<string, object> project, string format = "json") =>
{
    try
    {
        switch (format.ToLowerInvariant())
        {
            case "md": return Results.Text(Exporter.ToMarkdown(project), "text/markdown; charset=utf-8");
            case "latex": return Results.Text(Exporter.ToLatex(project), "application/x-tex");
            case "docx": return Results.File(Exporter.ToDocx(project), "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "poolr_report.docx");
            default: return Results.Text(Exporter.ToJson(project), "application/json");
        }
    }
    catch (Exception ex) { return Results.BadRequest(new { error = ex.Message }); }
});

// Phase B7 — project persistence (atomic save + .bak, load).
app.MapPost("/api/project/save", ([FromBody] ProjectSaveRequest req) =>
{
    try { var p = ProjectStore.Save(req.path ?? "poolr.json", req.project ?? new()); return Results.Ok(new { saved = p }); }
    catch (Exception ex) { return Results.BadRequest(new { error = ex.Message }); }
});
app.MapPost("/api/project/load", ([FromBody] ProjectLoadRequest req) =>
{
    try { return Results.Ok(ProjectStore.Load(req.path ?? "poolr.json")); }
    catch (Exception ex) { return Results.BadRequest(new { error = ex.Message }); }
});

// GRADE evidence profile.
app.MapPost("/api/grade", ([FromBody] GradeRequest req) =>
{
    try
    {
        var rows = GradeEngine.Evaluate(req);
        return Results.Ok(rows);
    }
    catch (Exception ex)
    {
        return Results.BadRequest(new { error = ex.Message });
    }
});

app.Run();
