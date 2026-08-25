using System;
using System.Collections.Generic;

namespace Poolr.Engine.Api;

/// <summary>
/// v0.5.1 effect-size conversions and data-completion helpers.
/// Wan et al. (2014): median/Q1/Q3 (or min/max) -> mean/SD for use in MD/SMD MA.
/// </summary>
public static class Converters
{
    public static ConvertResponse Run(ConvertRequest req)
    {
        var extra = new Dictionary<string, double>();
        switch (req.conversion)
        {
            case "or2rr":
                {
                    if (req.control_rate is not double p0 || p0 <= 0 || p0 >= 1)
                        throw new ArgumentException("control_rate in (0,1) required");
                    double or = req.value;
                    double rr = or * (1 - p0) / (p0 * or + (1 - p0));
                    return new ConvertResponse
                    {
                        conversion = "or2rr",
                        result = rr,
                        note = $"OR {or} -> RR at control rate p0={p0}"
                    };
                }
            case "rr2or":
                {
                    if (req.control_rate is not double p0 || p0 <= 0 || p0 >= 1)
                        throw new ArgumentException("control_rate in (0,1) required");
                    double p1 = 1 - Math.Pow(1 - p0, req.value); // RR applied to control risk
                    double orr = (p1 / (1 - p1)) / (p0 / (1 - p0));
                    return new ConvertResponse
                    {
                        conversion = "rr2or",
                        result = orr,
                        note = $"RR {req.value} -> OR at control rate p0={p0}"
                    };
                }
            case "or2rd":
                {
                    if (req.control_rate is not double p0 || p0 <= 0 || p0 >= 1)
                        throw new ArgumentException("control_rate in (0,1) required");
                    double odds1 = req.value * p0 / (1 - p0);
                    double p1 = odds1 / (1 + odds1);
                    return new ConvertResponse
                    {
                        conversion = "or2rd",
                        result = p1 - p0,
                        note = $"OR {req.value} -> RD at control rate p0={p0}"
                    };
                }
            case "rd2nnt":
                {
                    if (req.value == 0) throw new ArgumentException("RD must be non-zero");
                    return new ConvertResponse
                    {
                        conversion = "rd2nnt",
                        result = 1.0 / Math.Abs(req.value),
                        note = "NNT from RD (absolute value; sign of RD gives benefit/harm)"
                    };
                }
            case "smd2or":
                {
                    // Hasselblad-Hedges logit approximation: lnOR = delta * sqrt(3)/pi ... using pi^2/3 factor
                    double d = req.delta ?? req.value;
                    double lnOr = d * Math.PI / Math.Sqrt(3.0);
                    return new ConvertResponse
                    {
                        conversion = "smd2or",
                        result = Math.Exp(lnOr),
                        note = $"SMD {d} -> OR (Hasselblad-Hedges logit approx.)"
                    };
                }
            case "or2smd":
                {
                    double or = req.value;
                    double d = Math.Log(or) * Math.Sqrt(3.0) / Math.PI;
                    return new ConvertResponse
                    {
                        conversion = "or2smd",
                        result = d,
                        note = $"OR {or} -> SMD (Hasselblad-Hedges logit approx.)"
                    };
                }
            case "median_to_mean_sd":
                {
                    if (req.median is not double med || req.n is not int n || n < 5)
                        throw new ArgumentException("median and n (>=5) required");
                    bool hasQuartiles = req.q1.HasValue && req.q3.HasValue;
                    bool hasRange = req.min.HasValue && req.max.HasValue;
                    if (!hasQuartiles && !hasRange)
                        throw new ArgumentException("Provide q1+q3 or min+max");
                    double mean, sd;
                    if (hasQuartiles && hasRange && req.min.HasValue && req.max.HasValue)
                    {
                        // Wan 2014 method 3: median, q1/q3, min/max
                        double q1 = req.q1!.Value, q3 = req.q3!.Value, mn = req.min!.Value, mx = req.max!.Value;
                        mean = (mn + 2 * q1 + 2 * med + 2 * q3 + mx) / 8.0;
                        sd = Math.Max(Math.Pow((q3 - q1), 2) / 36 + Math.Pow(mx - mn, 2) / 4, 0.000001);
                        sd = Math.Sqrt(Math.Pow(q3 - q1, 2) / 36.0 + Math.Pow(mx - mn, 2) / 4.0);
                    }
                    else if (hasQuartiles)
                    {
                        // Wan 2014 method 1: median + q1/q3
                        double q1 = req.q1!.Value, q3 = req.q3!.Value;
                        mean = (q1 + 2 * med + q3) / 4.0;
                        sd = Math.Sqrt(Math.Pow(q3 - q1, 2) / 36.0);
                    }
                    else
                    {
                        // Wan 2014 method 2: median + min/max
                        double mn = req.min!.Value, mx = req.max!.Value;
                        mean = (mn + 2 * med + mx) / 4.0;
                        sd = Math.Sqrt(Math.Pow(mx - mn, 2) / 4.0);
                    }
                    extra["mean"] = mean; extra["sd"] = sd;
                    return new ConvertResponse
                    {
                        conversion = "median_to_mean_sd",
                        result = mean,
                        extra = extra,
                        note = "Wan et al. 2014 approximation"
                    };
                }
            case "ci_to_se":
                {
                    if (req.q1 is not double lo || req.q3 is not double hi)
                        throw new ArgumentException("pass CI bounds as q1 (lower) and q3 (upper)");
                    double se = (hi - lo) / (2 * 1.959964);
                    extra["se"] = se;
                    return new ConvertResponse
                    {
                        conversion = "ci_to_se",
                        result = se,
                        extra = extra,
                        note = "SE from 95% CI width"
                    };
                }
            default:
                throw new ArgumentException($"Unknown conversion '{req.conversion}'");
        }
    }
}
