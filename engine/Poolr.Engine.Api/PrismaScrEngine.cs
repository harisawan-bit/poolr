using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;

namespace Poolr.Engine.Api;

/// <summary>
/// PRISMA-ScR (Scoping Review) flow diagram generator (v0.6.0).
/// Generates the PRISMA-ScR flow diagram for scoping reviews.
/// </summary>
public static class PrismaScrEngine
{
    public class PrismaScrRequest
    {
        public int recordsFromDatabases { get; set; }
        public int recordsFromRegisters { get; set; }
        public int recordsFromOrganizations { get; set; }
        public int recordsFromInternet { get; set; }
        public int recordsFromCitationSearching { get; set; }
        public int recordsFromOtherSources { get; set; }
        public int totalRecordsIdentified { get; set; }
        public int recordsRemovedBeforeScreening { get; set; }
        public int recordsScreened { get; set; }
        public int recordsExcluded { get; set; }
        public int fullTextArticlesAssessed { get; set; }
        public int fullTextExcluded { get; set; }
        public int studiesIncluded { get; set; }
        public int reportsOfIncludedStudies { get; set; }
    }

    public class PrismaScrResult
    {
        public int TotalIdentified { get; set; }
        public int RecordsRemovedBeforeScreening { get; set; }
        public int RecordsScreened { get; set; }
        public int RecordsExcluded { get; set; }
        public int FullTextAssessed { get; set; }
        public int FullTextExcluded { get; set; }
        public int StudiesIncluded { get; set; }
        public int ReportsIncluded { get; set; }
        public string SvgFlowDiagram { get; set; } = "";
        public List<ChecklistItem> Checklist { get; set; } = new();
    }

    public class ChecklistItem
    {
        public string Section { get; set; } = "";
        public int ItemNumber { get; set; }
        public string Item { get; set; } = "";
    }

    public static PrismaScrResult Generate(PrismaScrRequest req)
    {
        int total = req.recordsFromDatabases + req.recordsFromRegisters + req.recordsFromOrganizations +
                    req.recordsFromInternet + req.recordsFromCitationSearching + req.recordsFromOtherSources;
        if (total == 0) total = req.totalRecordsIdentified;

        var result = new PrismaScrResult
        {
            TotalIdentified = total,
            RecordsRemovedBeforeScreening = req.recordsRemovedBeforeScreening,
            RecordsScreened = req.recordsScreened,
            RecordsExcluded = req.recordsExcluded,
            FullTextAssessed = req.fullTextArticlesAssessed,
            FullTextExcluded = req.fullTextExcluded,
            StudiesIncluded = req.studiesIncluded,
            ReportsIncluded = req.reportsOfIncludedStudies
        };

        result.SvgFlowDiagram = GenerateFlowDiagram(result);
        result.Checklist = GenerateChecklist();

        return result;
    }

