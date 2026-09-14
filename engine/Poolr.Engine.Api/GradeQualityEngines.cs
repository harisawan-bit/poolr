using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;

namespace Poolr.Engine.Api;

/// <summary>
/// Cochrane Risk of Bias 2 (RoB 2) engine (v0.7.0).
/// Implements the revised Cochrane risk-of-bias tool for randomized trials.
/// 5 domains: Randomization process, Deviations from intended interventions,
/// Missing outcome data, Measurement of the outcome, Selection of the reported result.
/// </summary>
public static class RoB2Engine
{
    public class RoB2Study
    {
        public string study { get; set; } = "";
        // Domain 1: Randomization process
        public int d1_sequenceGeneration { get; set; } = 0; // 0=low, 1=some concerns, 2=high
        public int d1AllocationConcealment { get; set; } = 0;
        public int d1BaselineDifferences { get; set; } = 0;
        // Domain 2: Deviations from intended interventions
        public int d2_blindingParticipants { get; set; } = 0;
        public int d2_blindingPersonnel { get; set; } = 0;
        public int d2_deviations { get; set; } = 0;
        // Domain 3: Missing outcome data
        public int d3_missingData { get; set; } = 0;
        public int d3_missingDataReasons { get; set; } = 0;
        // Domain 4: Measurement of the outcome
        public int d4_outcomeMeasurement { get; set; } = 0;
        public int d4_assessorBlinding { get; set; } = 0;
        // Domain 5: Selection of the reported result
        public int d5_selectionResult { get; set; } = 0;
        public int d5_selectionReported { get; set; } = 0;
    }

    public class RoB2Request
    {
        public List<RoB2Study> studies { get; set; } = new();
    }

    public class RoB2StudyResult
    {
        public string study { get; set; } = "";
        public string domain1_judgement { get; set; } = "";
        public string domain2_judgement { get; set; } = "";
        public string domain3_judgement { get; set; } = "";
        public string domain4_judgement { get; set; } = "";
        public string domain5_judgement { get; set; } = "";
        public string overall_judgement { get; set; } = "";
        public Dictionary<string, int> domainScores { get; set; } = new();
    }

    public class RoB2Result
    {
        public List<RoB2StudyResult> studies { get; set; } = new();
        public Dictionary<string, string> summary { get; set; } = new();
        public string svgTrafficLight { get; set; } = "";
        public string svgSummaryBar { get; set; } = "";
    }

    public static RoB2Result Evaluate(RoB2Request req)
    {
        var result = new RoB2Result();

        foreach (var study in req.studies)
        {
            var studyResult = new RoB2StudyResult { study = study.study };

            // Domain 1: Randomization process
            int d1 = Math.Max(study.d1_sequenceGeneration, Math.Max(study.d1AllocationConcealment, study.d1BaselineDifferences));
            studyResult.domain1_judgement = ScoreToJudgement(d1);
            studyResult.domainScores["D1_Randomization"] = d1;

            // Domain 2: Deviations from intended interventions
            int d2 = Math.Max(study.d2_blindingParticipants, Math.Max(study.d2_blindingPersonnel, study.d2_deviations));
            studyResult.domain2_judgement = ScoreToJudgement(d2);
            studyResult.domainScores["D2_Deviations"] = d2;

            // Domain 3: Missing outcome data
            int d3 = Math.Max(study.d3_missingData, study.d3_missingDataReasons);
            studyResult.domain3_judgement = ScoreToJudgement(d3);
            studyResult.domainScores["D3_MissingData"] = d3;

            // Domain 4: Measurement of the outcome
            int d4 = Math.Max(study.d4_outcomeMeasurement, study.d4_assessorBlinding);
            studyResult.domain4_judgement = ScoreToJudgement(d4);
            studyResult.domainScores["D4_Measurement"] = d4;

            // Domain 5: Selection of the reported result
            int d5 = Math.Max(study.d5_selectionResult, study.d5_selectionReported);
            studyResult.domain5_judgement = ScoreToJudgement(d5);
            studyResult.domainScores["D5_Selection"] = d5;

            // Overall judgement: worst domain determines overall
            int overall = Math.Max(d1, Math.Max(d2, Math.Max(d3, Math.Max(d4, d5))));
            studyResult.overall_judgement = ScoreToJudgement(overall);

            result.studies.Add(studyResult);
        }

        result.summary = GenerateSummary(result.studies);
        result.svgTrafficLight = GenerateTrafficLight(result.studies);
        result.svgSummaryBar = GenerateSummaryBar(result.studies);

        return result;
    }

