using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Xml.Linq;

namespace Poolr.Engine.Api;

/// <summary>
/// RevMan 5 / RevMan Web import/export engine (v0.6.0).
/// Supports both .rm5 XML format and the exported CSV format.
/// Mirrors R meta::read.rm5 and meta::write.rm5 functionality.
/// </summary>
public static class RevManEngine
{
    // ── Data model ─────────────────────────────────────────────────────────

    public class RevManComparison
    {
        public string ComparisonLabel { get; set; } = "";
        public string TreatmentLabel { get; set; } = "";
        public string ComparatorLabel { get; set; } = "";
        public List<RevManOutcome> Outcomes { get; set; } = new();
    }

    public class RevManOutcome
    {
        public string OutcomeLabel { get; set; } = "";
        public string Type { get; set; } = "D"; // D=dichotomous, C=continuous, P=IPD
        public string Method { get; set; } = "Inverse";
        public string Model { get; set; } = "Random";
        public string Sm { get; set; } = "OR";
        public List<RevManStudy> Studies { get; set; } = new();
        public RevManPooledResult? Pooled { get; set; }
    }

    public class RevManStudy
    {
        public string StudyLabel { get; set; } = "";
        public string Year { get; set; } = "";
        // Dichotomous
        public int? EventsE { get; set; }
        public int? NE { get; set; }
        public int? EventsC { get; set; }
        public int? NC { get; set; }
        // Continuous
        public double? MeanE { get; set; }
        public double? SdE { get; set; }
        public double? MeanC { get; set; }
        public double? SdC { get; set; }
        // IPD
        public double? OE { get; set; }
        public double? V { get; set; }
        // Common
        public double? TE { get; set; }
        public double? SeTE { get; set; }
        public double Weight { get; set; }
    }

    public class RevManPooledResult
    {
        public double TE { get; set; }
        public double Lower { get; set; }
        public double Upper { get; set; }
        public double Z { get; set; }
        public double P { get; set; }
        public double I2 { get; set; }
        public double Tau2 { get; set; }
        public double Q { get; set; }
        public int K { get; set; }
    }

    public class RevManProject
    {
        public string Title { get; set; } = "";
        public string Description { get; set; } = "";
        public List<RevManComparison> Comparisons { get; set; } = new();
    }

    // ── RM5 XML Import ─────────────────────────────────────────────────────

    public static RevManProject ReadRm5(string filePath)
    {
        var doc = XDocument.Load(filePath);
        var project = new RevManProject();

        // Extract title
        var titleEl = doc.Root?.Element("Title");
        project.Title = titleEl?.Value ?? Path.GetFileNameWithoutExtension(filePath);

        // Find AnalysisTree
        var analysisTree = doc.Root?.Descendants("AnalysisTree").FirstOrDefault();
        if (analysisTree == null)
            throw new ArgumentException("No AnalysisTree found in .rm5 file");

        foreach (var compNode in analysisTree.Elements("Comparison"))
        {
            var comparison = new RevManComparison
            {
                ComparisonLabel = compNode.Attribute("Name")?.Value ?? "",
            };

            // Parse treatment/comparator labels from subnode
            var labelNode = compNode.Element("Label");
            if (labelNode != null)
            {
                var parts = labelNode.Value.Split(new[] { " vs " }, StringSplitOptions.None);
                if (parts.Length >= 2)
                {
                    comparison.TreatmentLabel = parts[0].Trim();
                    comparison.ComparatorLabel = parts[1].Trim();
                }
            }

            foreach (var outcomeNode in compNode.Elements("Outcome"))
            {
                var outcome = ParseOutcomeXml(outcomeNode);
                comparison.Outcomes.Add(outcome);
            }

            project.Comparisons.Add(comparison);
        }

        return project;
    }

