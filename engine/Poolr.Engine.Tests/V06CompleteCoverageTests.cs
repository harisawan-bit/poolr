using Poolr.Engine.Api;
using Xunit;

namespace Poolr.Engine.Tests;

public class BayesianMultilevelTests
{
    [Fact]
    public void Basic_ThreeLevel()
    {
        var req = new BayesianMultilevelEngine.MultilevelRequest
        {
            effects = new() { 0.5, 0.3, 0.7, 0.2, 0.6, 0.4 },
            variances = new() { 0.04, 0.05, 0.03, 0.06, 0.04, 0.05 },
            studyIds = new() { "A", "A", "B", "B", "C", "C" }
        };

        var result = BayesianMultilevelEngine.Run(req);
        Assert.InRange(result.pooledEffect, -1, 2);
        Assert.True(result.tau2Within >= 0);
        Assert.True(result.tau2Between >= 0);
        Assert.True(result.i2Total >= 0);
        Assert.Equal(3, result.randomEffects.Count);
    }

    [Fact]
    public void SingleCluster_Throws()
    {
        var req = new BayesianMultilevelEngine.MultilevelRequest
        {
            effects = new() { 0.5, 0.3 },
            variances = new() { 0.04, 0.05 },
            studyIds = new() { "A", "A" }
        };

        Assert.Throws<ArgumentException>(() => BayesianMultilevelEngine.Run(req));
    }
}

public class BayesianDtaTests
{
    [Fact]
    public void Basic_PooledSensSpec()
    {
        var req = new BayesianDtaEngine.BayesianDtaRequest
        {
            studies = new()
            {
                new() { tp = 80, fp = 20, fn = 10, tn = 90 },
                new() { tp = 70, fp = 30, fn = 15, tn = 85 }
            }
        };

        var result = BayesianDtaEngine.Run(req);
        Assert.InRange(result.sensitivity, 0, 1);
        Assert.InRange(result.specificity, 0, 1);
        Assert.True(result.dor > 0);
        Assert.InRange(result.auc, 0.5, 1);
    }
}

public class BayesianPrognosticTests
{
    [Fact]
    public void Basic_PooledHR()
    {
        var req = new BayesianPrognosticEngine.PrognosticRequest
        {
            studies = new()
            {
                new() { logHr = -0.3, se = 0.1, cStatistic = 0.75 },
                new() { logHr = -0.2, se = 0.12, cStatistic = 0.72 },
                new() { logHr = -0.4, se = 0.08, cStatistic = 0.78 }
            }
        };

        var result = BayesianPrognosticEngine.Run(req);
        Assert.InRange(result.pooledHr, 0, 2);
        Assert.InRange(result.pooledC, 0.5, 1);
        Assert.True(result.i2 >= 0);
    }
}

public class DoseResponseNmaTests
{
    [Fact]
    public void Basic_DoseTrend()
    {
        var req = new DoseResponseNmaEngine.DoseNmaRequest
        {
            studies = new()
            {
                new() { study = "1", treatment = "A", dose = 10, effect = -0.1, se = 0.05 },
                new() { study = "1", treatment = "A", dose = 20, effect = -0.3, se = 0.06 },
                new() { study = "2", treatment = "B", dose = 10, effect = -0.2, se = 0.05 },
                new() { study = "2", treatment = "B", dose = 20, effect = -0.4, se = 0.06 }
            }
        };

        var result = DoseResponseNmaEngine.Run(req);
        Assert.True(result.slope < 0);
        Assert.True(result.treatmentSlopes.Count >= 2);
    }
}

public class QualitativeSynthesisTests
{
    [Fact]
    public void Thematic_Basic()
    {
        var req = new QualitativeSynthesisEngine.QualitativeRequest
        {
            method = "thematic",
            entries = new()
            {
                new() { study = "1", code = "Anxiety", frequency = 5, category = "Mental Health" },
                new() { study = "2", code = "Anxiety", frequency = 3, category = "Mental Health" },
                new() { study = "1", code = "Depression", frequency = 2, category = "Mental Health" }
            }
        };

        var result = QualitativeSynthesisEngine.Run(req);
        Assert.Equal(2, result.uniqueCodes);
        Assert.Equal(3, result.totalCodes);
        Assert.Equal(2, result.totalStudies);
    }