    private static string ScoreToJudgement(int score) => score switch
    {
        0 => "Low risk",
        1 => "Some concerns",
        _ => "High risk"
    };

    private static Dictionary<string, string> GenerateSummary(List<RoB2StudyResult> studies)
    {
        var summary = new Dictionary<string, string>();
        int n = studies.Count;
        if (n == 0) return summary;

        summary["Low risk"] = $"{studies.Count(s => s.overall_judgement == "Low risk")} / {n}";
        summary["Some concerns"] = $"{studies.Count(s => s.overall_judgement == "Some concerns")} / {n}";
        summary["High risk"] = $"{studies.Count(s => s.overall_judgement == "High risk")} / {n}";

        return summary;
    }

    private static string GenerateTrafficLight(List<RoB2StudyResult> studies)
    {
        var sb = new StringBuilder();
        int w = 600, h = 300;
        sb.AppendLine($"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"{w}\" height=\"{h}\" viewBox=\"0 0 {w} {h}\" font-family=\"Inter, Arial, sans-serif\">");
        sb.AppendLine("<rect width=\"100%\" height=\"100%\" fill=\"#0c0d11\"/>");

        string[] domains = { "Randomization", "Deviations", "Missing data", "Measurement", "Selection" };
        string[] colors = { "#3fb950", "#f2b84b", "#f05252" }; // green, yellow, red

        // Headers
        for (int j = 0; j < domains.Length; j++)
        {
            sb.AppendLine($"<text x=\"{150 + j * 90}\" y=\"20\" text-anchor=\"middle\" font-size=\"9\" fill=\"#e6e7ea\">{domains[j]}</text>");
        }

        // Studies
        for (int i = 0; i < studies.Count; i++)
        {
            var study = studies[i];
            int y = 40 + i * 25;
            sb.AppendLine($"<text x=\"5\" y=\"{y + 4}\" font-size=\"9\" fill=\"#8b8d96\">{study.study}</text>");

            for (int j = 0; j < 5; j++)
            {
                string domainKey = j switch
                {
                    0 => "D1_Randomization",
                    1 => "D2_Deviations",
                    2 => "D3_MissingData",
                    3 => "D4_Measurement",
                    _ => "D5_Selection"
                };

                int score = study.domainScores[domainKey];
                string color = colors[score];
                int cx = 150 + j * 90;
                sb.AppendLine($"<circle cx=\"{cx}\" cy=\"{y}\" r=\"8\" fill=\"{color}\" fill-opacity=\"0.92\" stroke=\"#0c0d11\" stroke-width=\"1\"/>");
            }
        }

        // Legend
        int ly = 40 + studies.Count * 25 + 20;
        sb.AppendLine($"<text x=\"10\" y=\"{ly}\" font-size=\"9\" fill=\"#e6e7ea\">Legend:</text>");
        sb.AppendLine($"<circle cx=\"60\" cy=\"{ly - 3}\" r=\"6\" fill=\"{colors[0]}\"/><text x=\"70\" y=\"{ly}\" font-size=\"8\" fill=\"#8b8d96\">Low risk</text>");
        sb.AppendLine($"<circle cx=\"130\" cy=\"{ly - 3}\" r=\"6\" fill=\"{colors[1]}\"/><text x=\"140\" y=\"{ly}\" font-size=\"8\" fill=\"#8b8d96\">Some concerns</text>");
        sb.AppendLine($"<circle cx=\"240\" cy=\"{ly - 3}\" r=\"6\" fill=\"{colors[2]}\"/><text x=\"250\" y=\"{ly}\" font-size=\"8\" fill=\"#8b8d96\">High risk</text>");

        sb.AppendLine("</svg>");
        return sb.ToString();
    }

