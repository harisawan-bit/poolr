using Poolr.Engine.Api;
using Xunit;

namespace Poolr.Engine.Tests;

public class PValueCombinationTests
{
    [Fact]
    public void Fisher_Combines()
    {
        var req = new PValueCombinationEngine.PValueRequest
        {
            pValues = new() { 0.01, 0.03, 0.05, 0.02 },
            method = "fisher"
        };

        var result = PValueCombinationEngine.Combine(req);
        Assert.InRange(result.combinedP, 0, 0.01);
        Assert.Equal(4, result.nStudies);
        Assert.Equal(8, result.degreesOfFreedom);
    }

    [Fact]
    public void Stouffer_Combines()
    {
        var req = new PValueCombinationEngine.PValueRequest
        {
            pValues = new() { 0.01, 0.03, 0.05 },
            method = "stouffer"
        };

        var result = PValueCombinationEngine.Combine(req);
        Assert.InRange(result.combinedP, 0, 0.01);
    }

    [Fact]
    public void Tippett_Combines()
    {
        var req = new PValueCombinationEngine.PValueRequest
        {
            pValues = new() { 0.01, 0.05, 0.1 },
            method = "tippett"
        };

        var result = PValueCombinationEngine.Combine(req);
        Assert.InRange(result.combinedP, 0, 0.05);
    }

    [Fact]
    public void Edgington_Combines()
    {
        var req = new PValueCombinationEngine.PValueRequest
        {
            pValues = new() { 0.4, 0.3, 0.2, 0.1 },
            method = "edgington"
        };

        var result = PValueCombinationEngine.Combine(req);
        Assert.InRange(result.combinedP, 0, 1);
    }

    [Fact]
    public void TooFewPValues_Throws()
    {
        var req = new PValueCombinationEngine.PValueRequest
        {
            pValues = new() { 0.05 }
        };

        Assert.Throws<ArgumentException>(() => PValueCombinationEngine.Combine(req));
    }

    [Fact]
    public void InvalidMethod_Throws()
    {
        var req = new PValueCombinationEngine.PValueRequest
        {
            pValues = new() { 0.01, 0.05 },
            method = "invalid"
        };

        Assert.Throws<ArgumentException>(() => PValueCombinationEngine.Combine(req));
    }
}
