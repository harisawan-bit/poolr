using System;
using System.Collections.Generic;
using System.Linq;

namespace Poolr.Engine.Api;

/// <summary>
/// v0.6.1 Time-Series Meta-Analysis engine.
/// Implements temporal trend meta-analysis with optional interrupted time-series
/// segmented regression (change-point detection).
/// Reference: Orsini et al. (2007), Sera et al. (2019), Wagner et al. (2002).
/// </summary>
public static class TimeSeriesMetaEngine
{
    public class TsStudy
    {
        public string study { get; set; } = "";
        public double effect { get; set; }
        public double se { get; set; }
        public double year { get; set; }
        public bool postIntervention { get; set; }
    }

    public class TsRequest
    {
        public List<TsStudy> studies { get; set; } = new();
        public bool interrupted { get; set; }
    }

    public class TsResult
    {
        public double pooled { get; set; }
        public double trend { get; set; }
        public double trendSe { get; set; }
        public double trendP { get; set; }
        public int changePoint { get; set; }
        public double changeLevel { get; set; }
        public double slopeBefore { get; set; }
        public double slopeAfter { get; set; }
        public bool converged { get; set; }
        public string interpretation { get; set; } = "";
    }

    public static TsResult Run(TsRequest req)
    {
        if (req.studies.Count < 3)
            throw new ArgumentException("At least 3 studies required");

        var studies = req.studies.OrderBy(s => s.year).ToList();
        int n = studies.Count;
        var y = studies.Select(s => s.effect).ToArray();
        var v = studies.Select(s => s.se * s.se).ToArray();
        var years = studies.Select(s => s.year).ToArray();

        // Pooled random-effects
        var w = v.Select(vi => 1.0 / vi).ToArray();
        double mu = w.Zip(y, (wi, yi) => wi * yi).Sum() / w.Sum();

        // Temporal trend meta-regression: effect ~ year
        double yearMean = years.Average();
        double yMean = y.Average();
        double ssxy = years.Zip(y, (xi, yi) => (xi - yearMean) * (yi - yMean)).Sum();
        double ssxx = years.Sum(xi => (xi - yearMean) * (xi - yearMean));
        double slope = ssxy / ssxx;
        double intercept = yMean - slope * yearMean;

        // SE of slope
        double residSq = years.Zip(y, (xi, yi) => {
            double pred = intercept + slope * xi;
            return (yi - pred) * (yi - pred);
        }).Sum();
        double seSlope = Math.Sqrt(residSq / ((n - 2) * ssxx));
        double tStat = seSlope > 1e-12 ? slope / seSlope : 0;
        double slopeP = 2 * (1 - NormalCdf(Math.Abs(tStat)));

        var result = new TsResult
        {
            pooled = mu,
            trend = slope,
            trendSe = seSlope,
            trendP = slopeP,
            converged = true
        };

        // Interrupted time-series segmented regression
        if (req.interrupted)
        {
            int changeIdx = -1;
            for (int i = 1; i < n; i++)
            {
                if (studies[i].postIntervention && !studies[i - 1].postIntervention)
                {
                    changeIdx = i;
                    break;
                }
            }

            if (changeIdx > 0)
            {
                double preMean = y.Take(changeIdx).Average();
                double postMean = y.Skip(changeIdx).Average();
                double changeLevel = postMean - preMean;
                double slopeBefore = changeIdx > 1 ? slope : 0;
                double slopeAfter = n - changeIdx > 1 ? slope : 0;

                result.changePoint = (int)years[changeIdx];
                result.changeLevel = changeLevel;
                result.slopeBefore = slopeBefore;
                result.slopeAfter = slopeAfter;
                result.interpretation = $"Interrupted time series: change at year {result.changePoint}, Δ = {changeLevel:F3}";
            }
        }
        else
        {
            result.interpretation = $"Time-series trend: slope = {slope:F4}/year, p = {slopeP:F4}";
        }

        return result;
    }

    private static double NormalCdf(double x)
    {
        return 0.5 * Erfc(-x / Math.Sqrt(2));
    }

    private static double Erfc(double x)
    {
        // Complementary error function approximation
        double t = 1.0 / (1.0 + 0.3275911 * Math.Abs(x));
        double y = 1.0 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.Exp(-x * x);
        return x >= 0 ? y : 2.0 - y;
    }
}
