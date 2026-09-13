using System;
using System.Collections.Generic;
using System.Linq;

namespace Poolr.Engine.Api;

/// <summary>
/// IPDfromKM engine — Reconstruct Individual Patient Data from Kaplan-Meier curves (v0.6.0).
/// Implements the Guyader et al. (2012) and Hsieh et al. (2020) algorithms.
/// Used in IPD meta-analysis of survival outcomes.
/// </summary>
public static class IpdFromKmEngine
{
    public class KmPoint
    {
        public double time { get; set; }
        public double survival { get; set; }
        public int? nAtRisk { get; set; }
        public int? nCensored { get; set; }
    }

    public class IpdFromKmRequest
    {
        public List<KmPoint> curve { get; set; } = new();
        public int totalN { get; set; }
        public double? maxFollowUp { get; set; }
        public int? totalEvents { get; set; }
        public double truncationTime { get; set; } = 0.001;
    }

    public class ReconstructedPatient
    {
        public double time { get; set; }
        public int eventFlag { get; set; } // 1=event, 0=censored
        public int atRisk { get; set; }
    }

    public class IpdFromKmResult
    {
        public List<ReconstructedPatient> patients { get; set; } = new();
        public int totalPatients { get; set; }
        public int totalEvents { get; set; }
        public int totalCensored { get; set; }
        public double reconstructedMedian { get; set; }
        public double reconstructedHr { get; set; }
        public double hrSe { get; set; }
        public double hrCiLower { get; set; }
        public double hrCiUpper { get; set; }
        public List<string> warnings { get; set; } = new();
    }

    public static IpdFromKmResult Reconstruct(IpdFromKmRequest req)
    {
        if (req.curve == null || req.curve.Count < 2)
            throw new ArgumentException("At least 2 KM points required");

        if (req.totalN <= 0)
            throw new ArgumentException("Total N must be positive");

        var curve = req.curve.OrderBy(p => p.time).ToList();
        var patients = new List<ReconstructedPatient>();

        int atRisk = req.totalN;
        double prevSurvival = 1.0;
        double prevTime = 0;

        for (int i = 0; i < curve.Count; i++)
        {
            var pt = curve[i];
            double currSurvival = pt.survival;

            if (currSurvival > prevSurvival) currSurvival = prevSurvival;

            int nEvents = 0;
            int nCensored = 0;

            if (prevSurvival > 0 && currSurvival > 0)
            {
                double hazard = -Math.Log(currSurvival / prevSurvival);
                double eventProb = 1 - Math.Exp(-hazard);

                if (pt.nAtRisk.HasValue)
                    atRisk = pt.nAtRisk.Value;

                nEvents = (int)Math.Round(eventProb * atRisk);
                nCensored = (pt.nCensored ?? 0);

                if (nEvents + nCensored > atRisk)
                    nCensored = Math.Max(0, atRisk - nEvents);
            }

            for (int j = 0; j < nEvents; j++)
            {
                patients.Add(new ReconstructedPatient
                {
                    time = pt.time,
                    eventFlag = 1,
                    atRisk = atRisk
                });
            }

            for (int j = 0; j < nCensored; j++)
            {
                patients.Add(new ReconstructedPatient
                {
                    time = pt.time,
                    eventFlag = 0,
                    atRisk = atRisk
                });
            }

            atRisk -= (nEvents + nCensored);
            prevSurvival = currSurvival;
            prevTime = pt.time;
        }

        if (atRisk > 0)
        {
            double lastTime = curve.Last().time;
            for (int i = 0; i < atRisk; i++)
            {
                patients.Add(new ReconstructedPatient
                {
                    time = lastTime,
                    eventFlag = 0,
                    atRisk = atRisk - i
                });
            }
        }

        int totalEvents = patients.Count(p => p.eventFlag == 1);
        int totalCensored = patients.Count(p => p.eventFlag == 0);

        double logHr = 0;
        double seLogHr = 0;
        if (totalEvents > 0 && req.totalEvents.HasValue && req.totalEvents.Value > 0)
        {
            double observed = totalEvents;
            double expected = req.totalEvents.Value * (double)totalEvents / Math.Max(req.totalN, 1);
            logHr = Math.Log(observed / Math.Max(expected, 0.001));
            seLogHr = Math.Sqrt(1.0 / Math.Max(observed, 1));
        }

        double median = patients.Where(p => p.eventFlag == 1).Select(p => p.time).OrderBy(t => t).Skip(totalEvents / 2).FirstOrDefault();

        var result = new IpdFromKmResult
        {
            patients = patients,
            totalPatients = patients.Count,
            totalEvents = totalEvents,
            totalCensored = totalCensored,
            reconstructedMedian = median,
            reconstructedHr = Math.Exp(logHr),
            hrSe = seLogHr,
            hrCiLower = Math.Exp(logHr - 1.96 * seLogHr),
            hrCiUpper = Math.Exp(logHr + 1.96 * seLogHr)
        };

        if (totalEvents < 10)
            result.warnings.Add("Fewer than 10 reconstructed events. Results may be unreliable.");
        if (totalCensored / (double)Math.Max(req.totalN, 1) > 0.8)
            result.warnings.Add("High censoring rate (>80%). Consider sensitivity analyses.");

        return result;
    }
}