    private static RevManOutcome ParseOutcomeXml(XElement outcomeNode)
    {
        var outcome = new RevManOutcome
        {
            OutcomeLabel = outcomeNode.Attribute("Name")?.Value ?? "",
            Type = outcomeNode.Element("Type")?.Value ?? "D",
            Method = outcomeNode.Element("Method")?.Value ?? "Inverse",
            Model = outcomeNode.Element("Method")?.Value == "Fixed" ? "Fixed" : "Random",
        };

        // Parse summary measure
        var smNode = outcomeNode.Element("SM");
        if (smNode != null) outcome.Sm = smNode.Value;

        // Parse pooled result
        var pooledNode = outcomeNode.Element("Pooled");
        if (pooledNode != null)
        {
            outcome.Pooled = new RevManPooledResult
            {
                TE = ParseDouble(pooledNode.Element("TE")?.Value) ?? 0,
                Lower = ParseDouble(pooledNode.Element("Lower")?.Value) ?? 0,
                Upper = ParseDouble(pooledNode.Element("Upper")?.Value) ?? 0,
                Z = ParseDouble(pooledNode.Element("Z")?.Value) ?? 0,
                P = ParseDouble(pooledNode.Element("P")?.Value) ?? 1,
                I2 = ParseDouble(pooledNode.Element("I2")?.Value) ?? 0,
                Tau2 = ParseDouble(pooledNode.Element("Tau2")?.Value) ?? 0,
                Q = ParseDouble(pooledNode.Element("Q")?.Value) ?? 0,
                K = ParseInt(pooledNode.Element("K")?.Value) ?? 0,
            };
        }

        // Parse studies
        foreach (var studyNode in outcomeNode.Elements("Study"))
        {
            var study = new RevManStudy
            {
                StudyLabel = studyNode.Attribute("Name")?.Value ?? "",
                Year = studyNode.Element("Year")?.Value ?? "",
            };

            // Dichotomous
            var dichNode = studyNode.Element("Dichotomous");
            if (dichNode != null)
            {
                study.EventsE = ParseInt(dichNode.Element("EventsE")?.Value);
                study.NE = ParseInt(dichNode.Element("NE")?.Value);
                study.EventsC = ParseInt(dichNode.Element("EventsC")?.Value);
                study.NC = ParseInt(dichNode.Element("NC")?.Value);
            }

            // Continuous
            var contNode = studyNode.Element("Continuous");
            if (contNode != null)
            {
                study.MeanE = ParseDouble(contNode.Element("MeanE")?.Value);
                study.SdE = ParseDouble(contNode.Element("SdE")?.Value);
                study.MeanC = ParseDouble(contNode.Element("MeanC")?.Value);
                study.SdC = ParseDouble(contNode.Element("SdC")?.Value);
            }

            // IPD
            var ipdNode = studyNode.Element("IPD");
            if (ipdNode != null)
            {
                study.OE = ParseDouble(ipdNode.Element("OE")?.Value);
                study.V = ParseDouble(ipdNode.Element("V")?.Value);
            }

            // Common
            study.TE = ParseDouble(studyNode.Element("TE")?.Value);
            study.SeTE = ParseDouble(studyNode.Element("SeTE")?.Value);
            study.Weight = ParseDouble(studyNode.Element("Weight")?.Value) ?? 0;

            outcome.Studies.Add(study);
        }

        return outcome;
    }

    // ── CSV Import ─────────────────────────────────────────────────────────

