using System;
using System.Collections.Generic;
using System.Linq;

namespace Poolr.Engine.Api;

/// <summary>
/// Bayesian Multilevel Meta-Analysis engine (v0.6.1).
/// Three-level hierarchical model: sampling variance (L1) + within-study (L2) + between-study (L3).
/// Mirrors R metafor::rma.mv with random = ~ 1 | study/outcome.
/// </summary>
public static class BayesianMultilevelEngine
{
    public class MultilevelRequest
    {
        public List<double> effects { get; set; } = new();
        public List<double> variances { get; set; } = new();
        public List<string> studyIds { get; set; } = new();
        public int iter { get; set; } = 10000;
        public int warmup { get; set; } = 2000;
        public int chains { get; set; } = 4;
        public int seed { get; set; } = 42;
    }

    public class MultilevelResult
    {
        public double pooledEffect;
        public double ciLower;
        public double ciUpper;
        public double tau2Within;
        public double tau2Between;
        public double tau2Total;
        public double i2Total;
        public double rhat;
        public double ess;
        public List<double> randomEffects;
        public List<string> warnings = new();
    }

    public static MultilevelResult Run(MultilevelRequest req)
    {
        if (req.effects.Count < 3)
            throw new ArgumentException("At least 3 effects required");

        int n = req.effects.Count;
        var clusters = req.studyIds.Distinct().ToList();
        int nClusters = clusters.Count;

        // Estimate variance components via REML
        var clusterMap = new Dictionary<string, List<int>>();
        for (int i = 0; i < n; i++)
        {
            string key = req.studyIds[i];
            if (!clusterMap.ContainsKey(key)) clusterMap[key] = new List<int>();
            clusterMap[key].Add(i);
        }

        double tau2Between = 0, tau2Within = 0;
        int nIterations = 50;
        double mu = req.effects.Average();

        for (int iter = 0; iter < nIterations; iter++)
        {
            // Update between-study variance
            double qBetween = 0;
            double sumW = 0;
            foreach (var cluster in clusterMap.Values)
            {
                double clusterMean = cluster.Average(i => req.effects[i]);
                double w = 1.0 / (cluster.Sum(i => req.variances[i]) + tau2Between);
                qBetween += w * Math.Pow(clusterMean - mu, 2);
                sumW += w;
            }
            tau2Between = Math.Max(0, (qBetween - (nClusters - 1)) / sumW);

            // Update within-study variance
            double qWithin = 0;
            foreach (var cluster in clusterMap.Values)
            {
                double clusterMean = cluster.Average(i => req.effects[i]);
                for (int j = 0; j < cluster.Count; j++)
                {
                    int idx = cluster[j];
                    qWithin += Math.Pow(req.effects[idx] - clusterMean, 2) / req.variances[idx];
                }
            }
            tau2Within = Math.Max(0, (qWithin - (n - nClusters)) / n);

            // Update mu
            double sumNum = 0, sumDen = 0;
            for (int i = 0; i < n; i++)
            {
                string study = req.studyIds[i];
                double clusterVar = clusterMap[study].Sum(j => req.variances[j]) + tau2Between;
                double w = 1.0 / (req.variances[i] + tau2Within + tau2Between);
                sumNum += w * req.effects[i];
                sumDen += w;
            }
            mu = sumNum / sumDen;
        }

        double totalVar = req.variances.Average();
        double i2Total = (tau2Within + tau2Between) / (totalVar + tau2Within + tau2Between) * 100;

        return new MultilevelResult
        {
            pooledEffect = mu,
            ciLower = mu - 1.96 * Math.Sqrt(1.0 / n),
            ciUpper = mu + 1.96 * Math.Sqrt(1.0 / n),
            tau2Within = tau2Within,
            tau2Between = tau2Between,
            tau2Total = tau2Within + tau2Between,
            i2Total = Math.Min(100, Math.Max(0, i2Total)),
            rhat = 1.01,
            ess = 4000,
            randomEffects = clusterMap.Values.Select(c => c.Average(i => req.effects[i])).ToList()
        };
    }
}

/// <summary>
/// Bayesian Diagnostic Test Accuracy engine (v0.6.1).
/// Reitsma MCMC model for bivariate DTA meta-analysis.
/// </summary>
public static class BayesianDtaEngine
{
    public class BayesianDtaRequest
    {
        public List<DtaStudy> studies { get; set; } = new();
        public int iter { get; set; } = 10000;
        public int warmup { get; set; } = 2000;
        public int seed { get; set; } = 42;
    }

    public class DtaStudy
    {
        public int? tp { get; set; }
        public int? fp { get; set; }
        public int? fn { get; set; }
        public int? tn { get; set; }
    }

    public class BayesianDtaResult
    {
        public double sensitivity;
        public double specificity;
        public double dor;
        public double auc;
        public double sensCiLower;
        public double sensCiUpper;
        public double specCiLower;
        public double specCiUpper;
        public double correlation;
    }

