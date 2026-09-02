using System.IO;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Poolr.Engine.Api;

var builder = WebApplication.CreateBuilder(args);

// Listen on localhost only — the Tauri shell bridges the webview to this sidecar.
builder.WebHost.UseUrls("http://127.0.0.1:5180");

var app = builder.Build();

// CORS — the Tauri webview and a plain browser dev server both call this sidecar
// from a different origin (tauri://localhost or localhost:1420). Allow it.
app.Use(async (ctx, next) =>
{
    ctx.Response.Headers.Append("Access-Control-Allow-Origin", "*");
    ctx.Response.Headers.Append("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    ctx.Response.Headers.Append("Access-Control-Allow-Headers", "Content-Type");
    if (ctx.Request.Method == "OPTIONS")
    {
        ctx.Response.StatusCode = 204;
        return;
    }
    await next();
});

app.MapGet("/health", () => Results.Ok(new { ok = true, version = "0.5.7", engine = "csharp" }));
app.MapGet("/version", () => Results.Ok(new { version = "0.5.7" }));

// Phase B — C# meta-analysis engine (numerics covered by engine/Poolr.Engine.Tests xUnit).
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

// v0.5.1 — extended meta-analysis (KH, MH/Peto, subgroups w/ Q-between, sensitivity, bias depth, new outcome types)
app.MapPost("/api/meta2", async (HttpRequest httpReq) =>
{
    try
    {
        using var sr = new StreamReader(httpReq.Body);
        var raw = await sr.ReadToEndAsync();
        var req = System.Text.Json.JsonSerializer.Deserialize<ExtendedMetaRequest>(raw,
            new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true })
            ?? new ExtendedMetaRequest();
        var ma = new ExtendedMetaAnalysis(req.model, req.measure, req.method, req.subgroup,
            req.knapp_hartung, string.IsNullOrWhiteSpace(req.bias_depth) ? req.pub_bias : req.bias_depth);
        var result = ma.Run(req.data ?? new(), req.exclude, req.sensitivity);
        return Results.Ok(result);
    }
    catch (Exception ex)
    {
        return Results.BadRequest(new { error = ex.Message });
    }
});

// v0.5.1 — effect-size conversions / median completion
app.MapPost("/api/convert", ([FromBody] ConvertRequest req) =>
{
    try { return Results.Ok(Converters.Run(req)); }
    catch (Exception ex) { return Results.BadRequest(new { error = ex.Message }); }
});

// v0.5.1 — diagnostic figures (Galbraith, L'Abbe, Baujat, contour funnel)
app.MapPost("/api/figure/galbraith", (DiagnosticFigures.PlotInput req) =>
    Results.Text(DiagnosticFigures.Galbraith(req, 0), "image/svg+xml"));
app.MapPost("/api/figure/labbe", (List<DiagnosticFigures.LabbeArm> arms) =>
{
    try
    {
        var list = arms.Select(t => (t.name, t.a, t.n1, t.c, t.n2)).ToList();
        return Results.Text(DiagnosticFigures.Labbe(list), "image/svg+xml");
    }
    catch (Exception ex) { return Results.BadRequest(new { error = ex.Message }); }
});
app.MapPost("/api/figure/baujat", (DiagnosticFigures.PlotInput req) =>
    Results.Text(DiagnosticFigures.Baujat(req), "image/svg+xml"));
app.MapPost("/api/figure/funnel_contour", ([FromBody] MetaResponse req) =>
    Results.Text(DiagnosticFigures.ContourFunnel(req), "image/svg+xml"));

