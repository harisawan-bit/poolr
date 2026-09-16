using System;
using System.Collections.Generic;
using System.Linq;

namespace Poolr.Engine.Api;

/// <summary>
/// Profile Likelihood CI for τ² (Thompson & Sharp 1999, metafor::confint).
/// Grid search over τ² computing restricted log-likelihood at each point.
/// CI where deviance drops by χ²(1) critical value from minimum.
/// </summary>
public static class ProfileLikelihoodEngine
{
    public class PlRequest
    {
        public List<double> effects { get; set; } = new();
        public List<double> variances { get; set; } = new();
        public string method { get; set; } = "REML";
        public int gridPoints { get; set; } = 100;
    }

    public class PlResult
    {
        public double tau2Estimate { get; set; }
        public double ciLower { get; set; }
        public double ciUpper { get; set; }
        public double devianceAtMin { get; set; }
        public List<double> tau2Grid { get; set; } = new();
        public List<double> devianceValues { get; set; } = new();
        public string method { get; set; } = "";
        public bool converged { get; set; }
    }

    public static PlResult Compute(PlRequest req)
    {
        if (req.effects.Count < 2)
            throw new ArgumentException("At least 2 studies required");

        int k = req.effects.Count;
        var y = req.effects.ToArray();
        var v = req.variances.ToArray();

        // Find τ² estimate (REML)
        double tau2Est = EstimateTau2(y, v, req.method);
        double maxTau2 = Math.Max(tau2Est * 5, 1.0);

        // Grid search
        var tau2Grid = new List<double>();
        var deviance = new List<double>();
        double devMin = double.MaxValue;
        double tau2AtMin = 0;
        double crit = 3.841459; // χ²(1) 0.95

        for (int i = 0; i < req.gridPoints; i++)
        {
            double tau2 = maxTau2 * i / (req.gridPoints - 1);
            double dev = ComputeDeviance(y, v, tau2, req.method);
            tau2Grid.Add(tau2);
            deviance.Add(dev);
            if (dev < devMin) { devMin = dev; tau2AtMin = tau2; }
        }

        // Find CI bounds
        double ciLower = 0, ciUpper = maxTau2;
        bool foundLo = false, foundHi = false;

        for (int i = 0; i < tau2Grid.Count; i++)
        {
            if (!foundLo && deviance[i] - devMin <= crit) { ciLower = tau2Grid[i]; foundLo = true; }
            if (foundLo && !foundHi && deviance[i] - devMin > crit) { ciUpper = tau2Grid[i - 1]; foundHi = true; break; }
        }
        if (!foundHi) ciUpper = maxTau2;

        return new PlResult
        {
            tau2Estimate = tau2AtMin,
            ciLower = ciLower,
            ciUpper = ciUpper,
            devianceAtMin = devMin,
            tau2Grid = tau2Grid,
            devianceValues = deviance,
            method = req.method,
            converged = true
        };
    }

    private static double EstimateTau2(double[] y, double[] v, string method)
    {
        int k = y.Length;
        var w = v.Select(vi => 1.0 / vi).ToArray();
        double sw = w.Sum();
        double fe = w.Zip(y, (wi, yi) => wi * yi).Sum() / sw;
        double q = w.Zip(y, (wi, yi) => wi * (yi - fe) * (yi - fe)).Sum();
        int df = k - 1;
        double c = sw - w.Sum(wi => wi * wi) / sw;
        return method switch
        {
            "DL" => Math.Max(0, (q - df) / c),
            "PM" => PauleMandel(y, v),
            _ => Math.Max(0, (q - df) / c) // REML approx
        };
    }

    private static double PauleMandel(double[] y, double[] v)
    {
        int k = y.Length;
        double lo = 0, hi = 10;
        for (int i = 0; i < 50; i++)
        {
            double mid = (lo + hi) / 2;
            var w = v.Select(vi => 1.0 / (vi + mid)).ToArray();
            double sw = w.Sum();
            double mu = w.Zip(y, (wi, yi) => wi * yi).Sum() / sw;
            double q = w.Zip(y, (wi, yi) => wi * (yi - mu) * (yi - mu)).Sum();
            if (q > k - 1) lo = mid; else hi = mid;
        }
        return Math.Max(0, (lo + hi) / 2);
    }

    private static double ComputeDeviance(double[] y, double[] v, double tau2, string method)
    {
        int k = y.Length;
        var w = v.Select(vi => 1.0 / (vi + tau2)).ToArray();
        double sw = w.Sum();
        double mu = w.Zip(y, (wi, yi) => wi * yi).Sum() / sw;

        // -2 * log-likelihood (REML approximation)
        double ll = 0;
        for (int i = 0; i < k; i++)
            ll += Math.Log(2 * Math.PI * (v[i] + tau2)) + (y[i] - mu) * (y[i] - mu) / (v[i] + tau2);
        ll += Math.Log(sw); // REML correction

        return ll;
    }
}
