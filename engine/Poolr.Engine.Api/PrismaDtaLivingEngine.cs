using System;
using System.Collections.Generic;
using System.Linq;

namespace Poolr.Engine.Api;

/// <summary>
/// PRISMA-DTA (Diagnostic Test Accuracy) flow diagram generator (v0.6.0).
/// Generates the 4-phase flow diagram specific to DTA reviews.
/// </summary>
public static class PrismaDtaEngine
{
    public class PrismaDtaRequest
    {
        public int recordsIdentified { get; set; }
        public int recordsFromDatabases { get; set; }
        public int recordsFromRegisters { get; set; }
        public int recordsFromOtherSources { get; set; }
        public int recordsRemovedBeforeScreening { get; set; }
        public int recordsScreened { get; set; }
        public int recordsExcluded { get; set; }
        public int fullTextArticlesAssessed { get; set; }
        public int fullTextExcluded { get; set; }
        public int studiesIncluded { get; set; }
        public int studiesIncludedQuantitative { get; set; }
    }

    public class PrismaDtaResult
    {
        public int TotalIdentified => RecordsFromDatabases + RecordsFromRegisters + RecordsFromOtherSources;
        public int RecordsFromDatabases { get; set; }
        public int RecordsFromRegisters { get; set; }
        public int RecordsFromOtherSources { get; set; }
        public int RecordsRemovedBeforeScreening { get; set; }
        public int RecordsScreened { get; set; }
        public int RecordsExcluded { get; set; }
        public int FullTextArticlesAssessed { get; set; }
        public int FullTextExcluded { get; set; }
        public int StudiesIncluded { get; set; }
        public int StudiesIncludedQuantitative { get; set; }
        public string SvgFlowDiagram { get; set; } = "";
    }

    public static PrismaDtaResult Generate(PrismaDtaRequest req)
    {
        var result = new PrismaDtaResult
        {
            RecordsFromDatabases = req.recordsFromDatabases,
            RecordsFromRegisters = req.recordsFromRegisters,
            RecordsFromOtherSources = req.recordsFromOtherSources,
            RecordsRemovedBeforeScreening = req.recordsRemovedBeforeScreening,
            RecordsScreened = req.recordsScreened,
            RecordsExcluded = req.recordsExcluded,
            FullTextArticlesAssessed = req.fullTextArticlesAssessed,
            FullTextExcluded = req.fullTextExcluded,
            StudiesIncluded = req.studiesIncluded,
            StudiesIncludedQuantitative = req.studiesIncludedQuantitative,
        };

        result.SvgFlowDiagram = GenerateFlowDiagram(result);
        return result;
    }

    private static string GenerateFlowDiagram(PrismaDtaResult r)
    {
        var sb = new System.Text.StringBuilder();
        int w = 700, h = 500;
        sb.AppendLine($"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"{w}\" height=\"{h}\" viewBox=\"0 0 {w} {h}\" font-family=\"Inter, Arial, sans-serif\">");
        sb.AppendLine("<rect width=\"100%\" height=\"100%\" fill=\"#0c0d11\"/>");

        // Phase 1: Identification
        sb.AppendLine("<rect x=\"20\" y=\"20\" width=\"160\" height=\"80\" rx=\"8\" fill=\"#1a1b23\" stroke=\"#3a3c43\"/>");
        sb.AppendLine("<text x=\"100\" y=\"45\" text-anchor=\"middle\" font-size=\"11\" font-weight=\"700\" fill=\"#e6e7ea\">Identification</text>");
        sb.AppendLine($"<text x=\"100\" y=\"65\" text-anchor=\"middle\" font-size=\"10\" fill=\"#8b8d96\">Records identified: {r.TotalIdentified}</text>");
        sb.AppendLine($"<text x=\"100\" y=\"80\" text-anchor=\"middle\" font-size=\"9\" fill=\"#8b8d96\">Databases: {r.RecordsFromDatabases} | Registers: {r.RecordsFromRegisters}</text>");

        // Phase 2: Screening
        sb.AppendLine("<rect x=\"200\" y=\"20\" width=\"160\" height=\"80\" rx=\"8\" fill=\"#1a1b23\" stroke=\"#3a3c43\"/>");
        sb.AppendLine("<text x=\"280\" y=\"45\" text-anchor=\"middle\" font-size=\"11\" font-weight=\"700\" fill=\"#e6e7ea\">Screening</text>");
        sb.AppendLine($"<text x=\"280\" y=\"65\" text-anchor=\"middle\" font-size=\"10\" fill=\"#8b8d96\">Records screened: {r.RecordsScreened}</text>");
        sb.AppendLine($"<text x=\"280\" y=\"80\" text-anchor=\"middle\" font-size=\"9\" fill=\"#8b8d96\">Excluded: {r.RecordsExcluded}</text>");

        // Phase 3: Eligibility
        sb.AppendLine("<rect x=\"380\" y=\"20\" width=\"160\" height=\"80\" rx=\"8\" fill=\"#1a1b23\" stroke=\"#3a3c43\"/>");
        sb.AppendLine("<text x=\"460\" y=\"45\" text-anchor=\"middle\" font-size=\"11\" font-weight=\"700\" fill=\"#e6e7ea\">Eligibility</text>");
        sb.AppendLine($"<text x=\"460\" y=\"65\" text-anchor=\"middle\" font-size=\"10\" fill=\"#8b8d96\">Full-text assessed: {r.FullTextArticlesAssessed}</text>");
        sb.AppendLine($"<text x=\"460\" y=\"80\" text-anchor=\"middle\" font-size=\"9\" fill=\"#8b8d96\">Excluded: {r.FullTextExcluded}</text>");

        // Phase 4: Included
        sb.AppendLine("<rect x=\"560\" y=\"20\" width=\"120\" height=\"80\" rx=\"8\" fill=\"#1a1b23\" stroke=\"#3a3c43\"/>");
        sb.AppendLine("<text x=\"620\" y=\"45\" text-anchor=\"middle\" font-size=\"11\" font-weight=\"700\" fill=\"#e6e7ea\">Included</text>");
        sb.AppendLine($"<text x=\"620\" y=\"65\" text-anchor=\"middle\" font-size=\"10\" fill=\"#8b8d96\">Studies: {r.StudiesIncluded}</text>");
        sb.AppendLine($"<text x=\"620\" y=\"80\" text-anchor=\"middle\" font-size=\"9\" fill=\"#8b8d96\">Quantitative: {r.StudiesIncludedQuantitative}</text>");

        // Arrows
        sb.AppendLine("<line x1=\"180\" y1=\"60\" x2=\"198\" y2=\"60\" stroke=\"#8b8d96\" stroke-width=\"1.5\"/>");
        sb.AppendLine("<line x1=\"360\" y1=\"60\" x2=\"378\" y2=\"60\" stroke=\"#8b8d96\" stroke-width=\"1.5\"/>");
        sb.AppendLine("<line x1=\"540\" y1=\"60\" x2=\"558\" y2=\"60\" stroke=\"#8b8d96\" stroke-width=\"1.5\"/>");

        // DTA-specific note
        sb.AppendLine("<text x=\"350\" y=\"130\" text-anchor=\"middle\" font-size=\"10\" fill=\"#f2b84b\">PRISMA-DTA: Diagnostic Test Accuracy Reviews</text>");
        sb.AppendLine("<text x=\"350\" y=\"145\" text-anchor=\"middle\" font-size=\"9\" fill=\"#8b8d96\">Includes screening of index test accuracy, reference standard verification, and flow of patients</text>");

        sb.AppendLine("</svg>");
        return sb.ToString();
    }
}

