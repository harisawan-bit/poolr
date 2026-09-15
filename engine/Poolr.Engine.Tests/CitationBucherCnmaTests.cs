using Poolr.Engine.Api;
using Xunit;

namespace Poolr.Engine.Tests;

public class CitationNetworkTests
{
    [Fact]
    public void Basic_CoCitation()
    {
        var req = new CitationNetworkEngine.CitationNetworkRequest
        {
            papers = new()
            {
                new() { id = "1", title = "A", references = new() { "ref1", "ref2", "ref3" } },
                new() { id = "2", title = "B", references = new() { "ref1", "ref2", "ref4" } },
                new() { id = "3", title = "C", references = new() { "ref1", "ref3", "ref4" } }
            },
            minCoCitation = 2
        };

        var result = CitationNetworkEngine.Analyze(req);
        Assert.True(result.coCitations.Count > 0);
        Assert.Equal(3, result.totalPapers);
    }

    [Fact]
    public void BibliographicCoupling_Computed()
    {
        var req = new CitationNetworkEngine.CitationNetworkRequest
        {
            papers = new()
            {
                new() { id = "1", references = new() { "ref1", "ref2", "ref3" } },
                new() { id = "2", references = new() { "ref1", "ref2", "ref4" } },
                new() { id = "3", references = new() { "ref5", "ref6" } }
            },
            includeBibliographicCoupling = true
        };

        var result = CitationNetworkEngine.Analyze(req);
        Assert.True(result.bibliographicCouplings.Count > 0);
    }

    [Fact]
    public void Clusters_Found()
    {
        var req = new CitationNetworkEngine.CitationNetworkRequest
        {
            papers = new()
            {
                new() { id = "1", title = "A", references = new() { "refA", "refB" } },
                new() { id = "2", title = "B", references = new() { "refA", "refB" } },
                new() { id = "3", title = "C", references = new() { "refA", "refB" } },
                new() { id = "4", title = "D", references = new() { "refC", "refD" } }
            },
            minCoCitation = 2
        };

        var result = CitationNetworkEngine.Analyze(req);
        // Papers 1, 2, 3 all reference refA and refB, creating co-citations
        Assert.True(result.coCitations.Count > 0);
    }

    [Fact]
    public void EmptyPapers_NoError()
    {
        var req = new CitationNetworkEngine.CitationNetworkRequest { papers = new() };
        var result = CitationNetworkEngine.Analyze(req);
        Assert.Equal(0, result.totalPapers);
    }
}

public class BucherTests
{
    [Fact]
    public void Basic_Comparison()
    {
        var req = new BucherIndirectComparisonEngine.BucherRequest
        {
            treatmentA = "Drug A",
            treatmentB = "Drug B",
            commonComparator = "Placebo",
            armA = new() { treatment = "Drug A", effectVsCommon = -0.3, seVsCommon = 0.1 },
            armB = new() { treatment = "Drug B", effectVsCommon = -0.1, seVsCommon = 0.12 },
            measure = "OR"
        };

        var result = BucherIndirectComparisonEngine.Compare(req);
        Assert.Equal("Drug A", result.treatmentA);
        Assert.Equal("Drug B", result.treatmentB);
        Assert.True(Math.Abs(result.indirectEffect - (-0.18)) < 0.05);
        Assert.True(result.se > 0);
        Assert.False(string.IsNullOrEmpty(result.interpretation));
    }

    [Fact]
    public void SignificantDifference_Detected()
    {
        var req = new BucherIndirectComparisonEngine.BucherRequest
        {
            treatmentA = "Drug A",
            treatmentB = "Drug B",
            commonComparator = "Placebo",
            armA = new() { effectVsCommon = -0.5, seVsCommon = 0.1 },
            armB = new() { effectVsCommon = -0.05, seVsCommon = 0.1 }
        };

        var result = BucherIndirectComparisonEngine.Compare(req);
        Assert.True(result.p < 0.05);
        Assert.Contains("significantly different", result.interpretation);
    }

    [Fact]
    public void NoSignificance_NotDifferent()
    {
        var req = new BucherIndirectComparisonEngine.BucherRequest
        {
            treatmentA = "A",
            treatmentB = "B",
            commonComparator = "P",
            armA = new() { effectVsCommon = -0.1, seVsCommon = 0.15 },
            armB = new() { effectVsCommon = -0.08, seVsCommon = 0.15 }
        };

        var result = BucherIndirectComparisonEngine.Compare(req);
        Assert.True(result.p > 0.05);
    }

    [Fact]
    public void MissingEffect_Throws()
    {
        var req = new BucherIndirectComparisonEngine.BucherRequest
        {
            armA = new() { effectVsCommon = null, seVsCommon = 0.1 },
            armB = new() { effectVsCommon = -0.1, seVsCommon = 0.1 }
        };

        Assert.Throws<ArgumentException>(() => BucherIndirectComparisonEngine.Compare(req));
    }
}

public class CnmaTests
{
    [Fact]
    public void Basic_DecomposesComponents()
    {
        var req = new ComponentNmaEngine.CnmaRequest
        {
            interventions = new()
            {
                new() { name = "A+B", components = new() { "A", "B" }, effect = -0.5, se = 0.1 },
                new() { name = "A", components = new() { "A" }, effect = -0.3, se = 0.12 },
                new() { name = "B", components = new() { "B" }, effect = -0.2, se = 0.11 }
            }
        };

        var result = ComponentNmaEngine.Run(req);
        Assert.Equal(2, result.nComponents);
        Assert.Equal(2, result.componentEffects.Count);
    }

    [Fact]
    public void ComponentEffects_Pooled()
    {
        var req = new ComponentNmaEngine.CnmaRequest
        {
            interventions = new()
            {
                new() { name = "A", components = new() { "A" }, effect = -0.4, se = 0.1 },
                new() { name = "A+C", components = new() { "A", "C" }, effect = -0.6, se = 0.12 },
                new() { name = "C", components = new() { "C" }, effect = -0.2, se = 0.08 }
            }
        };

        var result = ComponentNmaEngine.Run(req);
        var compA = result.componentEffects.First(c => c.component == "A");
        var compC = result.componentEffects.First(c => c.component == "C");
        Assert.True(compA.nStudies >= 2);
        Assert.True(compC.nStudies >= 2);
    }

    [Fact]
    public void SingleIntervention_NoError()
    {
        var req = new ComponentNmaEngine.CnmaRequest
        {
            interventions = new()
            {
                new() { name = "A", components = new() { "A" }, effect = -0.3, se = 0.1 }
            }
        };

        // Single intervention should not throw, just return minimal result
        var result = ComponentNmaEngine.Run(req);
        Assert.Equal(1, result.nComponents);
        Assert.Single(result.componentEffects);
    }
}
