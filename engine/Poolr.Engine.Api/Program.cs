var builder = WebApplication.CreateBuilder(args);

// Listen on localhost only — the Tauri shell bridges the webview to this sidecar.
builder.WebHost.UseUrls("http://127.0.0.1:5180");

var app = builder.Build();

app.MapGet("/health", () => Results.Ok(new { ok = true, version = "0.4.0", engine = "csharp" }));

app.MapGet("/version", () => Results.Ok(new { version = "0.4.0" }));

// Placeholder for Phase B (C# meta-analysis port). Returns 501 until implemented.
app.MapPost("/api/meta", () => Results.StatusCode(501));

app.Run();
