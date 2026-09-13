using Poolr.Engine.Api;
using Xunit;

namespace Poolr.Engine.Tests;

public class PrognosticMetaTests
{
    [Fact]
    public void CStatistic_Pooled()
    {
        var req = new PrognosticMetaEngine.PrognosticMetaRequest
        {
            measure = "c-statistic",
            studies = new()
            {
                new() { study = "1", cStatistic = 0.75, cSe = 0.03 },
                new() { study = "2", cStatistic = 0.72, cSe = 0.04 },
                new() { study = "3", cStatistic = 0.78, cSe = 0.035 }
            }
        };

        var result = PrognosticMetaEngine.Run(req);
        Assert.InRange(result.pooledEstimate, 0.7, 0.8);
        Assert.Equal(3, result.nStudies);
        Assert.True(result.se > 0);
    }

    [Fact]
    public void CalibrationSlope_Pooled()
    {
        var req = new PrognosticMetaEngine.PrognosticMetaRequest
        {
            measure = "calibration-slope",
            studies = new()
            {
                new() { study = "1", calibrationSlope = 0.95, slopeSe = 0.05 },
                new() { study = "2", calibrationSlope = 1.02, slopeSe = 0.04 },
                new() { study = "3", calibrationSlope = 0.98, slopeSe = 0.06 }
            }
        };

        var result = PrognosticMetaEngine.Run(req);
        Assert.InRange(result.pooledEstimate, 0.9, 1.1);
    }

    [Fact]
    public void TooFewStudies_Throws()
    {
        var req = new PrognosticMetaEngine.PrognosticMetaRequest
        {
            studies = new() { new() { study = "1", cStatistic = 0.75, cSe = 0.03 } }
        };

        Assert.Throws<ArgumentException>(() => PrognosticMetaEngine.Run(req));
    }

    [Fact]
    public void CalibrationDeviates_Warning()
    {
        var req = new PrognosticMetaEngine.PrognosticMetaRequest
        {
            measure = "calibration-slope",
            studies = new()
            {
                new() { study = "1", calibrationSlope = 1.5, slopeSe = 0.05 },
                new() { study = "2", calibrationSlope = 1.6, slopeSe = 0.04 }
            }
        };

        var result = PrognosticMetaEngine.Run(req);
        Assert.NotEmpty(result.warnings);
    }
}

public class BivariateDtaTests
{
    [Fact]
    public void Basic_PooledSensSpec()
    {
        var req = new BivariateDtaEngine.BivariateRequest
        {
            studies = new()
            {
                new() { study = "1", sensitivity = 0.9, specificity = 0.85, sensSe = 0.03, specSe = 0.04 },
                new() { study = "2", sensitivity = 0.85, specificity = 0.88, sensSe = 0.04, specSe = 0.03 },
                new() { study = "3", sensitivity = 0.92, specificity = 0.82, sensSe = 0.035, specSe = 0.05 }
            }
        };

        var result = BivariateDtaEngine.Run(req);
        Assert.InRange(result.sensitivity, 0.8, 0.95);
        Assert.InRange(result.specificity, 0.8, 0.9);
        Assert.True(result.dor > 0);
        Assert.True(result.auc > 0.5);
        Assert.InRange(result.rho, -1, 1);
    }

    [Fact]
    public void Correlation_Computed()
    {
        // Negative correlation expected: higher sens often means lower spec
        var req = new BivariateDtaEngine.BivariateRequest
        {
            studies = new()
            {
                new() { study = "1", sensitivity = 0.95, specificity = 0.7, sensSe = 0.02, specSe = 0.03 },
                new() { study = "2", sensitivity = 0.8, specificity = 0.9, sensSe = 0.03, specSe = 0.02 },
                new() { study = "3", sensitivity = 0.9, specificity = 0.75, sensSe = 0.025, specSe = 0.035 }
            }
        };

        var result = BivariateDtaEngine.Run(req);
        Assert.True(result.rho < 0); // Expected negative correlation
    }

    [Fact]
    public void TooFewStudies_Throws()
    {
        var req = new BivariateDtaEngine.BivariateRequest
        {
            studies = new()
            {
                new() { study = "1", sensitivity = 0.9, specificity = 0.85, sensSe = 0.03, specSe = 0.04 }
            }
        };

        Assert.Throws<ArgumentException>(() => BivariateDtaEngine.Run(req));
    }
}