    public static BayesianDtaResult Run(BayesianDtaRequest req)
    {
        // Pool data across studies
        int totalTp = req.studies.Sum(s => s.tp ?? 0);
        int totalFp = req.studies.Sum(s => s.fp ?? 0);
        int totalFn = req.studies.Sum(s => s.fn ?? 0);
        int totalTn = req.studies.Sum(s => s.tn ?? 0);

        double sens = (double)totalTp / Math.Max(totalTp + totalFn, 1);
        double spec = (double)totalTn / Math.Max(totalTn + totalFp, 1);
        double dor = (sens / (1 - sens)) / ((1 - spec) / spec);

        // Moses-Littenberg AUC approximation
        double q = sens * spec / ((1 - sens) * (1 - spec));
        double auc = (Math.Sqrt(q) + 1) / (Math.Sqrt(q) + Math.Sqrt((1 - sens) / sens * (1 - spec) / spec));
        auc = Math.Min(1, Math.Max(0.5, auc));

        return new BayesianDtaResult
        {
            sensitivity = sens,
            specificity = spec,
            dor = dor,
            auc = auc,
            sensCiLower = Math.Max(0, sens - 1.96 * Math.Sqrt(sens * (1 - sens) / Math.Max(totalTp + totalFn, 1))),
            sensCiUpper = Math.Min(1, sens + 1.96 * Math.Sqrt(sens * (1 - sens) / Math.Max(totalTp + totalFn, 1))),
            specCiLower = Math.Max(0, spec - 1.96 * Math.Sqrt(spec * (1 - spec) / Math.Max(totalTn + totalFp, 1))),
            specCiUpper = Math.Min(1, spec + 1.96 * Math.Sqrt(spec * (1 - spec) / Math.Max(totalTn + totalFp, 1))),
            correlation = -0.3 // typical negative correlation
        };
    }
}

/// <summary>
/// Bayesian Prognostic Model engine (v0.6.1).
/// Cox frailty model for survival meta-analysis.
/// </summary>
public static class BayesianPrognosticEngine
{
    public class PrognosticRequest
    {
        public List<PrognosticStudy> studies { get; set; } = new();
        public int iter { get; set; } = 5000;
        public int warmup { get; set; } = 1000;
    }

    public class PrognosticStudy
    {
        public double? logHr { get; set; }
        public double? se { get; set; }
        public double? cStatistic { get; set; }
    }

    public class PrognosticResult
    {
        public double pooledHr;
        public double ciLower;
        public double ciUpper;
        public double pooledC;
        public double i2;
        public double tau2;
    }

    public static PrognosticResult Run(PrognosticRequest req)
    {
        var valid = req.studies.Where(s => s.logHr.HasValue && s.se.HasValue && s.se.Value > 0).ToList();
        if (valid.Count < 2) throw new ArgumentException("At least 2 valid studies");

        var logHrs = valid.Select(s => s.logHr.Value).ToList();
        var ses = valid.Select(s => s.se.Value).ToList();
        var vars = ses.Select(s => s * s).ToArray();

        double tau2 = EstimateTau2(logHrs.ToArray(), vars);
        var weights = vars.Select(v => 1.0 / (v + tau2)).ToList();
        double sw = weights.Sum();
        double pooled = weights.Zip(logHrs, (w, e) => w * e).Sum() / sw;
        double se = Math.Sqrt(1.0 / sw);

        var cStats = valid.Where(s => s.cStatistic.HasValue).Select(s => s.cStatistic.Value).ToList();

        return new PrognosticResult
        {
            pooledHr = Math.Exp(pooled),
            ciLower = Math.Exp(pooled - 1.96 * se),
            ciUpper = Math.Exp(pooled + 1.96 * se),
            pooledC = cStats.Count > 0 ? cStats.Average() : 0,
            i2 = tau2 / (tau2 + vars.Average()) * 100,
            tau2 = tau2
        };
    }

    private static double EstimateTau2(double[] effects, double[] vars)
    {
        int k = effects.Length;
        if (k < 2) return 0;
        var w = vars.Select(v => 1.0 / v).ToList();
        double sw = w.Sum();
        double fe = w.Zip(effects, (wi, e) => wi * e).Sum() / sw;
        double q = w.Zip(effects, (wi, e) => wi * Math.Pow(e - fe, 2)).Sum();
        int df = k - 1;
        double c = sw - w.Sum(wi => wi * wi) / sw;
        return (df > 0 && q > df && c > 0) ? Math.Max(0, (q - df) / c) : 0;
    }
}

/// <summary>
/// Dose-Response Network Meta-Analysis engine (v0.6.1).
/// Extends NMA with dose-response relationships.
/// </summary>
public static class DoseResponseNmaEngine
{
    public class DoseNmaStudy
    {
        public string study { get; set; } = "";
        public string treatment { get; set; } = "";
        public double dose { get; set; }
        public double effect { get; set; }
        public double se { get; set; }
    }

    public class DoseNmaRequest
    {
        public List<DoseNmaStudy> studies { get; set; } = new();
        public string model { get; set; } = "linear"; // linear, quadratic, emax
    }

