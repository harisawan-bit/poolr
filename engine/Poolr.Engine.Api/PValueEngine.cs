using System;
using System.Collections.Generic;
using System.Linq;

namespace Poolr.Engine.Api;

/// <summary>
/// P-Value Combination Methods engine (v0.6.0).
/// Implements multiple methods for combining p-values from independent or dependent tests.
/// </summary>
public static class PValueCombinationEngine
{
    public class PValueRequest
    {
        public List<double> pValues { get; set; } = new();
        public List<double>? weights { get; set; }
        public string method { get; set; } = "fisher";
        public double? assumedRho { get; set; } = 0.5;
    }

    public class PValueResult
    {
        public string method { get; set; } = "";
        public double combinedP { get; set; }
        public double testStatistic { get; set; }
        public double? degreesOfFreedom { get; set; }
        public int nStudies { get; set; }
    }

    public static PValueResult Combine(PValueRequest req)
    {
        if (req.pValues == null || req.pValues.Count < 2)
            throw new ArgumentException("At least 2 p-values required");

        int k = req.pValues.Count;
        var validPs = req.pValues.Where(p => p > 0 && p <= 1).ToList();

        if (validPs.Count < 2)
            throw new ArgumentException("At least 2 valid p-values required");

        double combinedP;
        double testStat;
        double? df = null;

        switch (req.method.ToLowerInvariant())
        {
            case "fisher":
                testStat = -2 * validPs.Sum(p => Math.Log(p));
                df = 2.0 * validPs.Count;
                combinedP = 1 - Chi2.Cdf(testStat, validPs.Count * 2);
                break;

            case "stouffer":
                var zScores = validPs.Select(p => NormalQuantile(1 - p)).ToList();
                testStat = zScores.Sum() / Math.Sqrt(validPs.Count);
                combinedP = 1 - Stats.NormalCdf(testStat);
                break;

            case "tippett":
                double minP = validPs.Min();
                testStat = minP;
                combinedP = 1 - Math.Pow(1 - minP, validPs.Count);
                break;

            case "edgington":
                testStat = validPs.Sum(p => p - 0.5);
                double n = validPs.Count;
                combinedP = 1 - NormalCdfEdgington(testStat, n);
                break;

            default:
                throw new ArgumentException($"Unknown method: {req.method}");
        }

        combinedP = Math.Max(0, Math.Min(1, combinedP));

        return new PValueResult
        {
            method = req.method,
            combinedP = combinedP,
            testStatistic = testStat,
            degreesOfFreedom = df,
            nStudies = validPs.Count
        };
    }

    private static double NormalQuantile(double p)
    {
        if (p <= 0) return double.NegativeInfinity;
        if (p >= 1) return double.PositiveInfinity;
        if (p == 0.5) return 0;

        double[] c = { -7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00 };
        double[] d = { 7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00 };

        double pLow = 0.02425;
        double q;

        if (p < pLow)
        {
            q = Math.Sqrt(-2 * Math.Log(p));
            return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
                   ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
        }
        if (p < 1 - pLow)
        {
            q = p - 0.5;
            double r = q * q;
            return q * (((((-3.969683028665376e+01 * r + 2.209460984245205e+02) * r - 2.759285104469687e+02) * r + 1.383577518672690e+02) * r - 3.066479806614716e+01) * r + 2.506628277459239e+00) /
                   (((((-5.447609879822406e+01 * r + 1.615858368580409e+02) * r - 1.556989798598866e+02) * r + 6.680131188771972e+01) * r - 1.328068155288572e+01) * r + 1);
        }
        q = Math.Sqrt(-2 * Math.Log(1 - p));
        return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
                ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }

    private static double NormalCdfEdgington(double s, double n)
    {
        double var = n / 12.0;
        double z = s / Math.Sqrt(var);
        return Stats.NormalCdf(z);
    }
}
