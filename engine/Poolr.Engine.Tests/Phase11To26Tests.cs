using Poolr.Engine.Api;
using Xunit;

namespace Poolr.Engine.Tests;

public class ReportingTests
{
    [Fact]
    public void GenerateLatex_ContainsTitle()
    {
        var req = new ReportingEngine.ManuscriptRequest
        {
            title = "Test Review",
            authors = "Author A, Author B",
            studies = 10,
            participants = 1000,
            pooledEffect = 0.75,
            ciLower = 0.6,
            ciUpper = 0.9,
            i2 = 45.0,
            p = 0.001,
            measure = "OR",
            model = "random",
            method = "DL"
        };

        var latex = ReportingEngine.GenerateLatex(req);
        Assert.Contains("Test Review", latex);
        Assert.Contains("0.75", latex);
        Assert.Contains("random", latex);
        Assert.Contains("\\end{document}", latex);
    }

    [Fact]
    public void GenerateHtml_ContainsAllSections()
    {
        var req = new ReportingEngine.HtmlReportRequest
        {
            project = new ReportingEngine.ProjectData
            {
                title = "HTML Test",
                objective = "Test objective",
                includedStudies = 5,
                participants = 500,
                pooledEffect = 1.5,
                ciLower = 1.1,
                ciUpper = 1.9,
                i2 = 30,
                p = 0.01,
                measure = "HR",
                certainty = "Moderate"
            }
        };

        var html = ReportingEngine.GenerateHtmlReport(req);
        Assert.Contains("HTML Test", html);
        Assert.Contains("1.50", html);
        Assert.Contains("Moderate", html);
        Assert.Contains("poolr v0.5.7", html);
    }

    [Fact]
    public void GeneratePython_ContainsReplicationCode()
    {
        var req = new ReportingEngine.ManuscriptRequest
        {
            studies = 5,
            participants = 200,
            measure = "OR",
            pooledEffect = 0.8,
            ciLower = 0.7,
            ciUpper = 0.9
        };

        var py = ReportingEngine.GeneratePythonReplication(req);
        Assert.Contains("numpy", py);
        Assert.Contains("tau2", py);
        Assert.Contains("0.80", py);
    }

    [Fact]
    public void GenerateStata_ContainsMetanCommand()
    {
        var req = new ReportingEngine.ManuscriptRequest
        {
            studies = 5,
            measure = "OR",
            model = "random"
        };

        var stata = ReportingEngine.GenerateStataReplication(req);
        Assert.Contains("metan", stata);
        Assert.Contains("random", stata);
    }
}

public class CollaborationTests
{
    [Fact]
    public void CreateSnapshot_ReturnsId()
    {
        var req = new CollaborationEngine.SnapshotRequest
        {
            projectPath = "test.json",
            projectJson = "{\"test\": true}",
            message = "Initial snapshot"
        };

        var id = CollaborationEngine.CreateSnapshot(req);
        Assert.NotNull(id);
        Assert.True(id.Length > 0);
    }

    [Fact]
    public void ListSnapshots_ReturnsCreated()
    {
        var req = new CollaborationEngine.SnapshotRequest
        {
            projectPath = "test2.json",
            projectJson = "{\"test\": 2}",
            message = "Second snapshot"
        };

        CollaborationEngine.CreateSnapshot(req);
        var snapshots = CollaborationEngine.ListSnapshots();
        Assert.NotEmpty(snapshots);
    }

    [Fact]
    public void GetDiff_ShowsChanges()
    {
        var req1 = new CollaborationEngine.SnapshotRequest
        {
            projectPath = "diff_test.json",
            projectJson = "{\"value\": 1}",
            message = "First"
        };
        var req2 = new CollaborationEngine.SnapshotRequest
        {
            projectPath = "diff_test2.json",
            projectJson = "{\"value\": 2, \"new\": true}",
            message = "Second"
        };

        var id1 = CollaborationEngine.CreateSnapshot(req1);
        var id2 = CollaborationEngine.CreateSnapshot(req2);

        var diff = CollaborationEngine.GetDiff(new CollaborationEngine.DiffRequest
        {
            snapshotId1 = id1,
            snapshotId2 = id2
        });

        // JSON field-level diff
        Assert.NotNull(diff);
    }
}

