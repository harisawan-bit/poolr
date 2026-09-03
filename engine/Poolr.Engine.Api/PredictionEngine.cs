using System;
using System.Collections.Generic;
using System.Linq;

namespace Poolr.Engine.Api;

/// <summary>
/// Prediction intervals, model averaging, and influence diagnostics (v0.5.7).
/// Extends the existing meta-analysis results with additional outputs.
/// </summary>
public static class PredictionEngine
{
    public class PredictionRequest
    {
        public double pooledEffect { get; set; }
        public double se { get; set; }
        public double tau2 { get; set; }
        public int k { get; set; }
        public bool logScale { get; set; }
    }

    public class PredictionResult
    {
        public double piLower { get; set; }
        public double piUpper { get; set; }
        public double piT { get; set; }
        public int piDf { get; set; }
    }

    public class ModelAverageRequest
    {
        public List<double> effects { get; set; } = new();
        public List<double> variances { get; set; } = new();
    }

    public class ModelWeight
    {
        public string method { get; set; } = "";
        public double tau2 { get; set; }
        public double aicc { get; set; }
        public double weight { get; set; }
        public double pooledEffect { get; set; }
    }

    public class ModelAverageResult
    {
        public double pooledEffect { get; set; }
        public double se { get; set; }
        public double ciLower { get; set; }
        public double ciUpper { get; set; }
        public List<ModelWeight> modelWeights { get; set; } = new();
    }

    public static PredictionResult ComputePredictionInterval(PredictionRequest req)
    {
        if (req.k < 2) return new PredictionResult { piLower = req.pooledEffect, piUpper = req.pooledEffect };

        int df = req.k - 2;
        if (df < 1) df = 1;

        double tVal = ExtendedStats.TCrit975(df);
        double predVar = req.tau2 + req.se * req.se;
        double predSe = Math.Sqrt(Math.Max(predVar, 0));

        double piLower = req.pooledEffect - tVal * predSe;
        double piUpper = req.pooledEffect + tVal * predSe;

        if (req.logScale)
        {
            piLower = Math.Exp(piLower);
            piUpper = Math.Exp(piUpper);
        }

        return new PredictionResult
        {
            piLower = piLower,
            piUpper = piUpper,
            piT = tVal,
            piDf = df
        };
    }

    public static ModelAverageResult RunModelAveraging(ModelAverageRequest req)
    {
        if (req.effects.Count < 2) throw new ArgumentException("At least 2 studies required");

        string[] methods = { "DL", "REML", "PM", "HS", "ML", "EB" };
        var results = new List<ModelWeight>();

        double logN = Math.Log(req.effects.Count);

        foreach (var method in methods)
        {
            double tau2 = EstimateTau2ByMethod(req.effects, req.variances, method);
            var weights = req.variances.Select(v => 1.0 / (v + tau2)).ToList();
            double sw = weights.Sum();
            double pooled = weights.Zip(req.effects, (w, e) => w * e).Sum() / sw;
            double aic = logN * (req.effects.Count - 1) - 2 * LogLikelihood(req.effects, req.variances, tau2);

            results.Add(new ModelWeight
            {
                method = method,
                tau2 = tau2,
                aicc = aic,
                weight = 0,
                pooledEffect = pooled
            });
        }

        // Akaike weights
        double minAic = results.Min(r => r.aicc);
        var deltaAic = results.Select(r => r.aicc - minAic).ToList();
        var relLik = deltaAic.Select(d => Math.Exp(-0.5 * d)).ToList();
        double sumLik = relLik.Sum();

        for (int i = 0; i < results.Count; i++)
            results[i].weight = relLik[i] / sumLik;

        // Weighted average
        double pooledEffect = results.Sum(r => r.weight * r.pooledEffect);
        double betweenVar = results.Sum(r => r.weight * Math.Pow(r.pooledEffect - pooledEffect, 2));
        double withinVar = 1.0 / req.variances.Select((v, i) => 1.0 / (v + results[0].tau2)).Sum();
        double totalVar = betweenVar + withinVar;
        double se = Math.Sqrt(Math.Max(totalVar, 0));

        return new ModelAverageResult
        {
            pooledEffect = pooledEffect,
            se = se,
            ciLower = pooledEffect - 1.96 * se,
            ciUpper = pooledEffect + 1.96 * se,
            modelWeights = results
        };
    }

    private static double EstimateTau2ByMethod(List<double> effects, List<double> variances, string method)
    {
        int k = effects.Count;
        if (k < 2) return 0;

        var w = variances.Select(v => 1.0 / v).ToList();
        double sw = w.Sum();
        double fe = w.Zip(effects, (wi, e) => wi * e).Sum() / sw;
        double q = w.Zip(effects, (wi, e) => wi * Math.Pow(e - fe, 2)).Sum();
        int df = k - 1;

        return method switch
        {
            "DL" => (df > 0 && q > df) ? Math.Max(0, (q - df) / (sw - w.Sum(wi => wi * wi) / sw)) : 0,
            "REML" => Math.Max(0, (q - df) / (sw - w.Sum(wi => wi * wi) / sw)),
            "PM" => PauleMandelTau2(effects, variances),
            "HS" => Math.Max(0, effects.Average() - 1.0 / sw),
            "ML" => Math.Max(0, (q - df) / sw),
            "EB" => Math.Max(0, (q - df) / (sw + w.Sum(wi => wi * wi) / sw)),
            _ => 0
        };
    }

    private static double PauleMandelTau2(List<double> effects, List<double> variances)
    {
        int k = effects.Count;
        if (k < 2) return 0;
        double target = k - 1;
        double Q(double t)
        {
            var w = variances.Select(v => 1.0 / (v + t)).ToList();
            double sw = w.Sum();
            double pooled = w.Zip(effects, (wi, e) => wi * e).Sum() / sw;
            return w.Zip(effects, (wi, e) => wi * Math.Pow(e - pooled, 2)).Sum();
        }
        double lo = 0, hi = 10;
        for (int i = 0; i < 50; i++)
        {
            double mid = (lo + hi) / 2;
            if (Q(mid) > target) lo = mid; else hi = mid;
        }
        return Math.Max(0, (lo + hi) / 2);
    }

    private static double LogLikelihood(List<double> effects, List<double> variances, double tau2)
    {
        double ll = 0;
        for (int i = 0; i < effects.Count; i++)
        {
            double v = variances[i] + tau2;
            ll -= 0.5 * (Math.Log(v) + effects[i] * effects[i] / v);
        }
        return ll;
    }
}