    [Fact]
    public void MetaEthnography_Translations()
    {
        var req = new QualitativeSynthesisEngine.QualitativeRequest
        {
            method = "meta-ethnography",
            entries = new()
            {
                new() { study = "1", code = "Isolation", theme = "Social Disconnection" },
                new() { study = "2", code = "Loneliness", theme = "Social Disconnection" },
                new() { study = "3", code = "Withdrawal", theme = "Social Disconnection" }
            }
        };

        var result = QualitativeSynthesisEngine.Run(req);
        Assert.Single(result.themes);
        Assert.Equal("social disconnection", result.themes[0].theme);
    }
}

public class SpatialMetaTests
{
    [Fact]
    public void Basic_SpatialAutocorrelation()
    {
        var req = new SpatialMetaEngine.SpatialRequest
        {
            studies = new()
            {
                new() { study = "1", effect = 0.5, se = 0.1, lat = 40.7, lon = -74.0 },
                new() { study = "2", effect = 0.3, se = 0.12, lat = 34.0, lon = -118.2 },
                new() { study = "3", effect = 0.7, se = 0.08, lat = 41.8, lon = -87.6 },
                new() { study = "4", effect = 0.2, se = 0.15, lat = 29.7, lon = -95.3 }
            }
        };

        var result = SpatialMetaEngine.Run(req);
        Assert.InRange(result.pooledEffect, -1, 2);
        Assert.InRange(result.moranI, -1, 1);
        Assert.True(result.range > 0);
    }
}

public class PharmacokineticTests
{
    [Fact]
    public void Basic_AucPooling()
    {
        var req = new PharmacokineticEngine.PkRequest
        {
            parameter = "auc",
            studies = new()
            {
                new() { study = "1", auc = 100, cmax = 50, t12 = 8, dose = 200, n = 20 },
                new() { study = "2", auc = 110, cmax = 55, t12 = 9, dose = 200, n = 25 },
                new() { study = "3", auc = 95, cmax = 48, t12 = 7.5, dose = 200, n = 22 }
            }
        };

        var result = PharmacokineticEngine.Run(req);
        Assert.True(result.pooled > 0);
        Assert.True(result.geometricMean > 0);
        Assert.True(result.geometricCv >= 0);
    }
}

public class AiScreeningTests
{
    [Fact]
    public void Basic_Ranking()
    {
        var req = new AiScreeningEngine.ScreeningRequest
        {
            records = new()
            {
                new() { id = "1", title = "RCT of drug X" },
                new() { id = "2", title = "Case report" },
                new() { id = "3", title = "Systematic review" }
            },
            labeledData = new()
            {
                new() { id = "10", title = "RCT of drug Y", prediction = "include" },
                new() { id = "11", title = "Observational study", prediction = "include" },
                new() { id = "12", title = "Editorial comment", prediction = "exclude" }
            }
        };

        var result = AiScreeningEngine.Run(req);
        Assert.Equal(3, result.ranked.Count);
        Assert.True(result.suggestedStopAfter > 0);
    }

    [Fact]
    public void InsufficientData_ReturnsUncertain()
    {
        var req = new AiScreeningEngine.ScreeningRequest
        {
            records = new() { new() { id = "1", title = "Some title" } },
            labeledData = new()
        };

        var result = AiScreeningEngine.Run(req);
        Assert.All(result.ranked, r => Assert.Equal("uncertain", r.prediction));
    }
}

public class ProfileLikelihoodTests
{
    [Fact]
    public void Basic_ProfileCI()
    {
        var req = new ProfileLikelihoodEngine.ProfileRequest
        {
            effects = new() { 0.5, 0.3, 0.7, 0.2, 0.6 },
            variances = new() { 0.04, 0.05, 0.03, 0.06, 0.04 }
        };

        var result = ProfileLikelihoodEngine.Run(req);
        Assert.True(result.tau2Estimate >= 0);
        Assert.True(result.ciLower >= 0);
        Assert.True(result.ciUpper >= result.ciLower);
        Assert.True(result.profilePoints.Count > 0);
    }
}

public class FractionalPolynomialTests
{
    [Fact]
    public void Basic_FpFit()
    {
        var req = new FractionalPolynomialEngine.FpRequest
        {
            effects = new() { 0.5, 0.3, 0.7, 0.2, 0.6 },
            variances = new() { 0.04, 0.05, 0.03, 0.06, 0.04 },
            moderators = new() { 10.0, 20.0, 30.0, 40.0, 50.0 },
            degree = 2
        };

        var result = FractionalPolynomialEngine.Run(req);
        Assert.NotNull(result.coefficients);
        Assert.NotNull(result.bestModel);
        Assert.True(result.fittedCurve.Count > 0);
    }
}

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
        Assert.Equal(2019, result.changePoint);
    }
}