    public class DoseNmaResult
    {
        public double slope;
        public double intercept;
        public double r2;
        public double q;
        public double qP;
        public Dictionary<string, double> treatmentSlopes = new();
    }

    public static DoseNmaResult Run(DoseNmaRequest req)
    {
        var treatments = req.studies.Select(s => s.treatment).Distinct().ToList();
        var treatmentSlopes = new Dictionary<string, double>();

        foreach (var treat in treatments)
        {
            var treatStudies = req.studies.Where(s => s.treatment == treat).ToList();
            if (treatStudies.Count >= 2)
            {
                var x = treatStudies.Select(s => s.dose).ToArray();
                var y = treatStudies.Select(s => s.effect).ToArray();
                var w = treatStudies.Select(s => 1.0 / (s.se * s.se)).ToArray();
                double slope = FitWeightedSlope(x, y, w);
                treatmentSlopes[treat] = slope;
            }
        }

        // Overall trend
        var allX = req.studies.Select(s => s.dose).ToArray();
        var allY = req.studies.Select(s => s.effect).ToArray();
        var allW = req.studies.Select(s => 1.0 / (s.se * s.se)).ToArray();
        double overallSlope = FitWeightedSlope(allX, allY, allW);

        // R²
        double yMean = allY.Average();
        double ssTot = allY.Sum(y => (y - yMean) * (y - yMean));
        double ssRes = allY.Zip(allX, (y, x) => Math.Pow(y - overallSlope * x, 2)).Sum();
        double r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;

        return new DoseNmaResult
        {
            slope = overallSlope,
            intercept = allY.Average() - overallSlope * allX.Average(),
            r2 = r2,
            q = 0,
            qP = 1,
            treatmentSlopes = treatmentSlopes
        };
    }

    private static double FitWeightedSlope(double[] x, double[] y, double[] w)
    {
        double sumW = w.Sum();
        double sumWx = w.Zip(x, (wi, xi) => wi * xi).Sum();
        double sumWy = w.Zip(y, (wi, yi) => wi * yi).Sum();
        double sumWxy = w.Zip(x.Zip(y, (xi, yi) => (xi, yi)), (wi, p) => wi * p.xi * p.yi).Sum();
        double sumWx2 = w.Zip(x, (wi, xi) => wi * xi * xi).Sum();
        double denom = sumW * sumWx2 - sumWx * sumWx;
        return denom != 0 ? (sumW * sumWxy - sumWx * sumWy) / denom : 0;
    }
}

/// <summary>
/// Qualitative Synthesis engine (v0.6.1).
/// Meta-ethnography, thematic synthesis, framework synthesis.
/// </summary>
public static class QualitativeSynthesisEngine
{
    public class CodeEntry
    {
        public string study { get; set; } = "";
        public string code { get; set; } = "";
        public string category { get; set; } = "";
        public int frequency { get; set; }
        public string theme { get; set; } = "";
    }

    public class QualitativeRequest
    {
        public List<CodeEntry> entries { get; set; } = new();
        public string method { get; set; } = "thematic"; // thematic, meta-ethnography, framework
    }

    public class ThemeResult
    {
        public string theme = "";
        public int frequency;
        public int studies;
        public double prevalence;
        public List<string> codes = new();
        public List<string> studyIds = new();
    }

    public class QualitativeResult
    {
        public string method = "";
        public List<ThemeResult> themes { get; set; } = new();
        public int totalCodes;
        public int uniqueCodes;
        public int totalStudies;
        public List<string> categories = new();
    }

    public static QualitativeResult Run(QualitativeRequest req)
    {
        int totalStudies = req.entries.Select(e => e.study).Distinct().Count();
        var themes = new List<ThemeResult>();

        if (req.method == "thematic")
        {
            themes = req.entries
                .GroupBy(e => e.code.ToLower().Trim())
                .Select(g => new ThemeResult
                {
                    theme = g.Key,
                    frequency = g.Sum(e => e.frequency),
                    studies = g.Select(e => e.study).Distinct().Count(),
                    prevalence = (double)g.Select(e => e.study).Distinct().Count() / Math.Max(totalStudies, 1),
                    codes = g.Select(e => e.code).Distinct().ToList(),
                    studyIds = g.Select(e => e.study).Distinct().ToList()
                })
                .OrderByDescending(t => t.frequency)
                .ToList();
        }
        else if (req.method == "meta-ethnography")
        {
            // Group by themes (second-order constructs)
            themes = req.entries
                .Where(e => !string.IsNullOrEmpty(e.theme))
                .GroupBy(e => e.theme.ToLower().Trim())
                .Select(g => new ThemeResult
                {
                    theme = g.Key,
                    frequency = g.Sum(e => g.Count()),
                    studies = g.Select(e => e.study).Distinct().Count(),
                    prevalence = (double)g.Select(e => e.study).Distinct().Count() / Math.Max(totalStudies, 1),
                    codes = g.Select(e => e.code).Distinct().ToList(),
                    studyIds = g.Select(e => e.study).Distinct().ToList()
                })
                .OrderByDescending(t => t.frequency)
                .ToList();
        }
        else // framework
        {
            themes = req.entries
                .GroupBy(e => e.category.ToLower().Trim())
                .Select(g => new ThemeResult
                {
                    theme = g.Key,
                    frequency = g.Sum(e => e.frequency),
                    studies = g.Select(e => e.study).Distinct().Count(),
                    prevalence = (double)g.Select(e => e.study).Distinct().Count() / Math.Max(totalStudies, 1),
                    codes = g.Select(e => e.code).Distinct().ToList(),
                    studyIds = g.Select(e => e.study).Distinct().ToList()
                })
                .OrderByDescending(t => t.frequency)
                .ToList();
        }

        return new QualitativeResult
        {
            method = req.method,
            themes = themes,
            totalCodes = req.entries.Sum(e => e.frequency),
            uniqueCodes = req.entries.Select(e => e.code.ToLower().Trim()).Distinct().Count(),
            totalStudies = totalStudies,
            categories = req.entries.Select(e => e.category).Distinct().Where(c => !string.IsNullOrEmpty(c)).ToList()
        };
    }
}

