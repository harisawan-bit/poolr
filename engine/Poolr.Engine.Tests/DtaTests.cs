using Poolr.Engine.Api;
using Xunit;

namespace Poolr.Engine.Tests;

public class DtaTests
{
    private static DtaEngine.DtaStudy S(string name, int tp, int fp, int fn, int tn)
        => new() { study = name, tp = tp, fp = fp, fn = fn, tn = tn };

    [Fact]
    public void BivariateDta_Basic()
    {
        var studies = new List<DtaEngine.DtaStudy>
        {
            S("1", 80, 20, 10, 90),
            S("2", 70, 30, 15, 85),
            S("3", 90, 10, 5, 95),
        };
        var req = new DtaEngine.DtaRequest { studies = studies, model = "bivariate" };
        var result = DtaEngine.Run(req);

        Assert.Equal("Bivariate Reitsma", result.model);
        Assert.InRange(result.sensitivity, 0, 1);
        Assert.InRange(result.specificity, 0, 1);
        Assert.True(result.sensCiLower < result.sensitivity);
        Assert.True(result.sensCiUpper > result.sensitivity);
        Assert.True(result.specCiLower < result.specificity);
        Assert.True(result.specCiUpper > result.specificity);
        Assert.True(result.dor > 0);
        Assert.InRange(result.auc, 0.5, 1);
    }

    [Fact]
    public void BivariateDta_WithZeroCells()
    {
        var studies = new List<DtaEngine.DtaStudy>
        {
            S("1", 100, 0, 0, 100),
            S("2", 80, 20, 10, 90),
        };
        var req = new DtaEngine.DtaRequest { studies = studies, model = "bivariate" };
        var result = DtaEngine.Run(req);

        Assert.Equal("Bivariate Reitsma", result.model);
        Assert.True(result.sensitivity > 0);
        Assert.True(result.specificity > 0);
    }

    [Fact]
    public void HsrocDta_Basic()
    {
        var studies = new List<DtaEngine.DtaStudy>
        {
            S("1", 80, 20, 10, 90),
            S("2", 70, 30, 15, 85),
            S("3", 90, 10, 5, 95),
            S("4", 60, 40, 20, 80),
        };
        var req = new DtaEngine.DtaRequest { studies = studies, model = "hsroc" };
        var result = DtaEngine.Run(req);

        Assert.Equal("HSROC", result.model);
        Assert.InRange(result.sensitivity, 0, 1);
        Assert.InRange(result.specificity, 0, 1);
    }

    [Fact]
    public void Dta_ThrowsOnInsufficientStudies()
    {
        var studies = new List<DtaEngine.DtaStudy>
        {
            S("1", 80, 20, 10, 90),
        };
        var req = new DtaEngine.DtaRequest { studies = studies, model = "bivariate" };
        Assert.Throws<ArgumentException>(() => DtaEngine.Run(req));
    }

    [Fact]
    public void Dta_ThrowsOnInvalidData()
    {
        var studies = new List<DtaEngine.DtaStudy>
        {
            S("1", 0, 0, 0, 0),
            S("2", 80, 20, 10, 90),
        };
        var req = new DtaEngine.DtaRequest { studies = studies, model = "bivariate" };
        Assert.Throws<ArgumentException>(() => DtaEngine.Run(req));
    }
}
