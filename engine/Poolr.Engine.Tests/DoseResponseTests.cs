using Poolr.Engine.Api;
using Xunit;

namespace Poolr.Engine.Tests;

public class DoseResponseTests
{
    [Fact]
    public void LinearDoseResponse_Basic()
    {
        var studies = new List<DoseResponseEngine.DoseStudy>
        {
            new() { study = "1", categories = new() {
                new() { dose = 0, rr = 1.0, rrLower = 0.8, rrUpper = 1.2 },
                new() { dose = 1, rr = 1.3, rrLower = 1.0, rrUpper = 1.6 },
                new() { dose = 2, rr = 1.6, rrLower = 1.2, rrUpper = 2.0 },
            }},
            new() { study = "2", categories = new() {
                new() { dose = 0, rr = 1.0, rrLower = 0.7, rrUpper = 1.3 },
                new() { dose = 1, rr = 1.2, rrLower = 0.9, rrUpper = 1.5 },
                new() { dose = 2, rr = 1.4, rrLower = 1.0, rrUpper = 1.8 },
            }},
        };
        var req = new DoseResponseEngine.DoseRequest { studies = studies, model = "linear" };
        var result = DoseResponseEngine.Run(req);

        Assert.Equal("Linear dose-response", result.model);
        Assert.NotEmpty(result.fittedCurve);
        Assert.True(result.slope > 0);
    }

    [Fact]
    public void Emax_Basic()
    {
        var studies = new List<DoseResponseEngine.DoseStudy>
        {
            new() { study = "1", categories = new() {
                new() { dose = 0, rr = 1.0 },
                new() { dose = 1, rr = 1.5 },
                new() { dose = 2, rr = 1.8 },
            }},
            new() { study = "2", categories = new() {
                new() { dose = 0, rr = 1.0 },
                new() { dose = 1, rr = 1.3 },
                new() { dose = 2, rr = 1.6 },
            }},
        };
        var req = new DoseResponseEngine.DoseRequest { studies = studies, model = "emax" };
        var result = DoseResponseEngine.Run(req);

        Assert.Equal("E_max parametric", result.model);
        Assert.NotNull(result.emax);
        Assert.NotNull(result.ed50);
        Assert.NotEmpty(result.fittedCurve);
    }
}
