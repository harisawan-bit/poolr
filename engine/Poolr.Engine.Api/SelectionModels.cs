using System;
using System.Collections.Generic;
using System.Linq;

namespace Poolr.Engine.Api;

/// <summary>
/// Step-function 3-parameter selection model (Vevea-Hedges style, one-sided p,
/// steps at .05/.10). Weights: w=1 (p&lt;=.05), exp(g1) (.05&lt;p&lt;=.10), exp(g2) (&gt;.10),
/// g1,g2 &lt;= 0 (non-significant strata can only be DOWN-weighted).
/// Because z=(y-theta)/sigma is standard normal, the truncation constants are
/// theta-free: c1=P(z&gt;=1.6449), c2=P(1.2816&lt;z&lt;1.6449), c3=P(z&lt;=1.2816).
/// For fixed (tau2, g1, g2) the MLE of theta is a weighted mean -> closed form;
/// tau2 and gammas are profiled over bounded grids. Experimental feature.
/// </summary>
public static class SelectionModels
{
    public static SelectionModelResult Fit(List<double> effs, List<double> vars, bool logScale)
    {
        int k = effs.Count;
        var res = new SelectionModelResult();
        if (k < 10)
        {
            res.note = "Step-function 3PSM needs >=10 studies for stable estimation; not fitted.";
            // fall back to plain RE(DL) estimate
            var (th0, t20) = ReDl(effs, vars);
            res.theta = logScale ? Math.Exp(th0) : th0;
            res.tau2 = t20;
            return res;
        }

        double c1 = 1 - Phi(1.644854);
        double c2 = Phi(1.281552) - Phi(1.644854);
        double c3 = Phi(1.281552);

        double[] gGrid = { 0.0, -0.25, -0.5, -1.0, -2.0 };
        double bestLl = double.NegativeInfinity;
        double bestTheta = 0, bestTau2 = 0, bestG1 = 0, bestG2 = 0;

        foreach (double g1 in gGrid)
            foreach (double g2 in gGrid)
            {
                if (g2 > g1) continue; // monotone: further strata weaker or equal
                double norm = c1 + c2 * Math.Exp(g1) + c3 * Math.Exp(g2);
                foreach (double tau2 in TauGrid(vars))
                {
                    // selection-adjusted weighted mean (closed form)
                    double num = 0, den = 0;
                    for (int i = 0; i < k; i++)
                    {
                        double wi = Weight(effs[i], vars[i], tau2, g1, g2);
                        num += wi * effs[i] / (vars[i] + tau2);
                        den += wi / (vars[i] + tau2);
                    }
                    if (den <= 0) continue;
                    double theta = num / den;

                    double ll = -k * Math.Log(norm);
                    for (int i = 0; i < k; i++)
                    {
                        double wi = Weight(effs[i], vars[i], tau2, g1, g2);
                        double v = vars[i] + tau2;
                        ll += Math.Log(wi) - 0.5 * Math.Log(2 * Math.PI * v)
                              - 0.5 * Math.Pow(effs[i] - theta, 2) / v;
                    }
                    if (ll > bestLl)
                    {
                        bestLl = ll; bestTheta = theta; bestTau2 = tau2; bestG1 = g1; bestG2 = g2;
                    }
                }
            }

        res.theta = logScale ? Math.Exp(bestTheta) : bestTheta;
        res.tau2 = bestTau2;
        res.gamma1 = bestG1;
        res.gamma2 = bestG2;
        res.note = $"Step-function 3PSM fit (steps .05/.10); logL={bestLl:F2}; " +
                   "gamma=log-selection-odds vs significant stratum (<=0). Experimental.";
        return res;

        static double Weight(double e, double v, double tau2, double g1, double g2)
        {
            // one-sided p under current (theta-independent) z-score
            double sigma = Math.Sqrt(v + tau2);
            // NOTE: one-sided p depends on theta only through z; use plug-in z with theta=0
            // (selection acts on the OBSERVED significance of y_i vs 0, matching practice)
            double z = e / sigma;
            double p = 1 - Phi(z);
            return p <= 0.05 ? 1.0 : (p <= 0.10 ? Math.Exp(g1) : Math.Exp(g2));
        }
    }

    private static IEnumerable<double> TauGrid(List<double> vars)
    {
        yield return 0;
        for (int i = 1; i <= 12; i++) yield return 0.05 * i;         // 0.05..0.60
        yield return 0.8; yield return 1.0; yield return 1.5; yield return 2.0;
    }

    private static double Phi(double x) => Stats.NormalCdf(x);

    internal static (double theta, double tau2) ReDl(List<double> effs, List<double> vars)
    {
        var w = vars.Select(v => 1 / v).ToList();
        double sw = w.Sum();
        double fe = w.Zip(effs, (wi, e) => wi * e).Sum() / sw;
        double q = w.Zip(effs, (wi, e) => wi * Math.Pow(e - fe, 2)).Sum();
        int df = Math.Max(effs.Count - 1, 0);
        double c = sw - w.Sum(wi => wi * wi) / sw;
        double tau2 = (df > 0 && q > df && c > 0) ? Math.Max(0, (q - df) / c) : 0;
        var rw = vars.Select(v => 1 / (v + tau2)).ToList();
        double theta = rw.Zip(effs, (wi, e) => wi * e).Sum() / rw.Sum();
        return (theta, tau2);
    }
}