    private static string GenerateSummaryBar(List<RoB2StudyResult> studies)
    {
        var sb = new StringBuilder();
        int w = 400, h = 200;
        sb.AppendLine($"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"{w}\" height=\"{h}\" viewBox=\"0 0 {w} {h}\" font-family=\"Inter, Arial, sans-serif\">");
        sb.AppendLine("<rect width=\"100%\" height=\"100%\" fill=\"#0c0d11\"/>");

        int n = studies.Count;
        if (n == 0) { sb.AppendLine("</svg>"); return sb.ToString(); }

        int low = studies.Count(s => s.overall_judgement == "Low risk");
        int some = studies.Count(s => s.overall_judgement == "Some concerns");
        int high = studies.Count(s => s.overall_judgement == "High risk");

        int barW = 300;
        int lowW = (int)((double)low / n * barW);
        int someW = (int)((double)some / n * barW);
        int highW = barW - lowW - someW;

        sb.AppendLine($"<rect x=\"50\" y=\"50\" width=\"{lowW}\" height=\"30\" fill=\"#3fb950\"/>");
        sb.AppendLine($"<rect x=\"{50 + lowW}\" y=\"50\" width=\"{someW}\" height=\"30\" fill=\"#f2b84b\"/>");
        sb.AppendLine($"<rect x=\"{50 + lowW + someW}\" y=\"50\" width=\"{highW}\" height=\"30\" fill=\"#f05252\"/>");

        sb.AppendLine($"<text x=\"50\" y=\"100\" font-size=\"10\" fill=\"#8b8d96\">Low: {low}/{n}</text>");
        sb.AppendLine($"<text x=\"150\" y=\"100\" font-size=\"10\" fill=\"#8b8d96\">Some: {some}/{n}</text>");
        sb.AppendLine($"<text x=\"250\" y=\"100\" font-size=\"10\" fill=\"#8b8d96\">High: {high}/{n}</text>");

        sb.AppendLine("</svg>");
        return sb.ToString();
    }
}

/// <summary>
/// ROBINS-I (Risk Of Bias In Non-randomised Studies of Interventions) engine (v0.7.0).
/// 7 domains: Bias due to confounding, Bias in selection of participants,
/// Bias in classification of interventions, Bias due to deviations from intended interventions,
/// Bias due to missing data, Bias in measurement of outcomes, Bias in selection of reported result.
/// </summary>
public static class RobinsIEngine
{
    public class RobinsIStudy
    {
        public string study { get; set; } = "";
        public int confounding { get; set; } = 0; // 0=low, 1=moderate, 2=serious, 3=critical
        public int selection { get; set; } = 0;
        public int classification { get; set; } = 0;
        public int deviations { get; set; } = 0;
        public int missingData { get; set; } = 0;
        public int measurement { get; set; } = 0;
        public int reportedResult { get; set; } = 0;
    }

    public class RobinsIRequest
    {
        public List<RobinsIStudy> studies { get; set; } = new();
    }

    public class RobinsIStudyResult
    {
        public string study { get; set; } = "";
        public Dictionary<string, string> domainJudgements { get; set; } = new();
        public string overall_judgement { get; set; } = "";
    }

    public class RobinsIResult
    {
        public List<RobinsIStudyResult> studies { get; set; } = new();
        public Dictionary<string, string> summary { get; set; } = new();
    }

    public static RobinsIResult Evaluate(RobinsIRequest req)
    {
        var result = new RobinsIResult();

        foreach (var study in req.studies)
        {
            var studyResult = new RobinsIStudyResult { study = study.study };

            string[] domainNames = { "Confounding", "Selection", "Classification", "Deviations", "MissingData", "Measurement", "ReportedResult" };
            int[] scores = { study.confounding, study.selection, study.classification, study.deviations, study.missingData, study.measurement, study.reportedResult };

            int overall = 0;
            for (int i = 0; i < domainNames.Length; i++)
            {
                studyResult.domainJudgements[domainNames[i]] = ScoreToJudgement(scores[i]);
                overall = Math.Max(overall, scores[i]);
            }

            studyResult.overall_judgement = ScoreToJudgement(overall);
            result.studies.Add(studyResult);
        }

        result.summary = GenerateSummary(result.studies);
        return result;
    }