// v0.5.1 — export suite (R replication, citations, methods paragraph)
app.MapPost("/api/export/r_code", async (HttpRequest httpReq) =>
{
    try
    {
        using var sr = new StreamReader(httpReq.Body);
        var raw = await sr.ReadToEndAsync();
        var doc = System.Text.Json.JsonSerializer.Deserialize<System.Text.Json.JsonElement>(raw);
        var resp = doc.GetProperty("response").Deserialize<ExtendedMetaResponse>();
        var data = doc.GetProperty("data").Deserialize<List<Study>>();
        return Results.Text(ExportSuite.RReplication(resp!, data ?? new()), "text/plain");
    }
    catch (Exception ex) { return Results.BadRequest(new { error = ex.Message }); }
});
app.MapPost("/api/export/citations", async (HttpRequest httpReq) =>
{
    try
    {
        using var sr = new StreamReader(httpReq.Body);
        var raw = await sr.ReadToEndAsync();
        var doc = System.Text.Json.JsonSerializer.Deserialize<System.Text.Json.JsonElement>(raw);
        var data = doc.GetProperty("data").Deserialize<List<Study>>() ?? new();
        string fmt = httpReq.Query["format"].ToString().ToLowerInvariant();
        string text = fmt == "bibtex"
            ? ExportSuite.BibTeX(data)
            : ExportSuite.RisExport(data);
        return Results.Text(text, "text/plain");
    }
    catch (Exception ex) { return Results.BadRequest(new { error = ex.Message }); }
});
app.MapPost("/api/export/methods", ([FromBody] ExtendedMetaResponse req) =>
    Results.Text(ExportSuite.MethodsParagraph(req), "text/plain"));

// v0.5.1 — robvis-style RoB figures
app.MapPost("/api/figure/rob_traffic", ([FromBody] RobFigures.TrafficLightRequest req) =>
    Results.Text(RobFigures.TrafficLight(req), "image/svg+xml"));
app.MapPost("/api/figure/rob_summary", ([FromBody] RobFigures.TrafficLightRequest req) =>
    Results.Text(RobFigures.SummaryBar(req), "image/svg+xml"));

// Phase B5 — figures (SVG). Returns image/svg+xml.
app.MapPost("/api/figure/forest", ([FromBody] MetaResponse req) =>
    Results.Text(Figures.ForestPlot(req), "image/svg+xml"));
app.MapPost("/api/figure/funnel", ([FromBody] MetaResponse req) =>
    Results.Text(Figures.FunnelPlot(req), "image/svg+xml"));

