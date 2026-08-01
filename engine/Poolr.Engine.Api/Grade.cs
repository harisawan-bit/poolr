using System;
using System.Collections.Generic;
using System.Linq;

namespace Poolr.Engine.Api;

public class GradeAssessment
{
    public string Outcome { get; set; } = "";
    public int Studies { get; set; }
    public string Design { get; set; } = "RCT";
    public string RiskOfBias { get; set; } = "Not serious";
    public string Inconsistency { get; set; } = "Not serious";
    public string Indirectness { get; set; } = "Not serious";
    public string Imprecision { get; set; } = "Not serious";
    public string PublicationBias { get; set; } = "Not serious";

    public string StartingCertainty => Design.ToUpper() is "RCT" or "RANDOMIZED" ? "High" : "Low";

    public string FinalCertainty
    {
        get
        {
            int down = new[] { RiskOfBias, Inconsistency, Indirectness, Imprecision, PublicationBias }
                .Count(j => j == "Serious") * 1
                + new[] { RiskOfBias, Inconsistency, Indirectness, Imprecision, PublicationBias }
                .Count(j => j == "Very serious") * 1; // Very serious counted as Serious+1 below
            down = 0;
            foreach (var j in new[] { RiskOfBias, Inconsistency, Indirectness, Imprecision, PublicationBias })
            {
                if (j == "Serious") down += 1;
                else if (j == "Very serious") down += 2;
            }
            var levels = new[] { "High", "Moderate", "Low", "Very Low" };
            int idx = Array.IndexOf(levels, StartingCertainty);
            idx = Math.Min(idx + down, levels.Length - 1);
            return levels[idx];
        }
    }

    public List<string> DowngradeSummary
    {
        get
        {
            var r = new List<string>();
            var pairs = new (string, string)[] {
                ("Risk of bias", RiskOfBias), ("Inconsistency", Inconsistency),
                ("Indirectness", Indirectness), ("Imprecision", Imprecision),
                ("Publication bias", PublicationBias) };
            foreach (var (name, j) in pairs)
                if (j is "Serious" or "Very serious") r.Add($"{name}: {j}");
            return r;
        }
    }
}

public class GradeRequest
{
    public List<GradeOutcomeInput>? outcomes { get; set; }
    // optional auto-populate inputs
    public MetaResponse? meta { get; set; }
    public List<RobInput>? rob { get; set; }
}

public class GradeOutcomeInput
{
    public string outcome { get; set; } = "";
    public int studies { get; set; }
    public string design { get; set; } = "RCT";
    public string risk_of_bias { get; set; } = "Not serious";
    public string inconsistency { get; set; } = "Not serious";
    public string indirectness { get; set; } = "Not serious";
    public string imprecision { get; set; } = "Not serious";
    public string publication_bias { get; set; } = "Not serious";
}

public class RobInput
{
    public string? overall { get; set; }
}

public class GradeRow
{
    public string outcome { get; set; } = "";
    public int studies { get; set; }
    public string design { get; set; } = "";
    public string risk_of_bias { get; set; } = "";
    public string inconsistency { get; set; } = "";
    public string indirectness { get; set; } = "";
    public string imprecision { get; set; } = "";
    public string publication_bias { get; set; } = "";
    public string starting_certainty { get; set; } = "";
    public string final_certainty { get; set; } = "";
    public string downgrade_reasons { get; set; } = "";
}

public static class GradeEngine
{
    public static List<GradeRow> Evaluate(GradeRequest req)
    {
        var rows = new List<GradeRow>();
        if (req.outcomes == null) return rows;
        foreach (var o in req.outcomes)
        {
            var a = new GradeAssessment
            {
                Outcome = o.outcome,
                Studies = o.studies,
                Design = o.design,
                RiskOfBias = o.risk_of_bias,
                Inconsistency = o.inconsistency,
                Indirectness = o.indirectness,
                Imprecision = o.imprecision,
                PublicationBias = o.publication_bias,
            };
            // Auto-assess from meta if provided
            if (req.meta != null) AutoAssess(a, req.meta, req.rob);
            rows.Add(new GradeRow
            {
                outcome = a.Outcome,
                studies = a.Studies,
                design = a.Design,
                risk_of_bias = a.RiskOfBias,
                inconsistency = a.Inconsistency,
                indirectness = a.Indirectness,
                imprecision = a.Imprecision,
                publication_bias = a.PublicationBias,
                starting_certainty = a.StartingCertainty,
                final_certainty = a.FinalCertainty,
                downgrade_reasons = a.DowngradeSummary.Count > 0 ? string.Join("; ", a.DowngradeSummary) : "None",
            });
        }
        return rows;
    }

    private static void AutoAssess(GradeAssessment a, MetaResponse meta, List<RobInput>? rob)
    {
        var hetero = meta.heterogeneity;
        var pooled = meta.pooled;
        // Risk of bias
        if (rob != null && rob.Count > 0)
        {
            int high = rob.Count(r => r.overall == "High");
            int some = rob.Count(r => r.overall == "Some concerns");
            if (high * 2 + some > rob.Count) a.RiskOfBias = "Serious";
            else if (high + some > 0) a.RiskOfBias = "Not serious";
        }
        // Inconsistency
        if (hetero.i2 > 50) a.Inconsistency = "Serious";
        else if (hetero.i2 > 25) a.Inconsistency = "Not serious";
        // Imprecision
        double ciW = pooled.ci_upper - pooled.ci_lower;
        double effect = pooled.effect;
        if (effect > 0 && ciW / effect > 1.0) a.Imprecision = "Serious";
        else if (ciW / effect > 0.5) a.Imprecision = "Not serious";
        // Publication bias
        if (meta.publication_bias?.egger?.significant == true) a.PublicationBias = "Serious";
    }
}