    public static RevManProject ReadRm5Csv(string filePath)
    {
        var lines = File.ReadAllLines(filePath);
        if (lines.Length < 2)
            throw new ArgumentException("CSV file is empty");

        var project = new RevManProject
        {
            Title = Path.GetFileNameWithoutExtension(filePath)
        };

        // Parse header
        var header = ParseCsvLine(lines[0]);
        var colMap = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        for (int i = 0; i < header.Length; i++)
            colMap[header[i].Trim()] = i;

        var comparisons = new Dictionary<string, RevManComparison>();
        var outcomes = new Dictionary<string, RevManOutcome>();

        for (int lineIdx = 1; lineIdx < lines.Length; lineIdx++)
        {
            if (string.IsNullOrWhiteSpace(lines[lineIdx])) continue;
            var fields = ParseCsvLine(lines[lineIdx]);

            string Get(string col) => colMap.ContainsKey(col) && colMap[col] < fields.Length ? fields[colMap[col]].Trim() : "";

            var compNo = Get("Comparison Number");
            var outcomeNo = Get("Outcome Number");
            var studyLabel = Get("studlab");
            var year = Get("year");

            if (string.IsNullOrEmpty(studyLabel)) continue;

            var compKey = compNo;
            if (!comparisons.TryGetValue(compKey, out var comp))
            {
                comp = new RevManComparison
                {
                    ComparisonLabel = Get("complab"),
                    TreatmentLabel = Get("label.e"),
                    ComparatorLabel = Get("label.c"),
                };
                comparisons[compKey] = comp;
            }

            var outcomeKey = $"{compKey}::{outcomeNo}";
            if (!outcomes.TryGetValue(outcomeKey, out var outcome))
            {
                outcome = new RevManOutcome
                {
                    OutcomeLabel = Get("outclab"),
                    Type = Get("type"),
                    Method = Get("method"),
                    Model = Get("model"),
                    Sm = Get("sm"),
                };
                outcomes[outcomeKey] = outcome;
                comp.Outcomes.Add(outcome);
            }

            var study = new RevManStudy
            {
                StudyLabel = studyLabel,
                Year = year,
                TE = ParseDouble(Get("TE")),
                SeTE = ParseDouble(Get("seTE")),
                Weight = ParseDouble(Get("weight")) ?? 0,
            };

            // Dichotomous
            if (Get("type") == "D" || Get("event.e") != "")
            {
                study.EventsE = ParseInt(Get("event.e"));
                study.NE = ParseInt(Get("n.e"));
                study.EventsC = ParseInt(Get("event.c"));
                study.NC = ParseInt(Get("n.c"));
            }

            // Continuous
            if (Get("type") == "C" || Get("mean.e") != "")
            {
                study.MeanE = ParseDouble(Get("mean.e"));
                study.SdE = ParseDouble(Get("sd.e"));
                study.MeanC = ParseDouble(Get("mean.c"));
                study.SdC = ParseDouble(Get("sd.c"));
            }

            // IPD
            if (Get("type") == "P" || Get("O.E") != "")
            {
                study.OE = ParseDouble(Get("O.E"));
                study.V = ParseDouble(Get("V"));
            }

            outcome.Studies.Add(study);

            // Pooled result (only need to set once per outcome)
            if (outcome.Pooled == null && Get("TE.pooled") != "")
            {
                outcome.Pooled = new RevManPooledResult
                {
                    TE = ParseDouble(Get("TE.pooled")) ?? 0,
                    Lower = ParseDouble(Get("lower")) ?? 0,
                    Upper = ParseDouble(Get("upper")) ?? 0,
                    Z = ParseDouble(Get("Z.pooled")) ?? 0,
                    P = ParseDouble(Get("pval.pooled")) ?? 1,
                    I2 = ParseDouble(Get("I2")) ?? 0,
                    Tau2 = ParseDouble(Get("tau2")) ?? 0,
                    Q = ParseDouble(Get("Q")) ?? 0,
                    K = ParseInt(Get("k")) ?? 0,
                };
            }
        }

        project.Comparisons = comparisons.Values.ToList();
        return project;
    }

    // ── CSV Export ─────────────────────────────────────────────────────────

