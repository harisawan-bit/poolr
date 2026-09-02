using Poolr.Engine.Api;
using Xunit;

namespace Poolr.Engine.Tests;

public class NmaTests
{
    private static NmaEngine.NmaStudy S(string name, string t1, string t2, double eff, double se)
        => new() { study = name, treatment1 = t1, treatment2 = t2, measure = "OR", effect = eff, se = se };

    [Fact]
    public void FrequentistNma_ThreeArmedNetwork()
    {
        var studies = new List<NmaEngine.NmaStudy>
        {
            S("1", "A", "B", 0.2, 0.15),
            S("2", "A", "B", 0.1, 0.2),
            S("3", "B", "C", -0.15, 0.18),
            S("4", "A", "C", 0.05, 0.22),
        };
        var req = new NmaEngine.NmaRequest { studies = studies, measure = "OR", bayesian = false };
        var result = NmaEngine.Run(req);

        Assert.Equal(3, result.treatments.Count);
        Assert.Contains("A", result.treatments);
        Assert.Contains("B", result.treatments);
        Assert.Contains("C", result.treatments);
        Assert.Equal(3, result.league.Count);
        Assert.All(result.league, l =>
        {
            Assert.True(l.ciLower < l.ciUpper);
            Assert.True(l.effect > 0);
        });
        Assert.Equal(3, result.ranking.Count);
        Assert.All(result.ranking, r =>
        {
            Assert.InRange(r.pScore, 0, 1);
            Assert.InRange(r.sucra, 0, 100);
        });
    }

    [Fact]
    public void FrequentistNma_LeagueMatrix_Symmetric()
    {
        var studies = new List<NmaEngine.NmaStudy>
        {
            S("1", "A", "B", 0.3, 0.2),
            S("2", "B", "C", 0.1, 0.25),
            S("3", "A", "C", 0.2, 0.18),
        };
        var req = new NmaEngine.NmaRequest { studies = studies, measure = "OR", bayesian = false };
        var result = NmaEngine.Run(req);

        Assert.NotNull(result.leagueMatrix);
        Assert.Equal(3, result.leagueMatrix.Count);
        // Diagonal should be 0
        Assert.Equal(0, result.leagueMatrix[0][0]);
        Assert.Equal(0, result.leagueMatrix[1][1]);
        Assert.Equal(0, result.leagueMatrix[2][2]);
    }

    [Fact]
    public void BayesianNma_Converges()
    {
        var studies = new List<NmaEngine.NmaStudy>
        {
            S("1", "A", "B", 0.2, 0.15),
            S("2", "A", "B", 0.1, 0.2),
            S("3", "B", "C", -0.15, 0.18),
            S("4", "A", "C", 0.05, 0.22),
        };
        var req = new NmaEngine.NmaRequest
        {
            studies = studies,
            measure = "OR",
            bayesian = true,
            mcmcIter = 5000,
            warmup = 1000,
            seed = 42
        };
        var result = NmaEngine.Run(req);

        Assert.True(result.bayesian);
        Assert.InRange(result.tau2, 0, 10);
        Assert.Equal(3, result.ranking.Count);
        Assert.All(result.ranking, r =>
        {
            Assert.NotNull(r.rankProbs);
            Assert.Equal(3, r.rankProbs.Count);
            Assert.InRange(r.rankProbs.Sum(), 0.99, 1.01);
        });
    }

    [Fact]
    public void NodeSplit_DetectsInconsistency()
    {
        var studies = new List<NmaEngine.NmaStudy>
        {
            S("1", "A", "B", 0.5, 0.1),
            S("2", "B", "C", 0.5, 0.1),
            S("3", "A", "C", -0.2, 0.1), // inconsistent with A->B->C path
        };
        var req = new NmaEngine.NmaRequest { studies = studies, measure = "OR", bayesian = false };
        var result = NmaEngine.Run(req);

        Assert.NotEmpty(result.nodeSplit);
        Assert.All(result.nodeSplit, ns =>
        {
            Assert.NotNull(ns.treatment1);
            Assert.NotNull(ns.treatment2);
            Assert.NotNull(ns.commonComparator);
        });
    }

    [Fact]
    public void Nma_ThrowsOnSingleStudy()
    {
        var studies = new List<NmaEngine.NmaStudy>
        {
            S("1", "A", "B", 0.2, 0.15),
        };
        var req = new NmaEngine.NmaRequest { studies = studies, measure = "OR" };
        Assert.Throws<ArgumentException>(() => NmaEngine.Run(req));
    }

    [Fact]
    public void Nma_Ranking_PsumApproximatelyOne()
    {
        var studies = new List<NmaEngine.NmaStudy>
        {
            S("1", "A", "B", 0.2, 0.15),
            S("2", "B", "C", -0.1, 0.2),
            S("3", "A", "C", 0.05, 0.18),
        };
        var req = new NmaEngine.NmaRequest { studies = studies, measure = "OR", bayesian = false };
        var result = NmaEngine.Run(req);

        double pSum = result.ranking.Sum(r => r.pScore);
        Assert.InRange(pSum, result.ranking.Count / 2.0 - 0.1, result.ranking.Count / 2.0 + 0.1);
    }
}