    private static string ScoreToJudgement(int score) => score switch
    {
        0 => "Low",
        1 => "Moderate",
        2 => "Serious",
        _ => "Critical"
    };

    private static Dictionary<string, string> GenerateSummary(List<RobinsIStudyResult> studies)
    {
        var summary = new Dictionary<string, string>();
        int n = studies.Count;
        if (n == 0) return summary;

        summary["Low"] = $"{studies.Count(s => s.overall_judgement == "Low")} / {n}";
        summary["Moderate"] = $"{studies.Count(s => s.overall_judgement == "Moderate")} / {n}";
        summary["Serious"] = $"{studies.Count(s => s.overall_judgement == "Serious")} / {n}";
        summary["Critical"] = $"{studies.Count(s => s.overall_judgement == "Critical")} / {n}";

        return summary;
    }
}

/// <summary>
/// QUADAS-2 (Quality Assessment of Diagnostic Accuracy Studies) engine (v0.7.0).
/// 4 domains: Patient selection, Index test, Reference standard, Flow and timing.
/// </summary>
public static class Quadas2Engine
{
    public class Quadas2Study
    {
        public string study { get; set; } = "";
        public int patientSelection_risk { get; set; } = 0;
        public int patientSelection_applicability { get; set; } = 0;
        public int indexTest_risk { get; set; } = 0;
        public int indexTest_applicability { get; set; } = 0;
        public int referenceStandard_risk { get; set; } = 0;
        public int referenceStandard_applicability { get; set; } = 0;
        public int flowTiming_risk { get; set; } = 0;
        public int flowTiming_applicability { get; set; } = 0;
    }

    public class Quadas2Request
    {
        public List<Quadas2Study> studies { get; set; } = new();
    }

    public class Quadas2StudyResult
    {
        public string study { get; set; } = "";
        public Dictionary<string, string> domainRisk { get; set; } = new();
        public Dictionary<string, string> domainApplicability { get; set; } = new();
    }

    public class Quadas2Result
    {
        public List<Quadas2StudyResult> studies { get; set; } = new();
        public Dictionary<string, string> summary { get; set; } = new();
    }

    public static Quadas2Result Evaluate(Quadas2Request req)
    {
        var result = new Quadas2Result();

        foreach (var study in req.studies)
        {
            var studyResult = new Quadas2StudyResult { study = study.study };

            studyResult.domainRisk["Patient selection"] = ScoreToJudgement(study.patientSelection_risk);
            studyResult.domainApplicability["Patient selection"] = ScoreToJudgement(study.patientSelection_applicability);

            studyResult.domainRisk["Index test"] = ScoreToJudgement(study.indexTest_risk);
            studyResult.domainApplicability["Index test"] = ScoreToJudgement(study.indexTest_applicability);

            studyResult.domainRisk["Reference standard"] = ScoreToJudgement(study.referenceStandard_risk);
            studyResult.domainApplicability["Reference standard"] = ScoreToJudgement(study.referenceStandard_applicability);

            studyResult.domainRisk["Flow and timing"] = ScoreToJudgement(study.flowTiming_risk);
            studyResult.domainApplicability["Flow and timing"] = ScoreToJudgement(study.flowTiming_applicability);

            result.studies.Add(studyResult);
        }

        result.summary = GenerateSummary(result.studies);
        return result;
    }

    private static string ScoreToJudgement(int score) => score switch
    {
        0 => "Low",
        1 => "Unclear",
        _ => "High"
    };

    private static Dictionary<string, string> GenerateSummary(List<Quadas2StudyResult> studies)
    {
        var summary = new Dictionary<string, string>();
        int n = studies.Count;
        if (n == 0) return summary;

        summary["Low risk"] = $"{studies.Count(s => s.domainRisk.Values.All(v => v == "Low"))} / {n}";
        summary["High/Unclear risk"] = $"{studies.Count(s => s.domainRisk.Values.Any(v => v == "High" || v == "Unclear"))} / {n}";

        return summary;
    }
}