// Phase B6 — export. ?format=json|md|latex|docx
// NOTE: bind the raw request body rather than [FromBody] Dictionary<string,object>.
// System.Text.Json materialises NESTED objects/arrays as JsonElement, so the
// exporters' `is Dictionary<string,object>` / `is List<object>` checks failed and
// pico / meta.results / extraction.studies were silently dropped. Normalize first.
app.MapPost("/api/export", async (HttpRequest req, string format = "json") =>
{
    try
    {
        using var sr = new StreamReader(req.Body);
        var raw = await sr.ReadToEndAsync();
        object? parsed = string.IsNullOrWhiteSpace(raw)
            ? new Dictionary<string, object>()
            : JsonSerializer.Deserialize<object>(raw);
        var project = Exporter.Normalize(parsed) as Dictionary<string, object>
                      ?? new Dictionary<string, object>();

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

// v0.5.1 — GRADE Summary-of-Findings
app.MapPost("/api/grade/sof", ([FromBody] SofGenerator.SofRequest req) =>
{
    try
    {
        var (rows, markdown) = SofGenerator.Generate(req);
        return Results.Json(new { rows, markdown }, SofJson.Options);
    }
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

// v0.5.7 — Living Systematic Review
app.MapPost("/api/living/cumulative", ([FromBody] LivingReviewEngine.CumulativeRequest req) =>
{
    try { return Results.Ok(LivingReviewEngine.RunCumulative(req)); }
    catch (Exception ex) { return Results.BadRequest(new { error = ex.Message }); }
});

app.MapPost("/api/living/priority", ([FromBody] LivingReviewEngine.PriorityScreeningRequest req) =>
{
    try { return Results.Ok(LivingReviewEngine.RunPriorityScreening(req)); }
    catch (Exception ex) { return Results.BadRequest(new { error = ex.Message }); }
});

// v0.5.7 — Niche MA types (correlations, variability, SCED, Poisson, agreement)
app.MapPost("/api/niche/correlation", ([FromBody] List<NicheEngine.CorrelationStudy> studies) =>
{
    try { return Results.Ok(NicheEngine.RunCorrelationHunterSchmidt(studies)); }
    catch (Exception ex) { return Results.BadRequest(new { error = ex.Message }); }
});
app.MapPost("/api/niche/variability", ([FromBody] List<NicheEngine.VariabilityStudy> studies) =>
{
    try { return Results.Ok(NicheEngine.RunVariabilityRatio(studies)); }
    catch (Exception ex) { return Results.BadRequest(new { error = ex.Message }); }
});
app.MapPost("/api/niche/sced", ([FromBody] List<NicheEngine.ScdStudy> studies) =>
{
    try { return Results.Ok(NicheEngine.RunScd(studies)); }
    catch (Exception ex) { return Results.BadRequest(new { error = ex.Message }); }
});
app.MapPost("/api/niche/poisson", ([FromBody] List<NicheEngine.PoissonStudy> studies) =>
{
    try { return Results.Ok(NicheEngine.RunPoissonGlmm(studies)); }
    catch (Exception ex) { return Results.BadRequest(new { error = ex.Message }); }
});
app.MapPost("/api/niche/agreement", ([FromBody] List<NicheEngine.AgreementStudy> studies) =>
{
    try { return Results.Ok(NicheEngine.RunAgreement(studies)); }
    catch (Exception ex) { return Results.BadRequest(new { error = ex.Message }); }
});

// v0.5.7 — Specialized (QoL, Economic, Genetics, Ecology, Education, Adverse Events)
app.MapPost("/api/specialized/qol", ([FromBody] SpecializedEngine.QolRequest req) =>
{
    try { return Results.Ok(SpecializedEngine.RunQol(req.studies, req.pooledBaselineSd)); }
    catch (Exception ex) { return Results.BadRequest(new { error = ex.Message }); }
});
app.MapPost("/api/specialized/economic", ([FromBody] List<SpecializedEngine.CostStudy> studies) =>
{
    try { return Results.Ok(SpecializedEngine.RunEconomic(studies)); }
    catch (Exception ex) { return Results.BadRequest(new { error = ex.Message }); }
});
app.MapPost("/api/specialized/genetic", ([FromBody] List<SpecializedEngine.GeneticStudy> studies) =>
{
    try { return Results.Ok(SpecializedEngine.RunGenetic(studies)); }
    catch (Exception ex) { return Results.BadRequest(new { error = ex.Message }); }
});
app.MapPost("/api/specialized/ecological", ([FromBody] List<SpecializedEngine.EcologicalStudy> studies) =>
{
    try { return Results.Ok(SpecializedEngine.RunEcological(studies)); }
    catch (Exception ex) { return Results.BadRequest(new { error = ex.Message }); }
});
app.MapPost("/api/specialized/prepost", ([FromBody] List<SpecializedEngine.PrePostStudy> studies) =>
{
    try { return Results.Ok(SpecializedEngine.RunPrePost(studies)); }
    catch (Exception ex) { return Results.BadRequest(new { error = ex.Message }); }
});
app.MapPost("/api/specialized/adverse", ([FromBody] List<SpecializedEngine.AeStudy> studies) =>
{
    try { return Results.Ok(SpecializedEngine.RunAdverseEvents(studies)); }
    catch (Exception ex) { return Results.BadRequest(new { error = ex.Message }); }
});

// v0.5.7 — Advanced (Prognostic, Qualitative, Bibliometric, Sequential, DCA)
app.MapPost("/api/advanced/prognostic", ([FromBody] List<AdvancedEngine.PrognosticStudy> studies) =>
{
    try { return Results.Ok(AdvancedEngine.RunPrognostic(studies)); }
    catch (Exception ex) { return Results.BadRequest(new { error = ex.Message }); }
});
app.MapPost("/api/advanced/qualitative", ([FromBody] List<AdvancedEngine.CodeEntry> entries) =>
{
    try { return Results.Ok(AdvancedEngine.RunQualitative(entries)); }
    catch (Exception ex) { return Results.BadRequest(new { error = ex.Message }); }
});
app.MapPost("/api/advanced/bibliometric", ([FromBody] List<AdvancedEngine.CitationEntry> entries) =>
{
    try { return Results.Ok(AdvancedEngine.RunBibliometric(entries)); }
    catch (Exception ex) { return Results.BadRequest(new { error = ex.Message }); }
});
app.MapPost("/api/advanced/sequential", ([FromBody] AdvancedEngine.SequentialRequest req) =>
{
    try { return Results.Ok(AdvancedEngine.RunSequential(req.studies, req.alpha, req.beta, req.expectedEffect)); }
    catch (Exception ex) { return Results.BadRequest(new { error = ex.Message }); }
});
app.MapPost("/api/advanced/dca", ([FromBody] List<AdvancedEngine.DcaStudy> studies) =>
{
    try { return Results.Ok(AdvancedEngine.RunDca(studies)); }
    catch (Exception ex) { return Results.BadRequest(new { error = ex.Message }); }
});

// v0.5.7 — Collaboration (snapshots, diff, restore)
app.MapPost("/api/collaboration/snapshot", ([FromBody] CollaborationEngine.SnapshotRequest req) =>
{
    try { return Results.Ok(new { id = CollaborationEngine.CreateSnapshot(req) }); }
    catch (Exception ex) { return Results.BadRequest(new { error = ex.Message }); }
});
app.MapPost("/api/collaboration/snapshots", () =>
{
    try { return Results.Ok(CollaborationEngine.ListSnapshots()); }
    catch (Exception ex) { return Results.BadRequest(new { error = ex.Message }); }
});
app.MapPost("/api/collaboration/diff", ([FromBody] CollaborationEngine.DiffRequest req) =>
{
    try { return Results.Ok(CollaborationEngine.GetDiff(req)); }
    catch (Exception ex) { return Results.BadRequest(new { error = ex.Message }); }
});
app.MapPost("/api/collaboration/restore", ([FromBody] CollaborationEngine.RestoreRequest req) =>
{
    try { return Results.Ok(new { json = CollaborationEngine.RestoreSnapshot(req) }); }
    catch (Exception ex) { return Results.BadRequest(new { error = ex.Message }); }
});

// v0.5.7 — Reporting (LaTeX, HTML, Python, Stata)
app.MapPost("/api/report/latex", ([FromBody] ReportingEngine.ManuscriptRequest req) =>
    Results.Text(ReportingEngine.GenerateLatex(req), "application/x-tex"));
app.MapPost("/api/report/html", ([FromBody] ReportingEngine.HtmlReportRequest req) =>
    Results.Text(ReportingEngine.GenerateHtmlReport(req), "text/html"));
app.MapPost("/api/report/python", ([FromBody] ReportingEngine.ManuscriptRequest req) =>
    Results.Text(ReportingEngine.GeneratePythonReplication(req), "text/plain"));
app.MapPost("/api/report/stata", ([FromBody] ReportingEngine.ManuscriptRequest req) =>
    Results.Text(ReportingEngine.GenerateStataReplication(req), "text/plain"));

// v0.5.7 — AI-assisted screening / extraction / RoB / GRADE
app.MapPost("/api/ai/screening", async (HttpRequest req) =>
{
    try
    {
        using var sr = new StreamReader(req.Body);
        var raw = await sr.ReadToEndAsync();
        return Results.Ok(new { message = "AI screening endpoint - configure LLM in settings" });
    }
    catch (Exception ex)
    {
        return Results.BadRequest(new { error = ex.Message });
    }
});

// v0.5.7 — Survival extensions (RMST, IPD reconstruction)
app.MapPost("/api/survival", async (HttpRequest req) =>
{
    try
    {
        using var sr = new StreamReader(req.Body);
        var raw = await sr.ReadToEndAsync();
        var doc = System.Text.Json.JsonSerializer.Deserialize<System.Text.Json.JsonElement>(raw);
        var type = doc.GetProperty("type").GetString();

        if (type == "rmst")
        {
            var rmstReq = doc.GetProperty("request").Deserialize<SurvivalEngine.RmstRequest>();
            return Results.Ok(SurvivalEngine.RunRmst(rmstReq));
        }
        else if (type == "kmreconstruct")
        {
            var kmReq = doc.GetProperty("request").Deserialize<SurvivalEngine.KmReconstructionRequest>();
            return Results.Ok(SurvivalEngine.ReconstructIPD(kmReq));
        }

        return Results.BadRequest(new { error = "Unknown survival analysis type" });
    }
    catch (Exception ex)
    {
        return Results.BadRequest(new { error = ex.Message });
    }
});

// v0.5.7 — Proportion Meta-Analysis (extended)
app.MapPost("/api/proportion", ([FromBody] ProportionEngine.ProportionRequest req) =>
{
    try
    {
        var result = ProportionEngine.Run(req);
        return Results.Ok(result);
    }
    catch (Exception ex)
    {
        return Results.BadRequest(new { error = ex.Message });
    }
});

// v0.5.7 — Prediction interval
app.MapPost("/api/prediction", ([FromBody] PredictionEngine.PredictionRequest req) =>
{
    try { return Results.Ok(PredictionEngine.ComputePredictionInterval(req)); }
    catch (Exception ex) { return Results.BadRequest(new { error = ex.Message }); }
});

// v0.5.7 — Model averaging
app.MapPost("/api/modelaverage", ([FromBody] PredictionEngine.ModelAverageRequest req) =>
{
    try { return Results.Ok(PredictionEngine.RunModelAveraging(req)); }
    catch (Exception ex) { return Results.BadRequest(new { error = ex.Message }); }
});

// v0.5.7 — Dose-Response Meta-Analysis
app.MapPost("/api/dose", ([FromBody] DoseResponseEngine.DoseRequest req) =>
{
    try
    {
        var result = DoseResponseEngine.Run(req);
        return Results.Ok(result);
    }
    catch (Exception ex)
    {
        return Results.BadRequest(new { error = ex.Message });
    }
});

// v0.5.7 — IPD Meta-Analysis
app.MapPost("/api/ipd", ([FromBody] IpdEngine.IpdRequest req) =>
{
    try
    {
        var result = IpdEngine.Run(req);
        return Results.Ok(result);
    }
    catch (Exception ex)
    {
        return Results.BadRequest(new { error = ex.Message });
    }
});

// v0.5.7 — Diagnostic Test Accuracy Meta-Analysis
app.MapPost("/api/dta", ([FromBody] DtaEngine.DtaRequest req) =>
{
    try
    {
        var result = DtaEngine.Run(req);
        return Results.Ok(result);
    }
    catch (Exception ex)
    {
        return Results.BadRequest(new { error = ex.Message });
    }
});

// v0.5.7 — Multilevel / Multivariate / RVE
app.MapPost("/api/multilevel", ([FromBody] MultilevelEngine.MultilevelRequest req) =>
{
    try
    {
        var result = MultilevelEngine.Run(req);
        return Results.Ok(result);
    }
    catch (Exception ex)
    {
        return Results.BadRequest(new { error = ex.Message });
    }
});

// v0.5.7 — Network Meta-Analysis
app.MapPost("/api/nma", ([FromBody] NmaEngine.NmaRequest req) =>
{
    try
    {
        var result = NmaEngine.Run(req);
        return Results.Ok(result);
    }
    catch (Exception ex)
    {
        return Results.BadRequest(new { error = ex.Message });
    }
});

app.Run();
