using Poolr.Engine.Api;
using Xunit;

namespace Poolr.Engine.Tests;

public class BayesianNmaTests
{
    private static NmaEngine.NmaStudy S(string name, string t1, string t2, double eff, double se)
        => new() { study = name, treatment1 = t1, treatment2 = t2, measure = "OR", effect = eff, se = se };

    [Fact]
    public void Basic_Converges()
    {
        var studies = new List<NmaEngine.NmaStudy>
        {
            S("1", "A", "B", 0.2, 0.15),
            S("2", "A", "B", 0.1, 0.2),
            S("3", "B", "C", -0.15, 0.18),
            S("4", "A", "C", 0.05, 0.22),
        };

        var req = new BayesianNmaEngine.BayesianNmaRequest
        {
            studies = studies,
            iter = 3000,
            warmup = 500,
            chains = 2,
            seed = 42
        };

        var result = BayesianNmaEngine.Run(req);
        Assert.Equal(3, result.treatments.Count);
        Assert.Equal(3, result.league.Count);
        Assert.Equal(3, result.ranking.Count);
        Assert.True(result.tau2 >= 0);
    }

    [Fact]
    public void Dic_Computed()
    {
        var studies = new List<NmaEngine.NmaStudy>
        {
            S("1", "A", "B", 0.2, 0.15),
            S("2", "A", "B", 0.1, 0.2),
            S("3", "B", "C", -0.15, 0.18),
            S("4", "A", "C", 0.05, 0.22),
        };

        var req = new BayesianNmaEngine.BayesianNmaRequest
        {
            studies = studies,
            iter = 3000,
            warmup = 500,
            chains = 2,
            seed = 42
        };

        var result = BayesianNmaEngine.Run(req);
        Assert.True(double.IsFinite(result.dic));
        Assert.True(double.IsFinite(result.pd));
    }

    [Fact]
    public void SingleStudy_Throws()
    {
        var studies = new List<NmaEngine.NmaStudy> { S("1", "A", "B", 0.2, 0.15) };
        var req = new BayesianNmaEngine.BayesianNmaRequest { studies = studies };
        Assert.Throws<ArgumentException>(() => BayesianNmaEngine.Run(req));
    }
}

public class UmbrellaReviewTests
{
    [Fact]
    public void Basic_ComputesOverlap()
    {
        var reviews = new List<UmbrellaReviewEngine.ReviewStudy>
        {
            new() { reviewId = "1", title = "Review A", nStudies = 10, nParticipants = 1000, pooledEffect = 0.5, ciLower = 0.3, ciUpper = 0.7, i2 = 30, includedStudies = new() { "s1", "s2", "s3" } },
            new() { reviewId = "2", title = "Review B", nStudies = 8, nParticipants = 800, pooledEffect = 0.6, ciLower = 0.4, ciUpper = 0.8, i2 = 25, includedStudies = new() { "s2", "s3", "s4" } },
            new() { reviewId = "3", title = "Review C", nStudies = 12, nParticipants = 1200, pooledEffect = 0.4, ciLower = 0.2, ciUpper = 0.6, i2 = 40, includedStudies = new() { "s1", "s4", "s5" } }
        };

        var req = new UmbrellaReviewEngine.UmbrellaRequest { reviews = reviews, outcome = "mortality" };
        var result = UmbrellaReviewEngine.Run(req);

        Assert.Equal(3, result.nReviews);
        Assert.Equal(5, result.totalUniqueStudies);
        Assert.True(result.cca > 0);
        Assert.NotNull(result.pooledEffect);
        Assert.NotNull(result.i2);
    }

    [Fact]
    public void NoOverlap_LowCca()
    {
        var reviews = new List<UmbrellaReviewEngine.ReviewStudy>
        {
            new() { reviewId = "1", title = "A", nStudies = 5, pooledEffect = 0.5, ciLower = 0.3, ciUpper = 0.7, includedStudies = new() { "s1", "s2", "s3" } },
            new() { reviewId = "2", title = "B", nStudies = 5, pooledEffect = 0.6, ciLower = 0.4, ciUpper = 0.8, includedStudies = new() { "s4", "s5", "s6" } }
        };

        var req = new UmbrellaReviewEngine.UmbrellaRequest { reviews = reviews };
        var result = UmbrellaReviewEngine.Run(req);

        Assert.Equal(6, result.totalUniqueStudies);
        Assert.True(result.cca < 5);
        Assert.Equal("Slight", result.overlapLevel);
    }

    [Fact]
    public void HighOverlap_Warning()
    {
        var reviews = new List<UmbrellaReviewEngine.ReviewStudy>
        {
            new() { reviewId = "1", title = "A", nStudies = 10, pooledEffect = 0.5, ciLower = 0.3, ciUpper = 0.7, includedStudies = new() { "s1", "s2", "s3", "s4", "s5" } },
            new() { reviewId = "2", title = "B", nStudies = 10, pooledEffect = 0.6, ciLower = 0.4, ciUpper = 0.8, includedStudies = new() { "s1", "s2", "s3", "s4", "s5" } },
            new() { reviewId = "3", title = "C", nStudies = 10, pooledEffect = 0.4, ciLower = 0.2, ciUpper = 0.6, includedStudies = new() { "s1", "s2", "s3", "s4", "s5" } }
        };

        var req = new UmbrellaReviewEngine.UmbrellaRequest { reviews = reviews };
        var result = UmbrellaReviewEngine.Run(req);

        Assert.Equal("Very high", result.overlapLevel);
        Assert.NotEmpty(result.warnings);
    }

    [Fact]
    public void SingleReview_Throws()
    {
        var reviews = new List<UmbrellaReviewEngine.ReviewStudy>
        {
            new() { reviewId = "1", title = "A", nStudies = 5, includedStudies = new() { "s1" } }
        };

        var req = new UmbrellaReviewEngine.UmbrellaRequest { reviews = reviews };
        Assert.Throws<ArgumentException>(() => UmbrellaReviewEngine.Run(req));
    }
}