/// <summary>
/// AMSTAR-2 (A Measurement Tool to Assess Systematic Reviews) engine (v0.7.0).
/// 16 items assessing the quality of systematic reviews.
/// </summary>
public static class Amstar2Engine
{
    public class Amstar2Assessment
    {
        public string reviewTitle { get; set; } = "";
        public List<int> items { get; set; } = new(); // 0=no, 1=partial yes, 2=yes
    }

    public class Amstar2Request
    {
        public List<Amstar2Assessment> assessments { get; set; } = new();
    }

    public class Amstar2ResultItem
    {
        public string reviewTitle { get; set; } = "";
        public List<string> itemJudgements { get; set; } = new();
        public string overallConfidence { get; set; } = "";
        public int criticalFailures { get; set; }
    }

    public class Amstar2Result
    {
        public List<Amstar2ResultItem> results { get; set; } = new();
        public List<string> criticalItems { get; set; } = new();
        public List<string> nonCriticalItems { get; set; } = new();
    }

    private static readonly int[] CriticalItems = { 2, 4, 7, 9, 11, 13, 15 }; // Items 2,4,7,9,11,13,15 are critical

    public static Amstar2Result Evaluate(Amstar2Request req)
    {
        var result = new Amstar2Result();

        // Define items
        result.criticalItems = new List<string>
        {
            "2. Did the report of the review contain an explicit statement that the review methods were established prior to the conduct of the review and did the report justify any significant deviations from the protocol?",
            "4. Did the review authors use a comprehensive literature search strategy?",
            "7. Did the review authors provide a list of excluded studies and justify the exclusions?",
            "9. Did the review authors use a satisfactory technique for assessing the risk of bias in individual studies included in the review?",
            "11. If meta-analysis was performed, did the review authors use appropriate statistical methods for combining results?",
            "13. Did the review authors account for risk of bias in individual studies when interpreting/discussing the results?",
            "15. If they performed quantitative synthesis, did the review authors carry out an assessment of publication bias?"
        };

        result.nonCriticalItems = new List<string>
        {
            "1. Did the research questions and inclusion criteria for the review include the components of PICO?",
            "3. Did the review authors explain their selection of the study designs for inclusion in the review?",
            "5. Did the review authors perform study selection in duplicate?",
            "6. Did the review authors perform data extraction in duplicate?",
            "8. Did the review authors describe the included studies in adequate detail?",
            "10. Did the review authors report on the sources of funding for the included studies?",
            "12. If meta-analysis was performed, did the review authors assess the potential impact of RoB in individual studies?",
            "14. Did the review authors provide a satisfactory explanation for any heterogeneity?",
            "16. Did the review authors report any sources of funding?"
        };

        foreach (var assessment in req.assessments)
        {
            var itemResult = new Amstar2ResultItem { reviewTitle = assessment.reviewTitle };

            for (int i = 0; i < assessment.items.Count; i++)
            {
                itemResult.itemJudgements.Add(ItemToJudgement(assessment.items[i]));
            }

            // Critical failures: critical items scored 0 (no)
            itemResult.criticalFailures = CriticalItems.Count(ci => ci <= assessment.items.Count && assessment.items[ci - 1] == 0);

            itemResult.overallConfidence = itemResult.criticalFailures switch
            {
                0 => "High",
                1 => "Moderate",
                <= 3 => "Low",
                _ => "Critically low"
            };

            result.results.Add(itemResult);
        }

        return result;
    }

    private static string ItemToJudgement(int score) => score switch
    {
        0 => "No",
        1 => "Partial Yes",
        _ => "Yes"
    };
}

