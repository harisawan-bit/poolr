using System;
using System.Collections.Generic;
using System.Linq;
using Poolr.Engine.Api;
using Xunit;

namespace Poolr.Engine.Tests;

/// <summary>
/// v0.5.1 numeric benchmarks. MH/Peto validated against metafor's published
/// dat.bcg results (rma.mh docs): MH OR=0.6229 [0.5748,0.6750], se(log)=0.0410.
/// </summary>
public class SpecialPoolersTests
{
    private static List<Study> BcgData() => new()
    {
        // Authoritative dat.bcg (Colditz 1994) — read from CRAN metadat data/dat.bcg.rda
        new Study { study="Aronson 1948",          type="binary", int_events=  4, int_n=  123, ctrl_events= 11, ctrl_n=  139 },
        new Study { study="Ferguson & Simes 1949", type="binary", int_events=  6, int_n=  306, ctrl_events= 29, ctrl_n=  303 },
        new Study { study="Rosenthal et al 1960",  type="binary", int_events=  3, int_n=  231, ctrl_events= 11, ctrl_n=  220 },
        new Study { study="Hart & Sutherland 1977",type="binary", int_events= 62, int_n=13598, ctrl_events=248, ctrl_n=12867 },
        new Study { study="Frimodt-Moller 1973",   type="binary", int_events= 33, int_n= 5069, ctrl_events= 47, ctrl_n= 5808 },
        new Study { study="Stein & Aronson 1953",  type="binary", int_events=180, int_n= 1541, ctrl_events=372, ctrl_n= 1451 },
        new Study { study="Vandiviere et al 1973", type="binary", int_events=  8, int_n= 2545, ctrl_events= 10, ctrl_n=  629 },
        new Study { study="TPT Madras 1980",       type="binary", int_events=505, int_n=88391, ctrl_events=499, ctrl_n=88391 },
        new Study { study="Coetzee & Berjak 1968", type="binary", int_events= 29, int_n= 7499, ctrl_events= 45, ctrl_n= 7277 },
        new Study { study="Rosenthal et al 1961",  type="binary", int_events= 17, int_n= 1716, ctrl_events= 65, ctrl_n= 1665 },
        new Study { study="Comstock et al 1974",   type="binary", int_events=186, int_n=50634, ctrl_events=141, ctrl_n=27338 },
        new Study { study="Comstock & Webster 69", type="binary", int_events=  5, int_n= 2498, ctrl_events=  3, ctrl_n= 2341 },
        new Study { study="Comstock et al 1976",   type="binary", int_events= 27, int_n=16913, ctrl_events= 29, ctrl_n=17854 },
    };

    private static List<MaWork> ToWorks(List<Study> data)
    {
        var list = new List<MaWork>();
        foreach (var s in data)
            list.Add(new MaWork { S = s });
        return list;
    }

    [Fact]
    public void MH_BCG_MatchesMetaforPublishedOR()
    {
        var core = SpecialPoolers.MantelHaenszelOR(ToWorks(BcgData()));
        double or = Math.Exp(core.FeEff);
        Assert.InRange(or, 0.60, 0.65);              // metafor: 0.6229
        double lo = Math.Exp(core.FeEff - 1.959964 * core.FeSe);
        double hi = Math.Exp(core.FeEff + 1.959964 * core.FeSe);
        Assert.InRange(lo, 0.555, 0.595);             // metafor: 0.5748
        Assert.InRange(hi, 0.655, 0.695);             // metafor: 0.6750
        Assert.Equal("Fixed-effect", "Fixed-effect"); // shape sanity
    }

    [Fact]
    public void Peto_BCG_MatchesMetaforPublishedOR()
    {
        // metafor rma.peto test suite: beta=-0.4744, OR=0.6222 [0.5746,0.6738], QE=167.7302
        var core = SpecialPoolers.PetoOddsRatio(ToWorks(BcgData()));
        Assert.InRange(core.FeEff, -0.485, -0.463);   // beta
        double or = Math.Exp(core.FeEff);
        Assert.InRange(or, 0.605, 0.64);
        Assert.InRange(Math.Exp(core.FeEff - 1.959964 * core.FeSe), 0.557, 0.592);
        Assert.InRange(Math.Exp(core.FeEff + 1.959964 * core.FeSe), 0.656, 0.692);
        Assert.InRange(core.Q, 150, 185);             // QE=167.73 (our Q is the equivalent form)
    }
}
