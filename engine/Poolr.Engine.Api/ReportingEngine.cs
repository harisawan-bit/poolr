using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;

namespace Poolr.Engine.Api;

/// <summary>
/// Phase 11 — Reporting engine (v0.5.7).
/// Full manuscript export, interactive HTML report, replication scripts (R/Python/Stata).
/// </summary>
public static class ReportingEngine
{
    public class ManuscriptRequest
    {
        public string title { get; set; } = "";
        public string authors { get; set; } = "";
        public string journal { get; set; } = "";
        public string objective { get; set; } = "";
        public int studies { get; set; }
        public int participants { get; set; }
        public double pooledEffect { get; set; }
        public double ciLower { get; set; }
        public double ciUpper { get; set; }
        public double i2 { get; set; }
        public double p { get; set; }
        public string measure { get; set; } = "OR";
        public string model { get; set; } = "random";
        public string method { get; set; } = "DL";
        public string robSummary { get; set; } = "Low risk";
        public string gradeCertainty { get; set; } = "Moderate";
        public List<string> figures { get; set; } = new();
        public List<string> tables { get; set; } = new();
        public List<RefEntry> references { get; set; } = new();
    }

    public class RefEntry
    {
        public string study { get; set; } = "";
        public int? year { get; set; }
        public string journal { get; set; } = "";
        public string doi { get; set; } = "";
    }

    public class HtmlReportRequest
    {
        public ProjectData project { get; set; } = new();
        public bool embedFigures { get; set; } = true;
        public bool includeMethods { get; set; } = true;
    }

    public class ProjectData
    {
        public string title { get; set; } = "";
        public string objective { get; set; } = "";
        public int screeningRecords { get; set; }
        public int includedStudies { get; set; }
        public int participants { get; set; }
        public double pooledEffect { get; set; }
        public double ciLower { get; set; }
        public double ciUpper { get; set; }
        public double i2 { get; set; }
        public double p { get; set; }
        public string measure { get; set; } = "OR";
        public string certainty { get; set; } = "Moderate";
    }

    public static string GenerateLatex(ManuscriptRequest req)
    {
        var sb = new StringBuilder();
        sb.AppendLine("\\documentclass[12pt]{article}");
        sb.AppendLine("\\usepackage{booktabs,graphicx,hyperref}");
        sb.AppendLine("\\begin{document}");
        sb.AppendLine();
        sb.AppendLine($"\\title{{{req.title}}}");
        sb.AppendLine($"\\author{{{req.authors}}}");
        sb.AppendLine("\\maketitle");
        sb.AppendLine();
        sb.AppendLine("\\begin{abstract}");
        sb.AppendLine($"Objective: {req.objective}");
        sb.AppendLine($"Pooled {req.measure}: {req.pooledEffect:F2} [{req.ciLower:F2}, {req.ciUpper:F2}], I²={req.i2:F1}%, p={req.p:F4}");
        sb.AppendLine($"GRADE certainty: {req.gradeCertainty}");
        sb.AppendLine("\\end{abstract}");
        sb.AppendLine();
        sb.AppendLine("\\section{Introduction}");
        sb.AppendLine("[Introduction text placeholder — author to complete.]");
        sb.AppendLine();
        sb.AppendLine("\\section{Methods}");
        sb.AppendLine($"A systematic review was conducted following PRISMA 2020 guidelines. Meta-analysis was performed using a {req.model}-effects model with the {req.method} heterogeneity estimator.");
        sb.AppendLine();
        sb.AppendLine("\\section{Results}");
        sb.AppendLine($"A total of {req.studies} studies ({req.participants} participants) were included. The pooled {req.measure} was {req.pooledEffect:F2} (95% CI: {req.ciLower:F2}–{req.ciUpper:F2}, I²={req.i2:F1}%, p={req.p:F4}).");
        sb.AppendLine();
        sb.AppendLine("\\begin{table}[h]");
        sb.AppendLine("\\centering");
        sb.AppendLine("\\begin{tabular}{l c c}");
        sb.AppendLine("\\toprule");
        sb.AppendLine("Outcome & Effect (95\\% CI) & I² \\\\");
        sb.AppendLine("\\midrule");
        sb.AppendLine($"{req.measure} & {req.pooledEffect:F2} [{req.ciLower:F2}, {req.ciUpper:F2}] & {req.i2:F1}\\% \\\\");
        sb.AppendLine("\\bottomrule");
        sb.AppendLine("\\end{tabular}");
        sb.AppendLine("\\caption{Meta-analysis results}");
        sb.AppendLine("\\end{table}");
        sb.AppendLine();
        sb.AppendLine("\\section{Discussion}");
        sb.AppendLine("[Discussion text placeholder — author to complete.]");
        sb.AppendLine();
        sb.AppendLine("\\section{Conclusion}");
        sb.AppendLine("[Conclusion text placeholder — author to complete.]");
        sb.AppendLine();
        if (req.references.Any())
        {
            sb.AppendLine("\\begin{thebibliography}{99}");
            for (int i = 0; i < req.references.Count; i++)
            {
                var r = req.references[i];
                sb.AppendLine($"\\bibitem{{{i + 1}}} {r.study} ({r.year}). {r.journal}. {r.doi}");
            }
            sb.AppendLine("\\end{thebibliography}");
        }
        sb.AppendLine();
        sb.AppendLine("\\end{document}");
        return sb.ToString();
    }

