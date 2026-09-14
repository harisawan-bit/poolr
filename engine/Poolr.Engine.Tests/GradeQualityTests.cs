using Poolr.Engine.Api;
using Xunit;

namespace Poolr.Engine.Tests;

public class RoB2Tests
{
    [Fact]
    public void Basic_Evaluates()
    {
        var req = new RoB2Engine.RoB2Request
        {
            studies = new()
            {
                new() { study = "1", d1_sequenceGeneration = 0, d2_blindingParticipants = 0, d3_missingData = 0, d4_outcomeMeasurement = 0, d5_selectionResult = 0 },
                new() { study = "2", d1_sequenceGeneration = 2, d2_blindingParticipants = 1, d3_missingData = 2, d4_outcomeMeasurement = 1, d5_selectionResult = 2 }
            }
        };

        var result = RoB2Engine.Evaluate(req);
        Assert.Equal(2, result.studies.Count);
        Assert.Equal("Low risk", result.studies[0].overall_judgement);
        Assert.Equal("High risk", result.studies[1].overall_judgement);
        Assert.NotNull(result.svgTrafficLight);
        Assert.NotNull(result.svgSummaryBar);
    }

    [Fact]
    public void SomeConcerns_Moderate()
    {
        var req = new RoB2Engine.RoB2Request
        {
            studies = new() { new() { study = "1", d1_sequenceGeneration = 1 } }
        };
        var result = RoB2Engine.Evaluate(req);
        Assert.Equal("Some concerns", result.studies[0].overall_judgement);
    }

    [Fact]
    public void EmptyStudies_ReturnsEmpty()
    {
        var req = new RoB2Engine.RoB2Request();
        var result = RoB2Engine.Evaluate(req);
        Assert.Empty(result.studies);
    }
}

public class RobinsITests
{
    [Fact]
    public void Basic_Evaluates()
    {
        var req = new RobinsIEngine.RobinsIRequest
        {
            studies = new()
            {
                new() { study = "1", confounding = 0, selection = 0, classification = 0, deviations = 0, missingData = 0, measurement = 0, reportedResult = 0 },
                new() { study = "2", confounding = 2, selection = 1, classification = 2, deviations = 1, missingData = 2, measurement = 1, reportedResult = 2 }
            }
        };

        var result = RobinsIEngine.Evaluate(req);
        Assert.Equal(2, result.studies.Count);
        Assert.Equal("Low", result.studies[0].overall_judgement);
        Assert.Equal("Serious", result.studies[1].overall_judgement);
    }
}

public class Quadas2Tests
{
    [Fact]
    public void Basic_Evaluates()
    {
        var req = new Quadas2Engine.Quadas2Request
        {
            studies = new()
            {
                new() { study = "1", patientSelection_risk = 0, indexTest_risk = 0, referenceStandard_risk = 0, flowTiming_risk = 0 },
                new() { study = "2", patientSelection_risk = 2, indexTest_risk = 1, referenceStandard_risk = 2, flowTiming_risk = 1 }
            }
        };

        var result = Quadas2Engine.Evaluate(req);
        Assert.Equal(2, result.studies.Count);
        Assert.Equal("Low", result.studies[0].domainRisk["Patient selection"]);
        Assert.Equal("High", result.studies[1].domainRisk["Patient selection"]);
    }
}

public class Amstar2Tests
{
    [Fact]
    public void Basic_Evaluates()
    {
        var req = new Amstar2Engine.Amstar2Request
        {
            assessments = new()
            {
                new() { reviewTitle = "Review A", items = new() { 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2 } },
                new() { reviewTitle = "Review B", items = new() { 0, 0, 0, 0, 2, 2, 0, 2, 2, 2, 0, 2, 0, 2, 0, 2 } }
            }
        };

        var result = Amstar2Engine.Evaluate(req);
        Assert.Equal(2, result.results.Count);
        Assert.Equal("High", result.results[0].overallConfidence);
        // Review B: items at critical positions (1,3,6,8,10,12,14) = {0,0,0,2,0,0,0} = 6 failures
        Assert.Equal(6, result.results[1].criticalFailures);
    }
}

public class NosTests
{
    [Fact]
    public void Basic_Evaluates()
    {
        var req = new NewcastleOttawaEngine.NosRequest
        {
            studies = new()
            {
                new() { study = "1", representativeness = 1, selectionNonExposed = 1, ascertainmentExposure = 1, outcomeNotPresent = 1, comparability = 2, outcomeAssessment = 1, followUp = 1, adequacyFollowUp = 1 },
                new() { study = "2", representativeness = 1, selectionNonExposed = 0, ascertainmentExposure = 1, outcomeNotPresent = 0, comparability = 0, outcomeAssessment = 1, followUp = 0, adequacyFollowUp = 0 }
            }
        };

        var result = NewcastleOttawaEngine.Evaluate(req);
        Assert.Equal(2, result.studies.Count);
        Assert.Equal(9, result.studies[0].totalStars);
        Assert.Equal("Good", result.studies[0].qualityCategory);
        Assert.True(result.studies[1].totalStars < 7);
    }
}

public class GradeEvidenceProfileTests
{
    [Fact]
    public void Basic_GeneratesProfile()
    {
        var req = new GradeEvidenceProfileEngine.GradeRequest
        {
            outcome = "Mortality",
            intervention = "Drug X",
            comparator = "Placebo",
            measure = "RR",
            studies = new()
            {
                new() { study = "1", design = "RCT", robScore = 0, effectEstimate = 0.75, ciLower = 0.6, ciUpper = 0.9, nStudies = 1, totalN = 500 },
                new() { study = "2", design = "RCT", robScore = 1, effectEstimate = 0.8, ciLower = 0.65, ciUpper = 0.95, nStudies = 1, totalN = 400 },
                new() { study = "3", design = "RCT", robScore = 0, effectEstimate = 0.7, ciLower = 0.55, ciUpper = 0.85, nStudies = 1, totalN = 600 }
            }
        };

        var result = GradeEvidenceProfileEngine.Generate(req);
        Assert.Equal("Mortality", result.outcome);
        Assert.Equal(3, result.nStudies);
        Assert.Equal(1500, result.totalN);
        Assert.NotNull(result.pooledEffect);
        Assert.NotNull(result.ciLower);
        Assert.NotNull(result.ciUpper);
        Assert.Equal(5, result.factors.Count);
        Assert.NotNull(result.markdown);
        Assert.Contains("High", result.initialCertainty);
    }

    [Fact]
    public void Downgrades_RoB()
    {
        var req = new GradeEvidenceProfileEngine.GradeRequest
        {
            outcome = "Outcome",
            intervention = "Drug",
            comparator = "Placebo",
            studies = new() { new() { design = "RCT", robScore = 2, effectEstimate = 0.5, ciLower = 0.1, ciUpper = 0.9 } }
        };
        var result = GradeEvidenceProfileEngine.Generate(req);
        Assert.Contains(result.factors, f => f.factor == "Risk of bias" && f.downgrade > 0);
    }

    [Fact]
    public void NoStudies_LowCertainty()
    {
        var req = new GradeEvidenceProfileEngine.GradeRequest
        {
            outcome = "Outcome",
            intervention = "Drug",
            comparator = "Placebo",
            studies = new() { new() { design = "observational" } }
        };
        var result = GradeEvidenceProfileEngine.Generate(req);
        Assert.Equal("Low", result.initialCertainty);
    }
}
