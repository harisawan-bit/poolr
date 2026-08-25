using System;
using System.Collections.Generic;

namespace Poolr.Engine.Api;

/// <summary>
/// Shared numeric primitives for the v0.5.1 extended engine.
/// All formulas verified against metafor documentation / primary literature.
/// </summary>
public static class ExtendedStats
{
    public static double Logit(double p) => Math.Log(p / (1 - p));
    public static double Logistic(double x) => 1.0 / (1.0 + Math.Exp(-x));

    /// <summary>Poisson mixture of central chi2 CDFs == noncentral chi-square CDF.</summary>
    public static double NoncentralChi2Cdf(double x, int df, double lambda)
    {
        if (x <= 0) return 0;
        if (lambda <= 1e-12) return Chi2.Cdf(x, df);
        double lamHalf = lambda / 2.0;
        double term = Math.Exp(-lamHalf);
        double sum = 0;
        for (int j = 0; j < 300; j++)
        {
            sum += term * Chi2.Cdf(x, df + 2 * j);
            term *= lamHalf / (j + 1);
            if (term < 1e-15 && j > lambda) break;
        }
        return Math.Min(1.0, Math.Max(0.0, sum));
    }

    /// <summary>Two-sided 95% t critical values, df 1..30 (normal fallback beyond).</summary>
    public static double TCrit975(int df)
    {
        double[] t = {
            12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228,
            2.201, 2.179, 2.160, 2.145, 2.131, 2.120, 2.110, 2.101, 2.093, 2.086,
            2.080, 2.074, 2.069, 2.064, 2.060, 2.056, 2.052, 2.048, 2.045, 2.042 };
        return (df >= 1 && df <= 30) ? t[df - 1] : 1.959964;
    }

    /// <summary>Two-sided p-value from t statistic with df (incomplete beta).</summary>
    public static double TwoSidePFromT(double tStat, int df)
    {
        if (df <= 0) return 1;
        double x = df / (df + tStat * tStat);
        double ib = IncompleteBeta(x, df / 2.0, 0.5);
        return Math.Min(1.0, Math.Max(0.0, ib));
    }

    public static double IncompleteBeta(double x, double a, double b)
    {
        if (x <= 0) return 0;
        if (x >= 1) return 1;
        double lbeta = GammaLn(a + b) - GammaLn(a) - GammaLn(b);
        double front = Math.Exp(lbeta + a * Math.Log(x) + b * Math.Log(1 - x));
        if (x < (a + 1) / (a + b + 2))
            return front * BetaCF(x, a, b) / a;
        return 1 - Math.Exp(lbeta + b * Math.Log(1 - x) + a * Math.Log(x)) * BetaCF(1 - x, b, a) / b;
    }

    private static double BetaCF(double x, double a, double b)
    {
        const int maxIt = 300; const double eps = 3e-12; const double fpmin = 1e-30;
        double qab = a + b, qap = a + 1, qam = a - 1;
        double c = 1, d = 1 - qab * x / qap;
        if (Math.Abs(d) < fpmin) d = fpmin;
        d = 1 / d; double h = d;
        for (int m = 1; m <= maxIt; m++)
        {
            int m2 = 2 * m;
            double aa = m * (b - m) * x / ((qam + m2) * (a + m2));
            d = 1 + aa * d; if (Math.Abs(d) < fpmin) d = fpmin;
            c = 1 + aa / c; if (Math.Abs(c) < fpmin) c = fpmin;
            d = 1 / d; h *= d * c;
            aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
            d = 1 + aa * d; if (Math.Abs(d) < fpmin) d = fpmin;
            c = 1 + aa / c; if (Math.Abs(c) < fpmin) c = fpmin;
            d = 1 / d; double del = d * c; h *= del;
            if (Math.Abs(del - 1) < eps) break;
        }
        return h;
    }

    public static double GammaLn(double z)
    {
        double[] cof = {
            76.18009172947146, -86.50532032941677, 24.01409824083091,
            -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5 };
        double x = z, y = z, tmp = x + 5.5;
        tmp -= (x + 0.5) * Math.Log(tmp);
        double ser = 1.000000000190015;
        for (int j = 0; j < 6; j++) ser += cof[j] / ++y;
        return -tmp + Math.Log(2.5066282746310005 * ser / x);
    }
}

/// <summary>Central chi-square CDF (self-contained series form).</summary>
public static class Chi2
{
    public static double Cdf(double x, int df)
    {
        if (x <= 0 || df <= 0) return 0;
        double a = df / 2.0, xx = x / 2.0;
        double sum = 1.0 / a, term = 1.0 / a;
        for (int n = 1; n < 400; n++)
        {
            term *= xx / (a + n);
            sum += term;
            if (term / sum < 1e-14) break;
        }
        double gam = Math.Exp(a * Math.Log(xx) - xx) * sum;
        double gamm = Math.Exp(ExtendedStats.GammaLn(a));
        return Math.Min(1.0, gam / gamm);
    }
}