/// <summary>
/// Living Systematic Review automation engine (v0.6.0).
/// Manages scheduled searches, deduplication, and alerting for new studies.
/// </summary>
public static class LivingReviewAutomationEngine
{
    public class LivingReviewConfig
    {
        public string projectId { get; set; } = "";
        public string searchQuery { get; set; } = "";
        public List<string> databases { get; set; } = new();
        public string schedule { get; set; } = "weekly"; // daily, weekly, monthly
        public DateTime lastRun { get; set; }
        public DateTime nextRun { get; set; }
        public List<string> knownStudyIds { get; set; } = new();
        public bool alertOnNewStudies { get; set; } = true;
    }

    public class LivingReviewRun
    {
        public DateTime runDate { get; set; }
        public int newStudiesFound { get; set; }
        public int duplicatesRemoved { get; set; }
        public int studiesAfterDedup { get; set; }
        public List<string> newStudyIds { get; set; } = new();
        public bool alertSent { get; set; }
    }

    public class LivingReviewResult
    {
        public LivingReviewConfig config { get; set; } = new();
        public List<LivingReviewRun> runs { get; set; } = new();
        public int totalNewStudies { get; set; }
        public int totalDuplicatesRemoved { get; set; }
        public bool isDue { get; set; }
        public TimeSpan timeUntilNextRun { get; set; }
    }

    public static LivingReviewResult Run(LivingReviewConfig config, List<string> newStudyIds)
    {
        var result = new LivingReviewResult { config = config };

        // Check if due
        result.isDue = DateTime.UtcNow >= config.nextRun;
        result.timeUntilNextRun = config.nextRun - DateTime.UtcNow;

        if (!result.isDue)
            return result;

        // Deduplicate
        var uniqueNew = newStudyIds.Except(config.knownStudyIds).ToList();
        int duplicates = newStudyIds.Count - uniqueNew.Count;

        var run = new LivingReviewRun
        {
            runDate = DateTime.UtcNow,
            newStudiesFound = uniqueNew.Count,
            duplicatesRemoved = duplicates,
            studiesAfterDedup = uniqueNew.Count,
            newStudyIds = uniqueNew,
            alertSent = config.alertOnNewStudies && uniqueNew.Count > 0
        };

        result.runs.Add(run);
        result.totalNewStudies = uniqueNew.Count;
        result.totalDuplicatesRemoved = duplicates;

        // Update config
        config.lastRun = DateTime.UtcNow;
        config.nextRun = config.schedule switch
        {
            "daily" => DateTime.UtcNow.AddDays(1),
            "weekly" => DateTime.UtcNow.AddDays(7),
            "monthly" => DateTime.UtcNow.AddDays(30),
            _ => DateTime.UtcNow.AddDays(7)
        };
        config.knownStudyIds.AddRange(uniqueNew);

        return result;
    }
}