    private static string GenerateFlowDiagram(PrismaScrResult r)
    {
        var sb = new StringBuilder();
        int w = 750, h = 600;
        sb.AppendLine($"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"{w}\" height=\"{h}\" viewBox=\"0 0 {w} {h}\" font-family=\"Inter, Arial, sans-serif\">");
        sb.AppendLine("<rect width=\"100%\" height=\"100%\" fill=\"#0c0d11\"/>");

        // Phase 1: Identification
        sb.AppendLine("<rect x=\"20\" y=\"20\" width=\"180\" height=\"90\" rx=\"8\" fill=\"#1a1b23\" stroke=\"#3a3c43\"/>");
        sb.AppendLine("<text x=\"110\" y=\"45\" text-anchor=\"middle\" font-size=\"11\" font-weight=\"700\" fill=\"#e6e7ea\">Identification</text>");
        sb.AppendLine($"<text x=\"110\" y=\"65\" text-anchor=\"middle\" font-size=\"9\" fill=\"#8b8d96\">Records identified: {r.TotalIdentified}</text>");
        sb.AppendLine($"<text x=\"110\" y=\"80\" text-anchor=\"middle\" font-size=\"8\" fill=\"#8b8d96\">Databases, registers, organizations,</text>");
        sb.AppendLine($"<text x=\"110\" y=\"92\" text-anchor=\"middle\" font-size=\"8\" fill=\"#8b8d96\">internet, citation searching, other</text>");

        // Phase 2: Screening
        sb.AppendLine("<rect x=\"220\" y=\"20\" width=\"180\" height=\"90\" rx=\"8\" fill=\"#1a1b23\" stroke=\"#3a3c43\"/>");
        sb.AppendLine("<text x=\"310\" y=\"45\" text-anchor=\"middle\" font-size=\"11\" font-weight=\"700\" fill=\"#e6e7ea\">Screening</text>");
        sb.AppendLine($"<text x=\"310\" y=\"65\" text-anchor=\"middle\" font-size=\"9\" fill=\"#8b8d96\">Records screened: {r.RecordsScreened}</text>");
        sb.AppendLine($"<text x=\"310\" y=\"80\" text-anchor=\"middle\" font-size=\"9\" fill=\"#8b8d96\">Excluded: {r.RecordsExcluded}</text>");

        // Phase 3: Eligibility
        sb.AppendLine("<rect x=\"420\" y=\"20\" width=\"180\" height=\"90\" rx=\"8\" fill=\"#1a1b23\" stroke=\"#3a3c43\"/>");
        sb.AppendLine("<text x=\"510\" y=\"45\" text-anchor=\"middle\" font-size=\"11\" font-weight=\"700\" fill=\"#e6e7ea\">Eligibility</text>");
        sb.AppendLine($"<text x=\"510\" y=\"65\" text-anchor=\"middle\" font-size=\"9\" fill=\"#8b8d96\">Full-text assessed: {r.FullTextAssessed}</text>");
        sb.AppendLine($"<text x=\"510\" y=\"80\" text-anchor=\"middle\" font-size=\"9\" fill=\"#8b8d96\">Excluded: {r.FullTextExcluded}</text>");

        // Phase 4: Included
        sb.AppendLine("<rect x=\"620\" y=\"20\" width=\"110\" height=\"90\" rx=\"8\" fill=\"#1a1b23\" stroke=\"#3a3c43\"/>");
        sb.AppendLine("<text x=\"675\" y=\"45\" text-anchor=\"middle\" font-size=\"11\" font-weight=\"700\" fill=\"#e6e7ea\">Included</text>");
        sb.AppendLine($"<text x=\"675\" y=\"65\" text-anchor=\"middle\" font-size=\"9\" fill=\"#8b8d96\">Studies: {r.StudiesIncluded}</text>");
        sb.AppendLine($"<text x=\"675\" y=\"80\" text-anchor=\"middle\" font-size=\"9\" fill=\"#8b8d96\">Reports: {r.ReportsIncluded}</text>");

        // Arrows
        sb.AppendLine("<line x1=\"200\" y1=\"65\" x2=\"218\" y2=\"65\" stroke=\"#8b8d96\" stroke-width=\"1.5\"/>");
        sb.AppendLine("<line x1=\"400\" y1=\"65\" x2=\"418\" y2=\"65\" stroke=\"#8b8d96\" stroke-width=\"1.5\"/>");
        sb.AppendLine("<line x1=\"600\" y1=\"65\" x2=\"618\" y2=\"65\" stroke=\"#8b8d96\" stroke-width=\"1.5\"/>");

        // Records removed before screening
        sb.AppendLine($"<text x=\"210\" y=\"130\" text-anchor=\"middle\" font-size=\"8\" fill=\"#8b8d96\">Records removed before screening: {r.RecordsRemovedBeforeScreening}</text>");

        // PRISMA-ScR specific note
        sb.AppendLine("<text x=\"375\" y=\"160\" text-anchor=\"middle\" font-size=\"10\" fill=\"#f2b84b\">PRISMA-ScR: Extension for Scoping Reviews</text>");
        sb.AppendLine("<text x=\"375\" y=\"175\" text-anchor=\"middle\" font-size=\"8\" fill=\"#8b8d96\">Scoping reviews map evidence breadth; no quality appraisal or meta-analysis</text>");

        // Checklist summary
        sb.AppendLine("<text x=\"20\" y=\"200\" font-size=\"10\" font-weight=\"700\" fill=\"#e6e7ea\">PRISMA-ScR Checklist (20 items)</text>");
        sb.AppendLine("<text x=\"20\" y=\"215\" font-size=\"8\" fill=\"#8b8d96\">Title, Abstract, Introduction, Methods (protocol, eligibility, information sources, search, selection, data charting, data items, synthesis), Results (selection, characteristics, synthesis), Discussion, Funding</text>");

        sb.AppendLine("</svg>");
        return sb.ToString();
    }

    private static List<ChecklistItem> GenerateChecklist()
    {
        return new List<ChecklistItem>
        {
            new() { Section = "Title", ItemNumber = 1, Item = "Identify the report as a scoping review" },
            new() { Section = "Abstract", ItemNumber = 2, Item = "Provide a structured summary" },
            new() { Section = "Introduction", ItemNumber = 3, Item = "Describe the rationale for the review" },
            new() { Section = "Introduction", ItemNumber = 4, Item = "Provide an explicit questions/objectives" },
            new() { Section = "Methods", ItemNumber = 5, Item = "Indicate whether a protocol exists" },
            new() { Section = "Methods", ItemNumber = 6, Item = "Specify eligibility criteria" },
            new() { Section = "Methods", ItemNumber = 7, Item = "Describe all information sources" },
            new() { Section = "Methods", ItemNumber = 8, Item = "Present the full search strategy" },
            new() { Section = "Methods", ItemNumber = 9, Item = "Describe process for selecting sources" },
            new() { Section = "Methods", ItemNumber = 10, Item = "Describe data charting process" },
            new() { Section = "Methods", ItemNumber = 11, Item = "List and define all variables" },
            new() { Section = "Methods", ItemNumber = 12, Item = "Describe methods for handling and presenting results" },
            new() { Section = "Results", ItemNumber = 13, Item = "Give numbers of sources screened, assessed, included with reasons for exclusion" },
            new() { Section = "Results", ItemNumber = 14, Item = "Present characteristics of included sources" },
            new() { Section = "Results", ItemNumber = 15, Item = "Present results of review findings" },
            new() { Section = "Discussion", ItemNumber = 16, Item = "Summarize main results" },
            new() { Section = "Discussion", ItemNumber = 17, Item = "Discuss limitations" },
            new() { Section = "Discussion", ItemNumber = 18, Item = "Provide general interpretation" },
            new() { Section = "Funding", ItemNumber = 19, Item = "Describe funding sources" },
        };
    }
}
