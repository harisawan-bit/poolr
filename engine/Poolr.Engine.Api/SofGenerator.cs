using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;

namespace Poolr.Engine.Api;

/// <summary>
/// v0.5.1 — GRADE Summary-of-Findings (SoF) table generator.
/// Combines per-outcome pooled results, RoB judgements and the existing
/// GradeEngine downgrades into a Cochrane-style SoF structure (markdown +
/// structured rows). OIS-based imprecision: optimal information size via
/// a conventional 2x2 approximation when binary, or sample-size heuristic.
/// </summary>
public static class SofGenerator
{
    public class SofOutcomeInput : GradeOutcomeInput
    {
        /// <summary>Pooled effect on the natural scale (e.g. OR), optional.</summary>
        public double? effect { get; set; }
        public double? ci_lower { get; set; }
        public double? ci_upper { get; set; }
        public string? measure { get; set; }         // OR / RR / MD / SMD ...
        public int? total_n { get; set; }             // participants across studies
        public bool is_binary { get; set; }
        /// <summary>control-group event rate for OIS (binary outcomes)</summary>
        public double? control_rate { get; set; }
    }

    public class SofRequest
    {
        public List<SofOutcomeInput>? outcomes { get; set; }
        public string? title { get; set; }
        public string? comparison { get; set; }
        public MetaResponse? meta { get; set; }
        public List<RobInput>? rob { get; set; }
    }

    public class SofRow
    {
        public string outcome = "";
        public int studies;
        public int total_n;
        public string effect_estimate = "";
        public string risk_control = "See comment";
        public string risk_intervention = "";
        public string relative_effect = "";
        public string certainty = "";
        public string imprecision_basis = "";
        public List<string> downgrades = new();
        public double? ois { get; set; }
        public bool ois_met;
    }

    public static (List<SofRow> rows, string markdown) Generate(SofRequest req)
    {
        var gradeReq = new GradeRequest
        {
            outcomes = req.outcomes?.Select(o => (GradeOutcomeInput)o).ToList(),
            meta = req.meta,
            rob = req.rob,
        };
        var grades = GradeEngine.Evaluate(gradeReq);
        var inputs = req.outcomes ?? new();
        var rows = new List<SofRow>();

        for (int i = 0; i < inputs.Count && i < grades.Count; i++)
        {
            var inp = inputs[i];
            var g = grades[i];
            var (ois, met, basis) = ImprecisionOis(inp);
            rows.Add(new SofRow
            {
                outcome = g.outcome,
                studies = g.studies,
                total_n = inp.total_n ?? 0,
                effect_estimate = inp.effect.HasValue
                    ? $"{inp.measure ?? ""} {Fmt(inp.effect.Value)} ({Fmt(inp.ci_lower ?? 0)} to {Fmt(inp.ci_upper ?? 0)})"
                    : "—",
                relative_effect = inp.is_binary && inp.effect.HasValue ? $"{inp.measure} {Fmt(inp.effect.Value)}" : "",
                risk_intervention = inp.effect.HasValue && inp.control_rate.HasValue && inp.is_binary
                    ? Fmt(OddsToRisk(inp.control_rate.Value, inp.effect.Value) * 1000.0) + " per 1000"
                    : "—",
                certainty = g.final_certainty,
                imprecision_basis = basis,
                downgrades = g.downgrade_reasons == "None" ? new() : g.downgrade_reasons.Split("; ").ToList(),
                ois = ois,
                ois_met = met,
            });
        }

        return (rows, ToMarkdown(req.title ?? "Summary of findings", req.comparison, rows));
    }

    /// <summary>OIS: RCT default alpha .05, beta .20, for binary events with control rate p0:
    /// N ≈ 4 * (z_{a/2}+z_b)^2 / (ln(OR))^2 / (p0*(1-p0)) approximated via the
    /// probability-scale difference implied by the OR.</summary>
    private static (double?, bool, string) ImprecisionOis(SofOutcomeInput o)
    {
        if (!o.total_n.HasValue)
            return (null, false, "insufficient data (total N unknown)");
        if (o.is_binary && o.control_rate.HasValue && o.effect.HasValue && Math.Abs(Math.Log(Math.Max(o.effect.Value, 1e-9))) > 1e-9)
        {
            double zA = 1.959964, zB = 0.8416212;
            double p0 = Math.Clamp(o.control_rate.Value, 0.001, 0.999);
            double oddsRatio = Math.Max(o.effect.Value, 1e-6);
            double p1 = OddsToRisk(p0, oddsRatio);
            // cluster of formulas; use two-proportion sample size (per group) x2
            double pbar = (p0 + p1) / 2;
            double nPerGroup = Math.Pow(zA + zB, 2) * (p0 * (1 - p0) + p1 * (1 - p1)) / Math.Pow(p1 - p0, 2);
            double ois = 2 * Math.Ceiling(nPerGroup * 2);   // x2 inflation for design/attrition convention
            bool met = o.total_n.Value >= ois;
            return (ois, met, $"OIS {ois:0} (p0={p0:0.000}, OR={oddsRatio:0.00}); total N {o.total_n} {(met ? "meets" : "below")} OIS");
        }
        // continuous fallback: rule-of-thumb 400 participants for a single comparable outcome class
        bool metC = o.total_n.Value >= 400;
        return (400, metC, metC ? "total N meets conventional threshold (400)" : $"total N {o.total_n} below conventional 400");
    }

    private static double OddsToRisk(double p0, double orr)
    {
        double odds0 = p0 / (1 - p0);
        double odds1 = odds0 * orr;
        return odds1 / (1 + odds1);
    }

    private static string Fmt(double v) => v.ToString("0.###", CultureInfo.InvariantCulture);

    private static string ToMarkdown(string title, string? comparison, List<SofRow> rows)
    {
        var sb = new StringBuilder();
        sb.AppendLine($"### {title}");
        if (!string.IsNullOrWhiteSpace(comparison)) sb.AppendLine($"**Comparison:** {comparison}");
        sb.AppendLine();
        sb.AppendLine("| Outcome | Studies (N) | Effect estimate | Risk (per 1000) | Certainty | Imprecision basis | Downgrades |");
        sb.AppendLine("|---|---|---|---|---|---|---|");
        foreach (var r in rows)
        {
            string risk = r.risk_intervention != "—" ? r.risk_intervention : r.risk_control;
            sb.AppendLine($"| {Esc(r.outcome)} | {r.studies} ({r.total_n}) | {Esc(r.effect_estimate)} | {risk} | **{Esc(r.certainty)}** | {Esc(r.imprecision_basis)} | {(r.downgrades.Count > 0 ? Esc(string.Join("; ", r.downgrades)) : "none")} |");
        }
        sb.AppendLine();
        sb.AppendLine("*Certainty follows GRADE: High / Moderate / Low / Very Low. OIS = optimal information size.*");
        return sb.ToString();
    }

    private static string Esc(string s) => (s ?? "").Replace("|", "\\|").Replace("\n", " ");
}