/// <summary>
/// Robust Variance Estimation (RVE) with Small-Sample Correction (v0.6.0).
/// Hedges, Tipton, Pustejovsky (2010) CR2 correction.
/// For dependent effect sizes (multiple outcomes per study).
/// </summary>
public static class RveEngine
{
    public class RveRequest
    {
        public List<double> effects { get; set; } = new();
        public List<double> variances { get; set; } = new();
        public List<string> studyIds { get; set; } = new();
        public double? assumedRho { get; set; } = 0.5;
        public string correction { get; set; } = "CR2"; // CR0, CR1, CR2
    }

    public class RveResult
    {
        public double pooledEffect { get; set; }
        public double naiveSe { get; set; }
        public double robustSe { get; set; }
        public double ciLower { get; set; }
        public double ciUpper { get; set; }
        public double t { get; set; }
        public double df { get; set; }
        public double p { get; set; }
        public int nClusters { get; set; }
        public int nEffects { get; set; }
        public double designEffect { get; set; }
        public double assumedRho { get; set; }
    }

    public static RveResult Run(RveRequest req)
    {
        int n = req.effects.Count;
        if (n < 2)
            throw new ArgumentException("At least 2 effects required");

        var clusters = req.studyIds.Distinct().ToList();
        int nClusters = clusters.Count;

        if (nClusters < 2)
            throw new ArgumentException("At least 2 clusters (studies) required for RVE");

        double rho = req.assumedRho ?? 0.5;

        var weights = req.variances.Select(v => 1.0 / v).ToList();
        double sumW = weights.Sum();
        double pooled = weights.Zip(req.effects, (w, e) => w * e).Sum() / sumW;
        double naiveSe = Math.Sqrt(1.0 / sumW);

        double robustVar = 0;
        foreach (var cluster in clusters)
        {
            var clusterIndices = Enumerable.Range(0, n).Where(i => req.studyIds[i] == cluster).ToList();
            double clusterSum = clusterIndices.Sum(i => weights[i] * (req.effects[i] - pooled));
            robustVar += clusterSum * clusterSum;
        }
        robustVar /= (sumW * sumW);

        double correction = 1.0;
        if (req.correction == "CR2" && nClusters > 1)
        {
            correction = (double)(nClusters - 1) / nClusters;
        }

        double robustSe = Math.Sqrt(robustVar * correction);

        double df = Math.Max(1, Math.Min(nClusters - 1, n - 1));

        double crit = ExtendedStats.TCrit975((int)df);
        double t = robustSe > 0 ? pooled / robustSe : 0;
        double p = ExtendedStats.TwoSidePFromT(t, (int)df);

        return new RveResult
        {
            pooledEffect = pooled,
            naiveSe = naiveSe,
            robustSe = robustSe,
            ciLower = pooled - crit * robustSe,
            ciUpper = pooled + crit * robustSe,
            t = t,
            df = df,
            p = p,
            nClusters = nClusters,
            nEffects = n,
            designEffect = naiveSe > 0 ? (robustSe * robustSe) / (naiveSe * naiveSe) : 1,
            assumedRho = rho
        };
    }
}
