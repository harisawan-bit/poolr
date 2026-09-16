using Poolr.Engine.Api;
using Xunit;

namespace Poolr.Engine.Tests;

public class TimeSeriesMetaTests
{
    [Fact]
    public void Basic_Trend()
    {
        var req = new TimeSeriesMetaEngine.TsRequest
        {
            studies = new()
            {
                new() { study = "1", effect = 0.5, se = 0.1, year = 2018 },
                new() { study = "2", effect = 0.4, se = 0.12, year = 2019 },
                new() { study = "3", effect = 0.3, se = 0.1, year = 2020 },
                new() { study = "4", effect = 0.2, se = 0.08, year = 2021 }
            }
        };

        var result = TimeSeriesMetaEngine.Run(req);
        Assert.InRange(result.pooled, -1, 2);
        Assert.True(result.trend < 0); // decreasing trend
    }

    [Fact]
    public void Interrupted_ChangeDetection()
    {
        var req = new TimeSeriesMetaEngine.TsRequest
        {
            interrupted = true,
            studies = new()
            {
                new() { study = "1", effect = 0.5, se = 0.1, year = 2018, postIntervention = false },
                new() { study = "2", effect = 0.4, se = 0.12, year = 2019, postIntervention = false },
                new() { study = "3", effect = 0.2, se = 0.1, year = 2020, postIntervention = true },
                new() { study = "4", effect = 0.1, se = 0.08, year = 2021, postIntervention = true }
            }
        };

        var result = TimeSeriesMetaEngine.Run(req);
        Assert.True(result.changeLevel < 0); // negative change
        Assert.Equal(2020, result.changePoint);
    }

    [Fact]
    public void TooFewStudies_Throws()
    {
        var req = new TimeSeriesMetaEngine.TsRequest
        {
            studies = new()
            {
                new() { study = "1", effect = 0.5, se = 0.1, year = 2020 }
            }
        };
        Assert.Throws<ArgumentException>(() => TimeSeriesMetaEngine.Run(req));
    }

    [Fact]
    public void Converged_True()
    {
        var req = new TimeSeriesMetaEngine.TsRequest
        {
            studies = new()
            {
                new() { study = "1", effect = 0.5, se = 0.1, year = 2019 },
                new() { study = "2", effect = 0.4, se = 0.1, year = 2020 },
                new() { study = "3", effect = 0.3, se = 0.1, year = 2021 }
            }
        };

        var result = TimeSeriesMetaEngine.Run(req);
        Assert.True(result.converged);
    }
}