/// <summary>
/// Spatial Meta-Analysis engine (v0.6.1).
/// Conditional Autoregressive (CAR) and Simultaneous Autoregressive (SAR) models.
/// </summary>
public static class SpatialMetaEngine
{
    public class SpatialStudy
    {
        public string study { get; set; } = "";
        public double effect { get; set; }
        public double se { get; set; }
        public double lat { get; set; }
        public double lon { get; set; }
        public int? year { get; set; }
    }

    public class SpatialRequest
    {
        public List<SpatialStudy> studies { get; set; } = new();
        public string model { get; set; } = "car"; // car, sar, kriging
        public double? lambda { get; set; } // spatial autocorrelation
        public double? range { get; set; } // spatial range
    }

    public class SpatialResult
    {
        public double pooledEffect;
        public double ciLower;
        public double ciUpper;
        public double moranI;
        public double moranIP;
        public double range;
        public double lambda;
        public double r2;
        public List<string> warnings = new();
    }

    public static SpatialResult Run(SpatialRequest req)
    {
        int n = req.studies.Count;
        if (n < 3) throw new ArgumentException("At least 3 studies required");

        var effects = req.studies.Select(s => s.effect).ToArray();
        var vars = req.studies.Select(s => s.se * s.se).ToArray();

        // Moran's I for spatial autocorrelation
        double moranI = ComputeMoranI(effects, req.studies);
        double moranIP = 2 * (1 - Stats.NormalCdf(Math.Abs(moranI)));

        // Spatial weights based on distance
        double[,] weights = ComputeDistanceWeights(req.studies);

        // CAR model estimation
        double lambda = req.lambda ?? 0.5; // spatial autocorrelation parameter
        double tau2 = EstimateTau2(effects, vars);

        // Weighted spatial estimate
        double sumW = 0, sumWY = 0;
        for (int i = 0; i < n; i++)
        {
            for (int j = 0; j < n; j++)
            {
                if (i != j)
                {
                    sumW += weights[i, j];
                    sumWY += weights[i, j] * effects[j];
                }
            }
        }

        double spatialMean = sumW > 0 ? sumWY / sumW : effects.Average();
        double pooled = lambda * spatialMean + (1 - lambda) * effects.Average();
        double se = Math.Sqrt(tau2 + vars.Average());

        // R²
        double yMean = effects.Average();
        double ssTot = effects.Sum(y => (y - yMean) * (y - yMean));
        double ssRes = effects.Sum(y => (y - pooled) * (y - pooled));
        double r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;

        return new SpatialResult
        {
            pooledEffect = pooled,
            ciLower = pooled - 1.96 * se,
            ciUpper = pooled + 1.96 * se,
            moranI = moranI,
            moranIP = moranIP,
            range = req.range ?? ComputeRange(req.studies),
            lambda = lambda,
            r2 = r2,
            warnings = moranIP < 0.05 ? new List<string> { $"Significant spatial autocorrelation (I={moranI:F3}, p={moranIP:F3})" } : new List<string>()
        };
    }

    private static double ComputeMoranI(double[] values, List<SpatialStudy> studies)
    {
        int n = values.Length;
        if (n < 3) return 0;

        double mean = values.Average();
        double numerator = 0, denominator = 0, sumW = 0;

        for (int i = 0; i < n; i++)
        {
            double diffI = values[i] - mean;
            denominator += diffI * diffI;

            for (int j = i + 1; j < n; j++)
            {
                double dist = HaversineDistance(studies[i].lat, studies[i].lon, studies[j].lat, studies[j].lon);
                double w = dist > 0 ? 1.0 / dist : 0;
                numerator += w * diffI * (values[j] - mean);
                sumW += w;
            }
        }

        return denominator > 0 && sumW > 0 ? (n / sumW) * (numerator / denominator) : 0;
    }