public class NicheEngineTests
{
    [Fact]
    public void CorrelationHunterSchmidt_Basic()
    {
        var studies = new List<NicheEngine.CorrelationStudy>
        {
            new() { study = "1", r = 0.5, n = 100 },
            new() { study = "2", r = 0.4, n = 80 },
            new() { study = "3", r = 0.6, n = 120 }
        };

        var result = NicheEngine.RunCorrelationHunterSchmidt(studies);
        Assert.InRange(result.pooledR, 0, 1);
        Assert.True(result.ciLower < result.pooledR);
        Assert.True(result.ciUpper > result.pooledR);
        Assert.Equal(3, result.nStudies);
        Assert.Equal(300, result.totalN);
    }

    [Fact]
    public void Correlation_CredibilityInterval()
    {
        var studies = new List<NicheEngine.CorrelationStudy>
        {
            new() { study = "1", r = 0.7, n = 200, reliabilityX = 0.9, reliabilityY = 0.85 },
            new() { study = "2", r = 0.6, n = 150 }
        };

        var result = NicheEngine.RunCorrelationHunterSchmidt(studies);
        Assert.NotNull(result.credibilityLower);
        Assert.NotNull(result.credibilityUpper);
        Assert.True(result.credibilityLower < result.pooledR);
        Assert.True(result.credibilityUpper > result.pooledR);
    }

    [Fact]
    public void VariabilityRatio_Basic()
    {
        var studies = new List<NicheEngine.VariabilityStudy>
        {
            new() { study = "1", mean1 = 10, sd1 = 2, mean2 = 12, sd2 = 3, n1 = 50, n2 = 50 },
            new() { study = "2", mean1 = 20, sd1 = 4, mean2 = 22, sd2 = 5, n1 = 60, n2 = 60 }
        };

        var result = NicheEngine.RunVariabilityRatio(studies);
        Assert.True(result.cvr > 0);
        Assert.True(result.ciLower < result.cvr);
        Assert.True(result.ciUpper > result.cvr);
    }

    [Fact]
    public void Scd_Basic()
    {
        var studies = new List<NicheEngine.ScdStudy>
        {
            new() { study = "1", tauU = 0.8 },
            new() { study = "2", tauU = 0.7 },
            new() { study = "3", tauU = 0.9 }
        };

        var result = NicheEngine.RunScd(studies);
        Assert.InRange(result.pooledTauU, -1, 1);
        Assert.Equal(3, result.nStudies);
    }

    [Fact]
    public void PoissonGlmm_Basic()
    {
        var studies = new List<NicheEngine.PoissonStudy>
        {
            new() { study = "1", events = 10, personTime = 100 },
            new() { study = "2", events = 15, personTime = 150 }
        };

        var result = NicheEngine.RunPoissonGlmm(studies);
        Assert.True(result.pooledRate > 0);
        Assert.True(result.ciLower < result.pooledRate);
        Assert.True(result.ciUpper > result.pooledRate);
    }

    [Fact]
    public void Agreement_Basic()
    {
        var studies = new List<NicheEngine.AgreementStudy>
        {
            new() { study = "1", kappa = 0.7, se = 0.05 },
            new() { study = "2", kappa = 0.8, se = 0.04 }
        };

        var result = NicheEngine.RunAgreement(studies);
        Assert.InRange(result.pooledKappa, -1, 1);
        Assert.Equal(2, result.nStudies);
    }
}

public class SpecializedEngineTests
{
    [Fact]
    public void Qol_Basic()
    {
        var studies = new List<SpecializedEngine.QolStudy>
        {
            new() { study = "1", meanChange = 5, sdChange = 2, n = 50, responders = 60 },
            new() { study = "2", meanChange = 3, sdChange = 3, n = 40, responders = 50 }
        };

        var result = SpecializedEngine.RunQol(studies, 10.0);
        Assert.True(result.pooledMd != 0);
        Assert.InRange(result.respondersPooled, 0, 1);
    }

    [Fact]
    public void Economic_Basic()
    {
        var studies = new List<SpecializedEngine.CostStudy>
        {
            new() { study = "1", costDiff = 1000, costSe = 200, qalyDiff = 0.1, qalySe = 0.02 },
            new() { study = "2", costDiff = 1500, costSe = 250, qalyDiff = 0.15, qalySe = 0.03 }
        };

        var result = SpecializedEngine.RunEconomic(studies);
        Assert.True(result.pooledCostDiff > 0);
        Assert.True(result.icer > 0);
    }

    [Fact]
    public void Genetic_Basic()
    {
        var studies = new List<SpecializedEngine.GeneticStudy>
        {
            new() { study = "1", or = 1.5, orLower = 1.2, orUpper = 1.8, model = "additive" },
            new() { study = "2", or = 1.3, orLower = 1.1, orUpper = 1.5, model = "additive" }
        };

        var result = SpecializedEngine.RunGenetic(studies);
        Assert.True(result.pooledOr > 1);
        Assert.Equal("additive", result.bestModel);
    }

