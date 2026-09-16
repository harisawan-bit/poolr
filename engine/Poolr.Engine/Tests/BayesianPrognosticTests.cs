using Poolr.Engine.Api;
using Xunit;

namespace Poolr.Engine.Tests;

public class BayesianPrognosticTests
{
    [Fact]
    public void Basic_PoolsHR()
    {
        var req = new BayesianPrognosticEngine.PrognosticRequest
        {
            studies = new()
            {
                new() { id = "1", logHr = 0.2, se = 0.1, nevents = 100 },
                new() { id = "2", logHr = 0.3, se = 0.12, nevents = 85 },
                new() { id = "3", logHr = 0.15, se = 0.08, nevents = 120 },
                new() { id = "4", logHr = 0.25, se = 0.11, nevents = 95 },
                new() { id = "5", logHr = 0.18, se = 0.09, nevents = 110 },
            },
            iter = 5000,
            warmup = 1000,
            seed = 42
        };

        var result = BayesianPrognosticEngine.Run(req);
        Assert.Equal(5, result.nStudies);
        Assert.InRange(result.pooledMedian, -1, 1);
        Assert.True(result.ciUpper > result.ciLower);
        Assert.True(result.totalEvents > 0);
    }

    [Fact]
    public void TooFewStudies_Throws()
    {
        var req = new BayesianPrognosticEngine.PrognosticRequest
        {
            studies = new()
            {
                new() { id = "1", logHr = 0.2, se = 0.1 },
                new() { id = "2", logHr = 0.3, se = 0.12 },
            }
        };
        Assert.Throws<ArgumentException>(() => BayesianPrognosticEngine.Run(req));
    }

    [Fact]
    public void ZeroSe_Throws()
    {
        var req = new BayesianPrognosticEngine.PrognosticRequest
        {
            studies = new()
            {
                new() { id = "1", logHr = 0.2, se = 0 },
                new() { id = "2", logHr = 0.3, se = 0.12 },
                new() { id = "3", logHr = 0.15, se = 0.08 },
            }
        };
        Assert.Throws<ArgumentException>(() => BayesianPrognosticEngine.Run(req));
    }

    [Fact]
    public void Convergence_Detected()
    {
        var req = new BayesianPrognosticEngine.PrognosticRequest
        {
            studies = new()
            {
                new() { id = "1", logHr = 0.2, se = 0.1 },
                new() { id = "2", logHr = 0.25, se = 0.1 },
                new() { id = "3", logHr = 0.18, se = 0.1 },
                new() { id = "4", logHr = 0.22, se = 0.1 },
                new() { id = "5", logHr = 0.19, se = 0.1 },
            },
            iter = 10000,
            warmup = 2000,
            seed = 42
        };

        var result = BayesianPrognosticEngine.Run(req);
        Assert.True(result.rhat < 1.2);
        Assert.True(result.ess > 100);
    }
}