/// <summary>
/// Newcastle-Ottawa Scale (NOS) engine (v0.7.0).
/// Quality assessment for cohort and case-control studies.
/// 3 domains: Selection, Comparability, Outcome/Exposure.
/// </summary>
public static class NewcastleOttawaEngine
{
    public class NosStudy
    {
        public string study { get; set; } = "";
        public string studyType { get; set; } = "cohort"; // cohort or case-control
        // Selection (max 4 stars)
        public int representativeness { get; set; } = 0;
        public int selectionNonExposed { get; set; } = 0;
        public int ascertainmentExposure { get; set; } = 0;
        public int outcomeNotPresent { get; set; } = 0;
        // Comparability (max 2 stars)
        public int comparability { get; set; } = 0;
        // Outcome (max 3 stars) or Exposure (for case-control)
        public int outcomeAssessment { get; set; } = 0;
        public int followUp { get; set; } = 0;
        public int adequacyFollowUp { get; set; } = 0;
    }

    public class NosRequest
    {
        public List<NosStudy> studies { get; set; } = new();
    }

    public class NosStudyResult
    {
        public string study { get; set; } = "";
        public int selectionStars { get; set; }
        public int comparabilityStars { get; set; }
        public int outcomeStars { get; set; }
        public int totalStars { get; set; }
        public string qualityCategory { get; set; } = "";
    }

    public class NosResult
    {
        public List<NosStudyResult> studies { get; set; } = new();
        public Dictionary<string, string> summary { get; set; } = new();
    }

    public static NosResult Evaluate(NosRequest req)
    {
        var result = new NosResult();

        foreach (var study in req.studies)
        {
            var studyResult = new NosStudyResult { study = study.study };

            // Selection (max 4)
            studyResult.selectionStars = Math.Min(4,
                study.representativeness + study.selectionNonExposed + study.ascertainmentExposure + study.outcomeNotPresent);

            // Comparability (max 2)
            studyResult.comparabilityStars = Math.Min(2, study.comparability);

            // Outcome (max 3)
            studyResult.outcomeStars = Math.Min(3,
                study.outcomeAssessment + study.followUp + study.adequacyFollowUp);

            studyResult.totalStars = studyResult.selectionStars + studyResult.comparabilityStars + studyResult.outcomeStars;

            // Quality categories based on stars
            studyResult.qualityCategory = studyResult.totalStars switch
            {
                >= 7 => "Good",
                >= 4 => "Fair",
                _ => "Poor"
            };

            result.studies.Add(studyResult);
        }

        result.summary = new Dictionary<string, string>
        {
            ["Good (7-9 stars)"] = $"{result.studies.Count(s => s.qualityCategory == "Good")} / {result.studies.Count}",
            ["Fair (4-6 stars)"] = $"{result.studies.Count(s => s.qualityCategory == "Fair")} / {result.studies.Count}",
            ["Poor (0-3 stars)"] = $"{result.studies.Count(s => s.qualityCategory == "Poor")} / {result.studies.Count}"
        };

        return result;
    }
}

/// <summary>
/// GRADE Evidence Profile engine (v0.7.0).
/// Generates complete GRADE evidence profiles with all 5 downgrade factors.
/// </summary>
public static class GradeEvidenceProfileEngine
{
    public class GradeStudy
    {
        public string study { get; set; } = "";
        public string design { get; set; } = "RCT"; // RCT, observational, etc.
        public int? robScore { get; set; } // 0=low, 1=some concerns, 2=high
        public int? indirectness { get; set; } // 0=none, 1=serious, 2=very serious
        public int? imprecision { get; set; } // 0=none, 1=serious, 2=very serious
        public int? inconsistency { get; set; } // 0=none, 1=serious, 2=very serious
        public int? publicationBias { get; set; } // 0=undetected, 1=strongly suspected
        public double? effectEstimate { get; set; }
        public double? ciLower { get; set; }
        public double? ciUpper { get; set; }
        public int? nStudies { get; set; }
        public int? totalN { get; set; }
    }

    public class GradeRequest
    {
        public List<GradeStudy> studies { get; set; } = new();
        public string outcome { get; set; } = "";
        public string intervention { get; set; } = "";
        public string comparator { get; set; } = "";
        public string? patientPopulation { get; set; }
        public string? setting { get; set; }
        public string measure { get; set; } = "RR";
    }

    public class GradeCertaintyFactor
    {
        public string factor { get; set; } = "";
        public string assessment { get; set; } = "";
        public int downgrade { get; set; }
        public string rationale { get; set; } = "";
    }

