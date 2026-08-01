using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.IO.Compression;
using System.Text;
using System.Text.Json;

namespace Poolr.Engine.Api;

/// <summary>
/// Library-free exporters. Mirrors python/poolr/export/reports.py section structure
/// (Abstract / Introduction / Methods / Results / PRISMA) but emits:
///  - json   : the project verbatim (System.Text.Json)
///  - md     : GitHub-flavoured markdown report
///  - latex  : minimal article skeleton
///  - docx   : a *minimal but valid* .docx built from raw OOXML inside a zip
///             (no third-party package). Good enough for Word/LibreOffice open.
/// </summary>
public static class Exporter
{
    private static string F(double v, string fmt = "0.00") => v.ToString(fmt, CultureInfo.InvariantCulture);

    /// <summary>
    /// Convert an arbitrary deserialized JSON graph into a clean tree of
    /// Dictionary&lt;string,object&gt; / List&lt;object&gt; / primitives.
    ///
    /// ASP.NET / System.Text.Json hands nested objects and arrays back as
    /// <see cref="JsonElement"/>, not Dictionary/List — which made every
    /// `is Dictionary&lt;string,object&gt;` / `is List&lt;object&gt;` check below fail
    /// silently and produced empty md/latex/docx reports. Normalize once at the
    /// endpoint boundary so the exporters see the shapes they expect.
    /// </summary>
    public static object? Normalize(object? o)
    {
        if (o is JsonElement je)
        {
            switch (je.ValueKind)
            {
                case JsonValueKind.Object:
                    var d = new Dictionary<string, object>();
                    foreach (var prop in je.EnumerateObject())
                    {
                        var nv = Normalize(prop.Value);
                        if (nv != null) d[prop.Name] = nv;
                    }
                    return d;
                case JsonValueKind.Array:
                    var l = new List<object>();
                    foreach (var e in je.EnumerateArray())
                    {
                        var nv = Normalize(e);
                        if (nv != null) l.Add(nv);
                    }
                    return l;
                case JsonValueKind.String: return je.GetString();
                case JsonValueKind.Number: return je.GetDouble();
                case JsonValueKind.True: return true;
                case JsonValueKind.False: return false;
                case JsonValueKind.Null: return null;
                default: return je.GetRawText();
            }
        }
        if (o is Dictionary<string, object> od)
        {
            var d = new Dictionary<string, object>();
            foreach (var kv in od)
            {
                var nv = Normalize(kv.Value);
                if (nv != null) d[kv.Key] = nv;
            }
            return d;
        }
        if (o is List<object> ol)
        {
            var l = new List<object>();
            foreach (var x in ol)
            {
                var nv = Normalize(x);
                if (nv != null) l.Add(nv);
            }
            return l;
        }
        return o;
    }

    public static string ToJson(object project) => JsonSerializer.Serialize(project, new JsonSerializerOptions { WriteIndented = true });

    public static string ToMarkdown(Dictionary<string, object> p)
    {
        var sb = new StringBuilder();
        sb.Append("# Systematic Review & Meta-Analysis Report\n\n");
        sb.Append($"_Generated: {DateTime.Now:yyyy-MM-dd HH:mm}_\n\n");

        if (p.TryGetValue("pico", out var picoObj) && picoObj is Dictionary<string, object> pico)
        {
            sb.Append("## PICO\n\n");
            sb.Append("| Element | Description |\n|---|---|\n");
            foreach (var k in new[] { "population", "intervention", "comparator", "outcomes" })
                sb.Append($"| {k[0].ToString().ToUpper() + k.Substring(1)} | {Str(pico, k)} |\n");
            sb.Append("\n");
        }

        if (p.TryGetValue("meta", out var metaObj) && metaObj is Dictionary<string, object> meta)
        {
            var res = meta.TryGetValue("results", out var r) && r is Dictionary<string, object> rr ? rr : null;
            if (res != null)
            {
                sb.Append("## Results\n\n");
                var measure = Str(res, "measure");
                var model = Str(res, "model");
                sb.Append($"**Effect measure:** {measure}  \n");
                sb.Append($"**Model:** {model}\n\n");
                if (res.TryGetValue("pooled", out var po) && po is Dictionary<string, object> pooled)
                {
                    sb.Append($"- **Pooled {measure}** = {F(Num(pooled, "effect"))} ");
                    sb.Append($"(95% CI: {F(Num(pooled, "ci_lower"))}–{F(Num(pooled, "ci_upper"))})\n");
                }
                if (res.TryGetValue("heterogeneity", out var he) && he is Dictionary<string, object> het)
                {
                    sb.Append($"- **I²** = {F(Num(het, "i2"), "0.0")}%, **τ²** = {F(Num(het, "tau2"), "0.000")}, ");
                    sb.Append($"**Q** = {F(Num(het, "q"), "0.0")} (df={Num(het, "df")})\n");
                }
                sb.Append("\n");
            }
        }

        if (p.TryGetValue("extraction", out var ex) && ex is Dictionary<string, object> ext &&
            ext.TryGetValue("studies", out var st) && st is List<object> studies)
        {
            sb.Append($"## Included studies ({studies.Count})\n\n");
            sb.Append("| Study | Design | Year | Int n | Ctrl n | Int events | Ctrl events |\n|---|---|---|---|---|---|---|\n");
            foreach (var s in studies)
            {
                if (s is Dictionary<string, object> d)
                    sb.Append($"| {Str(d, "study_id")} | {Str(d, "design")} | {Str(d, "year")} | {Num(d, "int_n")} | {Num(d, "ctrl_n")} | {Num(d, "int_events")} | {Num(d, "ctrl_events")} |\n");
            }
            sb.Append("\n");
        }

        sb.Append("---\n\n*Developed with poolr · for research use — not a substitute for clinical judgment.*\n");
        return sb.ToString();
    }