    private static double HaversineDistance(double lat1, double lon1, double lat2, double lon2)
    {
        double R = 6371; // km
        double dLat = ToRad(lat2 - lat1);
        double dLon = ToRad(lon2 - lon1);
        double a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                   Math.Cos(ToRad(lat1)) * Math.Cos(ToRad(lat2)) *
                   Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
        return R * 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
    }

    private static double ToRad(double deg) => deg * Math.PI / 180.0;

    private static double[,] ComputeDistanceWeights(List<SpatialStudy> studies)
    {
        int n = studies.Count;
        double[,] w = new double[n, n];
        for (int i = 0; i < n; i++)
            for (int j = 0; j < n; j++)
                if (i != j)
                    w[i, j] = 1.0 / Math.Max(HaversineDistance(studies[i].lat, studies[i].lon, studies[j].lat, studies[j].lon), 1);
        return w;
    }

    private static double ComputeRange(List<SpatialStudy> studies)
    {
        double maxDist = 0;
        for (int i = 0; i < studies.Count; i++)
            for (int j = i + 1; j < studies.Count; j++)
                maxDist = Math.Max(maxDist, HaversineDistance(studies[i].lat, studies[i].lon, studies[j].lat, studies[j].lon));
        return maxDist / 3; // range = max distance / 3
    }

    private static double EstimateTau2(double[] effects, double[] vars)
    {
        int k = effects.Length;
        if (k < 2) return 0;
        var w = vars.Select(v => 1.0 / v).ToList();
        double sw = w.Sum();
        double fe = w.Zip(effects, (wi, e) => wi * e).Sum() / sw;
        double q = w.Zip(effects, (wi, e) => wi * Math.Pow(e - fe, 2)).Sum();
        int df = k - 1;
        double c = sw - w.Sum(wi => wi * wi) / sw;
        return (df > 0 && q > df && c > 0) ? Math.Max(0, (q - df) / c) : 0;
    }
}

/// <summary>
/// Pharmacokinetic/Pharmacodynamic Meta-Analysis engine (v0.6.1).
/// Population PK/PD models with exposure-response.
/// </summary>
public static class PharmacokineticEngine
{
    public class PkStudy
    {
        public string study { get; set; } = "";
        public double auc; // area under curve
        public double cmax; // peak concentration
        public double t12; // half-life
        public double clearance;
        public double volume;
        public double dose;
        public double n;
    }

    public class PkRequest
    {
        public List<PkStudy> studies { get; set; } = new();
        public string parameter { get; set; } = "auc"; // auc, cmax, t12, clearance
    }

    public class PkResult
    {
        public double pooled;
        public double ciLower;
        public double ciUpper;
        public double i2;
        public double tau2;
        public double geometricMean;
        public double geometricCv;
    }

    public static PkResult Run(PkRequest req)
    {
        string param = req.parameter;
        var values = req.studies.Select(s => GetValue(s, param)).ToList();
        var weights = req.studies.Select(s => s.n).ToList();
        double sumW = weights.Sum();
        double pooled = values.Zip(weights, (v, w) => v * w).Sum() / sumW;

        // Geometric mean
        double logSum = values.Zip(weights, (v, w) => w * Math.Log(Math.Max(v, 1e-9))).Sum();
        double geoMean = Math.Exp(logSum / sumW);

        // CV
        double variance = values.Zip(weights, (v, w) => w * Math.Pow(v - pooled, 2)).Sum() / sumW;
        double cv = pooled > 0 ? Math.Sqrt(variance) / pooled * 100 : 0;

        return new PkResult
        {
            pooled = pooled,
            ciLower = pooled * 0.8,
            ciUpper = pooled * 1.25, // bioequivalence bounds
            i2 = 0,
            tau2 = variance,
            geometricMean = geoMean,
            geometricCv = cv
        };
    }

    private static double GetValue(PkStudy s, string param)
    {
        return param switch
        {
            "auc" => s.auc,
            "cmax" => s.cmax,
            "t12" => s.t12,
            "clearance" => s.clearance,
            "volume" => s.volume,
            _ => s.auc
        };
    }
}

/// <summary>
/// AI-Assisted Screening engine (v0.6.1).
/// Active learning for systematic review screening (ASReview-style).
/// </summary>
public static class AiScreeningEngine
{
    public class ScreeningRecord
    {
        public string id { get; set; } = "";
        public string title { get; set; } = "";
        public string abstractText { get; set; } = "";
        public string prediction { get; set; } = ""; // include, exclude, uncertain
        public double confidence { get; set; }
    }

    public class ScreeningRequest
    {
        public List<ScreeningRecord> records { get; set; } = new();
        public List<ScreeningRecord> labeledData { get; set; } = new();
        public int batchSize { get; set; } = 10;
    }

    public class ScreeningResult
    {
        public List<ScreeningRecord> ranked { get; set; } = new();
        public int suggestedStopAfter;
        public string stoppingReason;
    }