    public class GradeProfileResult
    {
        public string outcome { get; set; } = "";
        public string intervention { get; set; } = "";
        public string comparator { get; set; } = "";
        public int nStudies { get; set; }
        public int totalN { get; set; }
        public double? pooledEffect { get; set; }
        public double? ciLower { get; set; }
        public double? ciUpper { get; set; }
        public string initialCertainty { get; set; } = "";
        public List<GradeCertaintyFactor> factors { get; set; } = new();
        public int totalDowngrades { get; set; }
        public string finalCertainty { get; set; } = "";
        public string markdown { get; set; } = "";
    }

    public static GradeProfileResult Generate(GradeRequest req)
    {
        var result = new GradeProfileResult
        {
            outcome = req.outcome,
            intervention = req.intervention,
            comparator = req.comparator
        };

        var validStudies = req.studies.Where(s => s.effectEstimate.HasValue).ToList();
        result.nStudies = validStudies.Count;
        result.totalN = validStudies.Sum(s => s.totalN ?? 0);

        // Calculate pooled effect (simple inverse variance)
        if (validStudies.Any())
        {
            var weights = validStudies.Select(s =>
            {
                double se = (s.ciUpper!.Value - s.ciLower!.Value) / (2 * 1.96);
                return 1.0 / (se * se);
            }).ToList();

            double sumW = weights.Sum();
            double pooled = validStudies.Zip(weights, (s, w) => s.effectEstimate.Value * w).Sum() / sumW;
            double sePooled = Math.Sqrt(1.0 / sumW);

            result.pooledEffect = pooled;
            result.ciLower = pooled - 1.96 * sePooled;
            result.ciUpper = pooled + 1.96 * sePooled;
        }

        // Initial certainty based on study design
        result.initialCertainty = validStudies.Any() && validStudies.All(s => s.design == "RCT") ? "High" : "Low";

        // Calculate I2 for use in EvaluateFactors
        double i2 = 0;
        if (validStudies.Count >= 3)
        {
            var effects = validStudies.Select(s => s.effectEstimate.Value).ToList();
            i2 = CalculateI2(effects, validStudies.Select(s => (s.ciUpper!.Value - s.ciLower!.Value) / (2 * 1.96)).ToList());
        }

        // Evaluate 5 GRADE factors (pass i2 and ciLower/ciUpper separately)
        result.factors = EvaluateFactors(validStudies, result, i2);
        result.totalDowngrades = result.factors.Sum(f => f.downgrade);
        result.finalCertainty = CalculateFinalCertainty(result.initialCertainty, result.totalDowngrades);

        result.markdown = GenerateMarkdown(result);

        return result;
    }