    public static string WriteRm5Csv(RevManProject project)
    {
        var sb = new StringBuilder();

        // Header
        sb.AppendLine("Comparison Number,Outcome Number,Subgroup Number,studlab,year,event.e,n.e,event.c,n.c,mean.e,sd.e,mean.c,sd.c,O.E,V,TE,seTE,lower,upper,weight,order,grplab,type,method,model,common,random,outclab,k,event.e.pooled,n.e.pooled,event.c.pooled,n.c.pooled,TE.pooled,lower,upper,weight.pooled,Z.pooled,pval.pooled,Q,pval.Q,I2,tau2,Q.w,pval.Q.w,I2.w,label.e,label.c,label.left,label.right,complab");

        int compNo = 1;
        foreach (var comp in project.Comparisons)
        {
            int outcomeNo = 1;
            foreach (var outcome in comp.Outcomes)
            {
                int order = 1;
                foreach (var study in outcome.Studies)
                {
                    var fields = new List<string>
                    {
                        compNo.ToString(),
                        outcomeNo.ToString(),
                        "1", // subgroup number
                        study.StudyLabel,
                        study.Year,
                        study.EventsE?.ToString() ?? "",
                        study.NE?.ToString() ?? "",
                        study.EventsC?.ToString() ?? "",
                        study.NC?.ToString() ?? "",
                        study.MeanE?.ToString("G6") ?? "",
                        study.SdE?.ToString("G6") ?? "",
                        study.MeanC?.ToString("G6") ?? "",
                        study.SdC?.ToString("G6") ?? "",
                        study.OE?.ToString("G6") ?? "",
                        study.V?.ToString("G6") ?? "",
                        study.TE?.ToString("G6") ?? "",
                        study.SeTE?.ToString("G6") ?? "",
                        study.TE != null && study.SeTE != null ? (study.TE.Value - 1.96 * study.SeTE.Value).ToString("G6") : "",
                        study.TE != null && study.SeTE != null ? (study.TE.Value + 1.96 * study.SeTE.Value).ToString("G6") : "",
                        study.Weight.ToString("F1"),
                        order.ToString(),
                        "", // grplab
                        outcome.Type,
                        outcome.Method,
                        outcome.Model,
                        outcome.Model == "Fixed" ? "TRUE" : "FALSE",
                        outcome.Model == "Random" ? "TRUE" : "FALSE",
                        outcome.OutcomeLabel,
                        outcome.Pooled?.K.ToString() ?? "0",
                        "", "", "", "", // pooled events/n
                        outcome.Pooled?.TE.ToString("G6") ?? "",
                        outcome.Pooled?.Lower.ToString("G6") ?? "",
                        outcome.Pooled?.Upper.ToString("G6") ?? "",
                        outcome.Studies.Sum(s => s.Weight).ToString("F1"),
                        outcome.Pooled?.Z.ToString("G6") ?? "",
                        outcome.Pooled?.P.ToString("G6") ?? "",
                        outcome.Pooled?.Q.ToString("G6") ?? "",
                        "1", // pval.Q
                        outcome.Pooled?.I2.ToString("F1") ?? "0",
                        outcome.Pooled?.Tau2.ToString("G6") ?? "0",
                        "", "", "0", // Q.w, pval.Q.w, I2.w
                        comp.TreatmentLabel,
                        comp.ComparatorLabel,
                        comp.TreatmentLabel,
                        comp.ComparatorLabel,
                        comp.ComparisonLabel,
                    };
                    sb.AppendLine(string.Join(",", fields.Select(EscapeCsv)));
                    order++;
                }
                outcomeNo++;
            }
            compNo++;
        }

        return sb.ToString();
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    private static double? ParseDouble(string? s)
    {
        if (string.IsNullOrWhiteSpace(s)) return null;
        return double.TryParse(s.Trim(), System.Globalization.NumberStyles.Float,
            System.Globalization.CultureInfo.InvariantCulture, out double v) ? v : null;
    }

    private static int? ParseInt(string? s)
    {
        if (string.IsNullOrWhiteSpace(s)) return null;
        return int.TryParse(s.Trim(), out int v) ? v : null;
    }

    private static string[] ParseCsvLine(string line)
    {
        var fields = new List<string>();
        var sb = new StringBuilder();
        bool inQuotes = false;

        for (int i = 0; i < line.Length; i++)
        {
            char c = line[i];
            if (c == '"')
            {
                if (inQuotes && i + 1 < line.Length && line[i + 1] == '"')
                {
                    sb.Append('"');
                    i++;
                }
                else
                {
                    inQuotes = !inQuotes;
                }
            }
            else if (c == ',' && !inQuotes)
            {
                fields.Add(sb.ToString());
                sb.Clear();
            }
            else
            {
                sb.Append(c);
            }
        }
        fields.Add(sb.ToString());
        return fields.ToArray();
    }

    private static string EscapeCsv(string s)
    {
        if (string.IsNullOrEmpty(s)) return "";
        if (s.Contains(',') || s.Contains('"') || s.Contains('\n'))
            return "\"" + s.Replace("\"", "\"\"") + "\"";
        return s;
    }
}