    [Fact]
    public void Ecological_Basic()
    {
        var studies = new List<SpecializedEngine.EcologicalStudy>
        {
            new() { study = "1", meanControl = 10, sdControl = 2, meanTreatment = 15, sdTreatment = 3, nControl = 50, nTreatment = 50 },
            new() { study = "2", meanControl = 20, sdControl = 4, meanTreatment = 25, sdTreatment = 5, nControl = 60, nTreatment = 60 }
        };

        var result = SpecializedEngine.RunEcological(studies);
        Assert.True(result.responseRatio > 1);
    }

    [Fact]
    public void PrePost_Basic()
    {
        var studies = new List<SpecializedEngine.PrePostStudy>
        {
            new() { study = "1", meanPre = 50, meanPost = 55, sdPre = 10, sdPost = 10, prePostR = 0.5, n = 30 },
            new() { study = "2", meanPre = 60, meanPost = 65, sdPre = 12, sdPost = 12, prePostR = 0.5, n = 40 }
        };

        var result = SpecializedEngine.RunPrePost(studies);
        Assert.True(result.pooledG > 0);
    }

    [Fact]
    public void AdverseEvents_Basic()
    {
        var studies = new List<SpecializedEngine.AeStudy>
        {
            new() { study = "1", aeEventsInt = 20, aeNInt = 200, aeEventsCtrl = 10, aeNCtrl = 200 },
            new() { study = "2", aeEventsInt = 15, aeNInt = 150, aeEventsCtrl = 5, aeNCtrl = 150 }
        };

        var result = SpecializedEngine.RunAdverseEvents(studies);
        Assert.True(result.pooledOr > 1);
        Assert.True(result.pooledNnh > 0);
    }
}

public class AdvancedEngineTests
{
    [Fact]
    public void Prognostic_Basic()
    {
        var studies = new List<AdvancedEngine.PrognosticStudy>
        {
            new() { study = "1", logHr = -0.3, se = 0.1, cStatistic = 0.75 },
            new() { study = "2", logHr = -0.2, se = 0.12, cStatistic = 0.72 }
        };

        var result = AdvancedEngine.RunPrognostic(studies);
        Assert.InRange(result.pooledHr, 0, 2);
        Assert.InRange(result.pooledCStatistic, 0, 1);
    }

    [Fact]
    public void Qualitative_Basic()
    {
        var entries = new List<AdvancedEngine.CodeEntry>
        {
            new() { study = "1", code = "Anxiety", frequency = 5 },
            new() { study = "1", code = "Depression", frequency = 3 },
            new() { study = "2", code = "Anxiety", frequency = 4 }
        };

        var result = AdvancedEngine.RunQualitative(entries);
        Assert.Equal(2, result.uniqueCodes);
        Assert.Equal(12, result.totalCodes);
        Assert.Equal("anxiety", result.codeFrequencies[0].code);
    }

    [Fact]
    public void Bibliometric_Basic()
    {
        var entries = new List<AdvancedEngine.CitationEntry>
        {
            new() { study = "1", references = new() { "refA", "refB" }, year = 2020 },
            new() { study = "2", references = new() { "refA", "refC" }, year = 2020 }
        };

        var result = AdvancedEngine.RunBibliometric(entries);
        Assert.NotEmpty(result.coCitationMatrix);
        Assert.Equal(3, result.uniqueReferences);
    }

    [Fact]
    public void Sequential_Basic()
    {
        var studies = new List<AdvancedEngine.SequentialStudy>
        {
            new() { study = "1", zScore = 1.5, informationFraction = 100 },
            new() { study = "2", zScore = 2.0, informationFraction = 100 },
            new() { study = "3", zScore = 1.8, informationFraction = 100 }
        };

        var result = AdvancedEngine.RunSequential(studies, 0.05, 0.20, 0.5);
        Assert.NotEmpty(result.zCurve);
        Assert.True(result.requiredInformationSize > 0);
    }

    [Fact]
    public void Dca_Basic()
    {
        var studies = new List<AdvancedEngine.DcaStudy>
        {
            new() { study = "1", sensitivity = 0.85, specificity = 0.9, prevalence = 0.3 },
            new() { study = "2", sensitivity = 0.8, specificity = 0.85, prevalence = 0.25 }
        };

        var result = AdvancedEngine.RunDca(studies);
        Assert.NotEmpty(result.netBenefitCurve);
        Assert.Equal(100, result.netBenefitCurve.Count);
    }
}