    private static List<GradeCertaintyFactor> EvaluateFactors(List<GradeStudy> studies, GradeProfileResult result, double i2)
    {
        var factors = new List<GradeCertaintyFactor>();

        // 1. Risk of Bias
        var robFactor = new GradeCertaintyFactor { factor = "Risk of bias" };
        if (studies.Any(s => s.robScore.HasValue && s.robScore.Value >= 2))
        {
            robFactor.assessment = "Serious";
            robFactor.downgrade = 1;
            robFactor.rationale = "High risk of bias detected in included studies";
        }
        else if (studies.Any(s => s.robScore.HasValue && s.robScore.Value == 1))
        {
            robFactor.assessment = "Serious";
            robFactor.downgrade = 1;
            robFactor.rationale = "Some concerns regarding risk of bias";
        }
        else
        {
            robFactor.assessment = "Not serious";
            robFactor.downgrade = 0;
        }
        factors.Add(robFactor);

        // 2. Inconsistency
        var inconsistencyFactor = new GradeCertaintyFactor { factor = "Inconsistency" };
        if (i2 > 75)
        {
            inconsistencyFactor.assessment = "Serious";
            inconsistencyFactor.downgrade = 1;
            inconsistencyFactor.rationale = $"I² = {i2:F0}% indicates substantial heterogeneity";
        }
        else if (i2 > 50)
        {
            inconsistencyFactor.assessment = "Serious";
            inconsistencyFactor.downgrade = 1;
            inconsistencyFactor.rationale = $"I² = {i2:F0}% indicates moderate heterogeneity";
        }
        else
        {
            inconsistencyFactor.assessment = "Not serious";
            inconsistencyFactor.downgrade = 0;
        }
        factors.Add(inconsistencyFactor);

        // 3. Indirectness
        var indirectnessFactor = new GradeCertaintyFactor { factor = "Indirectness" };
        if (studies.Any(s => s.indirectness.HasValue && s.indirectness.Value >= 1))
        {
            indirectnessFactor.assessment = "Serious";
            indirectnessFactor.downgrade = studies.Any(s => s.indirectness == 2) ? 2 : 1;
            indirectnessFactor.rationale = "Indirectness detected in included studies";
        }
        else
        {
            indirectnessFactor.assessment = "Not serious";
            indirectnessFactor.downgrade = 0;
        }
        factors.Add(indirectnessFactor);

        // 4. Imprecision
        var imprecisionFactor = new GradeCertaintyFactor { factor = "Imprecision" };
        if (result.ciLower.HasValue && result.ciUpper.HasValue)
        {
            double ciWidth = result.ciUpper.Value - result.ciLower.Value;
            if (ciWidth > 1.0) // arbitrary threshold
            {
                imprecisionFactor.assessment = "Serious";
                imprecisionFactor.downgrade = 1;
                imprecisionFactor.rationale = $"Wide confidence interval (width = {ciWidth:F2})";
            }
            else
            {
                imprecisionFactor.assessment = "Not serious";
                imprecisionFactor.downgrade = 0;
            }
        }
        else
        {
            imprecisionFactor.assessment = "Not serious";
            imprecisionFactor.downgrade = 0;
        }
        factors.Add(imprecisionFactor);

        // 5. Publication bias
        var pbFactor = new GradeCertaintyFactor { factor = "Publication bias" };
        if (studies.Any(s => s.publicationBias == 1))
        {
            pbFactor.assessment = "Strongly suspected";
            pbFactor.downgrade = 1;
            pbFactor.rationale = "Publication bias suspected based on asymmetry";
        }
        else
        {
            pbFactor.assessment = "Undetected";
            pbFactor.downgrade = 0;
        }
        factors.Add(pbFactor);

        return factors;
    }

    private static double CalculateI2(List<double> effects, List<double> ses)
    {
        if (effects.Count < 3) return 0;

        var weights = ses.Select(se => 1.0 / (se * se)).ToList();
        double sumW = weights.Sum();
        double fe = effects.Zip(weights, (e, w) => e * w).Sum() / sumW;

        double q = effects.Zip(weights, (e, w) => w * (e - fe) * (e - fe)).Sum();
        int df = effects.Count - 1;

        return df > 0 ? Math.Max(0, (q - df) / q * 100) : 0;
    }

    private static string CalculateFinalCertainty(string initialCertainty, int downgrades)
    {
        if (initialCertainty == "High")
        {
            if (downgrades == 0) return "High";
            if (downgrades <= 1) return "Moderate";
            if (downgrades <= 3) return "Low";
            return "Very low";
        }
        else // starts at Low
        {
            if (downgrades == 0) return "Low";
            if (downgrades <= 2) return "Low";
            return "Very low";
        }
    }

    private static string GenerateMarkdown(GradeProfileResult result)
    {
        var sb = new StringBuilder();
        sb.AppendLine($"### GRADE Evidence Profile: {result.intervention} vs {result.comparator}");
        sb.AppendLine($"**Outcome:** {result.outcome}");
        sb.AppendLine();
        sb.AppendLine($"| Factor | Assessment | Downgrade | Rationale |");
        sb.AppendLine("|---|---|---|---|");
        foreach (var factor in result.factors)
        {
            sb.AppendLine($"| {factor.factor} | {factor.assessment} | {factor.downgrade} | {factor.rationale} |");
        }
        sb.AppendLine();
        sb.AppendLine($"**Certainty:** {result.initialCertainty} -> {result.finalCertainty} (total downgrades: {result.totalDowngrades})");

        return sb.ToString();
    }
}