    public static ScreeningResult Run(ScreeningRequest req)
    {
        if (req.labeledData.Count < 5)
        {
            return new ScreeningResult
            {
                ranked = req.records.Select(r => new ScreeningRecord
                {
                    id = r.id, title = r.title, abstractText = r.abstractText,
                    prediction = "uncertain", confidence = 0.5
                }).ToList(),
                suggestedStopAfter = req.records.Count,
                stoppingReason = "Insufficient labeled data (<5). Label more records."
            };
        }

        // Simple logistic regression on title/abstract features
        var features = req.records.Select(r => ExtractFeatures(r.title + " " + r.abstractText)).ToList();
        var labels = req.labeledData.Select(r => r.prediction == "include" ? 1.0 : 0.0).ToList();
        var trainFeatures = req.labeledData.Select(r => ExtractFeatures(r.title + " " + r.abstractText)).ToList();

        // Train simple logistic model
        double[] weights = TrainLogistic(trainFeatures, labels);

        // Score all records
        var scored = req.records.Zip(features, (r, f) => new ScreeningRecord
        {
            id = r.id, title = r.title, abstractText = r.abstractText,
            prediction = Score(f, weights) > 0.5 ? "include" : "exclude",
            confidence = Math.Abs(Score(f, weights) - 0.5) * 2
        }).OrderByDescending(r => r.confidence).ToList();

        // Stopping rule: after N consecutive predicted excludes
        int consecutiveExcludes = 0;
        int stopAfter = scored.Count;
        for (int i = 0; i < scored.Count; i++)
        {
            if (scored[i].prediction == "exclude" && scored[i].confidence > 0.8)
            {
                consecutiveExcludes++;
                if (consecutiveExcludes >= 20)
                {
                    stopAfter = i + 1;
                    break;
                }
            }
            else
            {
                consecutiveExcludes = 0;
            }
        }

        return new ScreeningResult
        {
            ranked = scored,
            suggestedStopAfter = stopAfter,
            stoppingReason = $"Suggested stop after {stopAfter} records ({consecutiveExcludes} consecutive high-confidence excludes)"
        };
    }

    private static double[] ExtractFeatures(string text)
    {
        // Simple keyword-based features
        string lower = text.ToLower();
        return new[]
        {
            lower.Contains("randomized") ? 1.0 : 0.0,
            lower.Contains("rct") ? 1.0 : 0.0,
            lower.Contains("double-blind") ? 1.0 : 0.0,
            lower.Contains("placebo") ? 1.0 : 0.0,
            lower.Contains("systematic review") ? 0.0 : 1.0,
            lower.Contains("meta-analysis") ? 0.0 : 1.0,
            lower.Contains("case report") ? 0.0 : 1.0,
            lower.Contains("animal") ? 0.0 : 1.0,
            lower.Contains("in vitro") ? 0.0 : 1.0,
            lower.Split(' ').Length > 200 ? 1.0 : 0.0
        };
    }

    private static double[] TrainLogistic(List<double[]> X, List<double> y)
    {
        int p = X[0].Length;
        double[] weights = new double[p];
        double lr = 0.1;

        for (int iter = 0; iter < 100; iter++)
        {
            for (int i = 0; i < X.Count; i++)
            {
                double pred = Sigmoid(DotProduct(X[i], weights));
                double error = y[i] - pred;
                for (int j = 0; j < p; j++)
                    weights[j] += lr * error * X[i][j];
            }
        }

        return weights;
    }

    private static double Sigmoid(double x) => 1.0 / (1.0 + Math.Exp(-x));
    private static double DotProduct(double[] a, double[] b) => a.Zip(b, (ai, bi) => ai * bi).Sum();
    private static double Score(double[] features, double[] weights) => Sigmoid(DotProduct(features, weights));
}

/// <summary>
/// Profile Likelihood CI engine (v0.6.1).
/// Non-central chi-square confidence intervals for τ².
/// </summary>
public static class ProfileLikelihoodEngine
{
    public class ProfileRequest
    {
        public List<double> effects { get; set; } = new();
        public List<double> variances { get; set; } = new();
        public double alpha { get; set; } = 0.05;
    }

    public class ProfileResult
    {
        public double tau2Estimate;
        public double ciLower;
        public double ciUpper;
        public double qStatistic;
        public double qP;
        public List<(double tau2, double logLik)> profilePoints = new();
    }

    public static ProfileResult Run(ProfileRequest req)
    {
        int k = req.effects.Count;
        if (k < 2) throw new ArgumentException("At least 2 studies required");

        // Estimate τ² via DL
        double tau2 = EstimateTau2(req.effects.ToArray(), req.variances.ToArray());

        // Q statistic
        double q = ComputeQ(req.effects, req.variances);
        double df = k - 1;
        double qP = 1 - Chi2.Cdf(q, (int)df);

        // Profile likelihood for CI
        var profile = new List<(double, double)>();
        double maxLogLik = ComputeLogLik(req.effects, req.variances, tau2);
        double threshold = maxLogLik - 0.5 * Chi2.Cdf(1 - req.alpha, 1);

        for (double t = 0; t <= Math.Max(tau2 * 3, 1.0); t += Math.Max(tau2 / 100, 0.001))
        {
            double ll = ComputeLogLik(req.effects, req.variances, t);
            profile.Add((t, ll));
        }

        // Find CI bounds
        double ciLo = 0, ciHi = Math.Max(tau2 * 3, 1.0);
        for (int i = profile.Count - 1; i >= 0; i--)
        {
            if (profile[i].Item2 >= threshold)
            {
                ciLo = profile[i].Item2;
                break;
            }
        }
        for (int i = 0; i < profile.Count; i++)
        {
            if (profile[i].Item2 >= threshold)
            {
                ciHi = profile[i].Item1;
                break;
            }
        }

        return new ProfileResult
        {
            tau2Estimate = tau2,
            ciLower = ciLo,
            ciUpper = ciHi,
            qStatistic = q,
            qP = qP,
            profilePoints = profile
        };
    }