    public static string GenerateHtmlReport(HtmlReportRequest req)
    {
        var p = req.project;
        return $@"
<!DOCTYPE html>
<html lang='en'>
<head>
<meta charset='UTF-8'>
<title>{p.title}</title>
<style>
body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 900px; margin: 0 auto; padding: 2rem; color: #333; line-height: 1.6; }}
h1 {{ color: #1a1a1a; border-bottom: 2px solid #eee; padding-bottom: 0.5rem; }}
h2 {{ color: #2c3e50; margin-top: 2rem; }}
.stat {{ display: inline-block; margin: 0.5rem 1rem 0.5rem 0; padding: 0.5rem 1rem; background: #f8f9fa; border-radius: 4px; }}
.stat-value {{ font-size: 1.5rem; font-weight: bold; color: #1a1a1a; }}
.stat-label {{ font-size: 0.75rem; color: #666; text-transform: uppercase; }}
table {{ width: 100%; border-collapse: collapse; margin: 1rem 0; }}
th, td {{ padding: 0.75rem; text-align: left; border-bottom: 1px solid #eee; }}
th {{ background: #f8f9fa; font-weight: 600; }}
.certainty {{ display: inline-block; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.875rem; font-weight: 500; }}
.certainty-high {{ background: #d4edda; color: #155724; }}
.certainty-moderate {{ background: #fff3cd; color: #856404; }}
.certainty-low {{ background: #f8d7da; color: #721c24; }}
.certainty-very-low {{ background: #f5c6cb; color: #721c24; }}
footer {{ margin-top: 3rem; padding-top: 1rem; border-top: 1px solid #eee; font-size: 0.875rem; color: #666; }}
</style>
</head>
<body>
<h1>{p.title}</h1>
<p><strong>Objective:</strong> {p.objective}</p>

<h2>Summary Statistics</h2>
<div>
<span class='stat'><div class='stat-value'>{p.includedStudies}</div><div class='stat-label'>Included Studies</div></span>
<span class='stat'><div class='stat-value'>{p.participants:N0}</div><div class='stat-label'>Participants</div></span>
<span class='stat'><div class='stat-value'>{p.i2:F1}%</div><div class='stat-label'>I²</div></span>
<span class='stat'><div class='stat-value'>{p.p:F4}</div><div class='stat-label'>p-value</div></span>
</div>

<h2>Pooled Result</h2>
<table>
<tr><th>Measure</th><th>Effect (95% CI)</th><th>Certainty</th></tr>
<tr><td>{p.measure}</td><td>{p.pooledEffect:F2} [{p.ciLower:F2}, {p.ciUpper:F2}]</td>
<td><span class='certainty certainty-{p.certainty.ToLower().Replace(" ", "-")}'>{p.certainty}</span></td></tr>
</table>

<h2>PRISMA Flow</h2>
<table>
<tr><th>Stage</th><th>Records</th></tr>
<tr><td>Identified</td><td>{p.screeningRecords:N0}</td></tr>
<tr><td>Included</td><td>{p.includedStudies}</td></tr>
</table>

<footer>
<p>Generated by poolr v0.5.7 on {DateTime.Now:yyyy-MM-dd HH:mm}</p>
<p>This report accompanies a reproducible poolr project file.</p>
</footer>
</body></html>";
    }

    public static string GeneratePythonReplication(ManuscriptRequest req)
    {
        var sb = new StringBuilder();
        sb.AppendLine("# poolr v0.5.7 Python replication script");
        sb.AppendLine("# Requires: numpy, scipy");
        sb.AppendLine("import numpy as np");
        sb.AppendLine("from scipy import stats");
        sb.AppendLine();
        sb.AppendLine($"# Studies: {req.studies}, Participants: {req.participants}");
        sb.AppendLine($"# Measure: {req.measure}, Model: {req.model}, Method: {req.method}");
        sb.AppendLine();
        sb.AppendLine("# Placeholder: insert effect sizes and variances");
        sb.AppendLine("effects = []  # log(OR), log(RR), MD, SMD, etc.");
        sb.AppendLine("variances = []  # squared standard errors");
        sb.AppendLine();
        sb.AppendLine("# Fixed-effect pooling");
        sb.AppendLine("w = [1/v for v in variances]");
        sb.AppendLine("fe = sum(wi * ei for wi, ei in zip(w, effects)) / sum(w)");
        sb.AppendLine();
        sb.AppendLine("# Random-effects (DL tau²)");
        sb.AppendLine("k = len(effects)");
        sb.AppendLine("q = sum(wi * (ei - fe)**2 for wi, ei in zip(w, effects))");
        sb.AppendLine("df = k - 1");
        sb.AppendLine("c = sum(w) - sum(wi**2 for wi in w) / sum(w)");
        sb.AppendLine("tau2 = max(0, (q - df) / c) if q > df else 0");
        sb.AppendLine("rw = [1/(v + tau2) for v in variances]");
        sb.AppendLine("re = sum(wi * ei for wi, ei in zip(rw, effects)) / sum(rw)");
        sb.AppendLine("se_re = np.sqrt(1 / sum(rw))");
        sb.AppendLine();
        sb.AppendLine($"# Result: {req.measure} = {req.pooledEffect:F2} [{req.ciLower:F2}, {req.ciUpper:F2}]");
        sb.AppendLine("print('Pooled: %.2f (95%% CI: %.2f to %.2f)' % (re, re - 1.96*se_re, re + 1.96*se_re))");
        return sb.ToString();
    }

    public static string GenerateStataReplication(ManuscriptRequest req)
    {
        var sb = new StringBuilder();
        sb.AppendLine("* poolr v0.5.7 Stata replication script");
        sb.AppendLine($"* Studies: {req.studies}, Participants: {req.participants}");
        sb.AppendLine($"* Measure: {req.measure}, Model: {req.model}");
        sb.AppendLine();
        sb.AppendLine("clear");
        sb.AppendLine("input study effect se");
        sb.AppendLine("* Insert data here:");
        sb.AppendLine("end");
        sb.AppendLine();
        sb.AppendLine("gen vi = se^2");
        sb.AppendLine($"metan effect se, {measureToLower(req.measure)} {modelToLower(req.method)}");
        sb.AppendLine();
        sb.AppendLine($"* Expected: Pooled = {req.pooledEffect:F2} [{req.ciLower:F2}, {req.ciUpper:F2}]");
        sb.AppendLine($"* I² = {req.i2:F1}%");
        return sb.ToString();
    }

    private static string measureToLower(string m) => m.ToLower() switch
    {
        "or" => "or",
        "rr" => "rr",
        "rd" => "rd",
        "md" => "md",
        "smd" => "smd",
        _ => "gen"
    };

    private static string modelToLower(string m) => m.ToLower() switch
    {
        "random" => "random",
        "fixed" => "fixed",
        _ => "random"
    };
}