    public static string ToLatex(Dictionary<string, object> p)
    {
        var sb = new StringBuilder();
        sb.Append("\\documentclass[11pt]{article}\n\\usepackage[utf8]{inputenc}\n\\title{Systematic Review and Meta-Analysis Report}\n\\date{}\n\\begin{document}\n\\maketitle\n\n");
        if (p.TryGetValue("pico", out var picoObj) && picoObj is Dictionary<string, object> pico)
        {
            sb.Append("\\section{Introduction}\n");
            sb.Append($"Population: {Str(pico, "population")}. Intervention: {Str(pico, "intervention")} ");
            sb.Append($"compared to {Str(pico, "comparator")} on {Str(pico, "outcomes")}.\n\n");
        }
        if (p.TryGetValue("meta", out var metaObj) && metaObj is Dictionary<string, object> meta)
        {
            var res = meta.TryGetValue("results", out var r) && r is Dictionary<string, object> rr ? rr : null;
            if (res != null)
            {
                sb.Append("\\section{Results}\n");
                if (res.TryGetValue("pooled", out var po) && po is Dictionary<string, object> pooled)
                    sb.Append($"Pooled {Str(res, "measure")} = {F(Num(pooled, "effect"))} (95\\% CI: {F(Num(pooled, "ci_lower"))}--{F(Num(pooled, "ci_upper"))}).\n");
            }
        }
        sb.Append("\\end{document}\n");
        return sb.ToString();
    }

    /// <summary>Build a minimal valid .docx (OOXML) as raw bytes. Structure:
    /// [Content_Types].xml, _rels/.rels, word/document.xml, word/_rels/document.xml.rels.</summary>
    public static byte[] ToDocx(Dictionary<string, object> p)
    {
        var paras = new List<string>();
        paras.Add(Word.Heading("Systematic Review & Meta-Analysis Report", 0));
        paras.Add(Word.Text($"Generated: {DateTime.Now:yyyy-MM-dd HH:mm}"));
        if (p.TryGetValue("meta", out var metaObj) && metaObj is Dictionary<string, object> meta)
        {
            var res = meta.TryGetValue("results", out var r) && r is Dictionary<string, object> rr ? rr : null;
            if (res != null)
            {
                paras.Add(Word.Heading("Results", 1));
                if (res.TryGetValue("pooled", out var po) && po is Dictionary<string, object> pooled)
                    paras.Add(Word.Text($"Pooled {Str(res, "measure")} = {F(Num(pooled, "effect"))} (95% CI: {F(Num(pooled, "ci_lower"))}–{F(Num(pooled, "ci_upper"))})."));
                if (res.TryGetValue("heterogeneity", out var he) && he is Dictionary<string, object> het)
                    paras.Add(Word.Text($"I² = {F(Num(het, "i2"), "0.0")}%, τ² = {F(Num(het, "tau2"), "0.000")}, Q = {F(Num(het, "q"), "0.0")} (df={Num(het, "df")})."));
            }
        }
        string document = "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\r\n" +
            "<w:document xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\">" +
            "<w:body>" + string.Join("", paras) + "<w:sectPr/></w:body></w:document>";

        using var ms = new MemoryStream();
        using (var zip = new ZipArchive(ms, ZipArchiveMode.Create, true))
        {
            void Add(string path, string content)
            {
                var e = zip.CreateEntry(path);
                using var w = new StreamWriter(e.Open());
                w.Write(content);
            }
            Add("[Content_Types].xml",
                "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\r\n" +
                "<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\">" +
                "<Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/>" +
                "<Default Extension=\"xml\" ContentType=\"application/xml\"/>" +
                "<Override PartName=\"/word/document.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml\"/>" +
                "</Types>");
            Add("_rels/.rels",
                "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\r\n" +
                "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">" +
                "<Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"word/document.xml\"/>" +
                "</Relationships>");
            Add("word/document.xml", document);
            Add("word/_rels/document.xml.rels",
                "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\r\n" +
                "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"></Relationships>");
        }
        return ms.ToArray();
    }

    // ---- tiny helpers to pull values out of Dictionary<string,object> produced by System.Text.Json ----
    private static string Str(Dictionary<string, object> d, string k) => d.TryGetValue(k, out var v) && v != null ? v.ToString() ?? "" : "";
    private static double Num(Dictionary<string, object> d, string k)
    {
        if (d.TryGetValue(k, out var v))
        {
            if (v is JsonElement je && je.ValueKind == JsonValueKind.Number) return je.GetDouble();
            if (v is double db) return db;
            if (v is int i) return i;
            if (double.TryParse(v?.ToString(), NumberStyles.Any, CultureInfo.InvariantCulture, out var dbl)) return dbl;
        }
        return 0;
    }

    private static class Word
    {
        public static string Text(string t) =>
            $"<w:p><w:r><w:t xml:space=\"preserve\">{Escape(t)}</w:t></w:r></w:p>";
        public static string Heading(string t, int level) =>
            $"<w:p><w:pPr><w:pStyle w:val=\"Heading{level}\"/></w:pPr><w:r><w:t xml:space=\"preserve\">{Escape(t)}</w:t></w:r></w:p>";
        private static string Escape(string s) =>
            (s ?? "").Replace("&", "&amp;").Replace("<", "&lt;").Replace(">", "&gt;");
    }
}