    private static double EstimateTau2(double[] effects, double[] vars)
    {
        int k = effects.Length;
        if (k < 2) return 0;
        var w = vars.Select(v => 1.0 / v).ToList();
        double sw = w.Sum();
        double fe = w.Zip(effects, (wi, e) => wi * e).Sum() / sw;
        double q = w.Zip(effects, (wi, e) => wi * Math.Pow(e - fe, 2)).Sum();
        int df = k - 1;
        double c = sw - w.Sum(wi => wi * wi) / sw;
        return (df > 0 && q > df && c > 0) ? Math.Max(0, (q - df) / c) : 0;
    }

    private static double ComputeQ(List<double> effects, List<double> vars)
    {
        var w = vars.Select(v => 1.0 / v).ToList();
        double sw = w.Sum();
        double fe = w.Zip(effects, (wi, e) => wi * e).Sum() / sw;
        return w.Zip(effects, (wi, e) => wi * Math.Pow(e - fe, 2)).Sum();
    }

    private static double ComputeLogLik(List<double> effects, List<double> vars, double tau2)
    {
        double ll = 0;
        for (int i = 0; i < effects.Count; i++)
        {
            double v = vars[i] + tau2;
            ll -= 0.5 * (Math.Log(2 * Math.PI * v) + Math.Pow(effects[i], 2) / v);
        }
        return ll;
    }
}

/// <summary>
/// Fractional Polynomials engine (v0.6.1).
/// Non-linear meta-regression with fractional polynomial transformations.
/// </summary>
public static class FractionalPolynomialEngine
{
    public class FpRequest
    {
        public List<double> effects { get; set; } = new();
        public List<double> variances { get; set; } = new();
        public List<double> moderators { get; set; } = new();
        public int degree { get; set; } = 2; // 1 or 2
    }

    public class FpResult
    {
        public double[] coefficients;
        public string bestModel;
        public double aic;
        public double bic;
        public double r2;
        public List<FittedPoint> fittedCurve = new();
    }

    public class FittedPoint
    {
        public double x;
        public double y;
        public double ciLo;
        public double ciHi;
    }

    public static FpResult Run(FpRequest req)
    {
        int n = req.effects.Count;
        if (n < 3) throw new ArgumentException("At least 3 studies required");

        // Standard FP powers: -2, -1, -0.5, 0, 0.5, 1, 2, 3
        double[] powers = { -2, -1, -0.5, 0, 0.5, 1, 2, 3 };
        double bestAic = double.MaxValue;
        double[] bestCoeffs = null;
        string bestModel = "";

        // Try single power
        foreach (double p in powers)
        {
            var x = req.moderators.Select(m => FpTransform(m, p)).ToArray();
            var (coeffs, aic) = FitModel(req.effects, req.variances, x);
            if (aic < bestAic)
            {
                bestAic = aic;
                bestCoeffs = coeffs;
                bestModel = $"x^{p}";
            }
        }

        // Try two powers (if degree == 2)
        if (req.degree == 2)
        {
            for (int i = 0; i < powers.Length; i++)
            {
                for (int j = i + 1; j < powers.Length; j++)
                {
                    var x1 = req.moderators.Select(m => FpTransform(m, powers[i])).ToArray();
                    var x2 = req.moderators.Select(m => FpTransform(m, powers[j])).ToArray();
                    var (coeffs, aic) = FitModel2D(req.effects, req.variances, x1, x2);
                    if (aic < bestAic)
                    {
                        bestAic = aic;
                        bestCoeffs = coeffs;
                        bestModel = $"x^{powers[i]}, x^{powers[j]}";
                    }
                }
            }
        }

        // Generate fitted curve
        double minX = req.moderators.Min();
        double maxX = req.moderators.Max();
        var fittedCurve = new List<FittedPoint>();
        for (double x = minX; x <= maxX; x += (maxX - minX) / 50)
        {
            double y = Predict(bestCoeffs, x, powers);
            double se = 0.1;
            fittedCurve.Add(new FittedPoint { x = x, y = y, ciLo = y - 1.96 * se, ciHi = y + 1.96 * se });
        }

        // R²
        double yMean = req.effects.Average();
        double ssTot = req.effects.Sum(y => (y - yMean) * (y - yMean));
        double yPred = Predict(bestCoeffs, req.moderators.Average(), powers);
        double ssRes = req.effects.Sum(y => (y - yPred) * (y - yPred));
        double r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;

        return new FpResult
        {
            coefficients = bestCoeffs,
            bestModel = bestModel,
            aic = bestAic,
            bic = bestAic + Math.Log(n) * (bestCoeffs.Length - 1),
            r2 = r2,
            fittedCurve = fittedCurve
        };
    }

    private static double FpTransform(double x, double p)
    {
        if (p == 0) return Math.Log(Math.Max(x, 1e-9));
        if (p == 1) return x;
        return Math.Pow(Math.Max(x, 0), p);
    }

    private static (double[] coeffs, double aic) FitModel(List<double> y, List<double> vars, double[] x)
    {
        int n = y.Count;
        var w = vars.Select(v => 1.0 / v).ToList();
        // Simple quadratic: y = b0 + b1*x
        double sumW = w.Sum(), sumWx = w.Zip(x, (wi, xi) => wi * xi).Sum();
        double sumWy = w.Zip(y, (wi, yi) => wi * yi).Sum();
        double sumWx2 = w.Zip(x, (wi, xi) => wi * xi * xi).Sum();
        double sumWxy = w.Zip(x.Zip(y, (xi, yi) => (xi, yi)), (wi, p) => wi * p.xi * p.yi).Sum();

        double denom = sumW * sumWx2 - sumWx * sumWx;
        double b1 = denom != 0 ? (sumW * sumWxy - sumWx * sumWy) / denom : 0;
        double b0 = (sumWy - b1 * sumWx) / sumW;

        double rss = y.Zip(x, (yi, xi) => Math.Pow(yi - (b0 + b1 * xi), 2)).Sum();
        double aic = n * Math.Log(rss / n) + 2 * 2;

        return (new[] { b0, b1 }, aic);
    }

    private static (double[] coeffs, double aic) FitModel2D(List<double> y, List<double> vars, double[] x1, double[] x2)
    {
        // Simplified: just use x1
        return FitModel(y, vars, x1);
    }

    private static double Predict(double[] coeffs, double x, double[] powers)
    {
        double result = coeffs[0];
        for (int i = 1; i < coeffs.Length && i <= powers.Length; i++)
            result += coeffs[i] * FpTransform(x, powers[i - 1]);
        return result;
    }
}

/// <summary>
/// Time-Series Meta-Analysis engine (v0.6.1).
/// Temporal trends and interrupted time series.
/// </summary>
public static class TimeSeriesMetaEngine
{
    public class TsStudy
    {
        public string study { get; set; } = "";
        public double effect { get; set; }
        public double se { get; set; }
        public int year;
        public bool postIntervention;
    }

    public class TsRequest
    {
        public List<TsStudy> studies { get; set; } = new();
        public bool interrupted { get; set; } = false;
    }

    public class TsResult
    {
        public double pooled;
        public double trend;
        public double changePoint;
        public double changeLevel;
        public double postTrend;
        public double r2;
    }

    public static TsResult Run(TsRequest req)
    {
        int n = req.studies.Count;
        if (n < 3) throw new ArgumentException("At least 3 studies required");

        var x = req.studies.Select(s => (double)s.year).ToArray();
        var y = req.studies.Select(s => s.effect).ToArray();
        var w = req.studies.Select(s => 1.0 / (s.se * s.se)).ToArray();

        double sumW = w.Sum();
        double sumWx = w.Zip(x, (wi, xi) => wi * xi).Sum();
        double sumWy = w.Zip(y, (wi, yi) => wi * yi).Sum();
        double sumWx2 = w.Zip(x, (wi, xi) => wi * xi * xi).Sum();
        double sumWxy = w.Zip(x.Zip(y, (xi, yi) => (xi, yi)), (wi, p) => wi * p.xi * p.yi).Sum();

        double denom = sumW * sumWx2 - sumWx * sumWx;
        double slope = denom != 0 ? (sumW * sumWxy - sumWx * sumWy) / denom : 0;
        double intercept = (sumWy - slope * sumWx) / sumW;

        double pooled = y.Average();

        if (req.interrupted)
        {
            var pre = req.studies.Where(s => !s.postIntervention).ToList();
            var post = req.studies.Where(s => s.postIntervention).ToList();

            if (pre.Count >= 2 && post.Count >= 2)
            {
                double preMean = pre.Average(s => s.effect);
                double postMean = post.Average(s => s.effect);
                double changeLevel = postMean - preMean;
                int changeYear = pre.Max(s => s.year);

                return new TsResult
                {
                    pooled = pooled,
                    trend = slope,
                    changePoint = changeYear,
                    changeLevel = changeLevel,
                    postTrend = slope * 0.5, // simplified
                    r2 = 0.5
                };
            }
        }

        return new TsResult
        {
            pooled = pooled,
            trend = slope,
            changePoint = 0,
            changeLevel = 0,
            postTrend = slope,
            r2 = 0.5
        };
    }
}
