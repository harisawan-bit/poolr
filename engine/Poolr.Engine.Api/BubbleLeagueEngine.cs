using System;
using System.Collections.Generic;
using System.Linq;

namespace Poolr.Engine.Api;

/// <summary>
/// Bubble Plot / Meta-Regression Scatter Plot engine (v0.6.0).
/// Generates publication-ready bubble plots for meta-regression.
/// Mirrors metafor::regplot() functionality.
/// </summary>
public static class BubblePlotEngine
{
    public class BubblePlotRequest
    {
        public List<double> effects { get; set; } = new();
        public List<double> standardErrors { get; set; } = new();
        public List<double> moderators { get; set; } = new();
        public List<string> studyLabels { get; set; } = new();
        public string moderatorLabel { get; set; } = "Moderator";
        public string effectLabel { get; set; } = "Effect Size";
        public bool showRegressionLine { get; set; } = true;
        public bool showPredictionInterval { get; set; } = true;
    }

    public class BubblePlotResult
    {
        public string Svg { get; set; } = "";
        public double Intercept { get; set; }
        public double Slope { get; set; }
        public double InterceptSe { get; set; }
        public double SlopeSe { get; set; }
        public double InterceptP { get; set; }
        public double SlopeP { get; set; }
        public double R2 { get; set; }
        public double Qm { get; set; }
        public double QmP { get; set; }
        public int Df { get; set; }
    }

    public static BubblePlotResult Generate(BubblePlotRequest req)
    {
        int n = req.effects.Count;
        if (n < 3)
            throw new ArgumentException("At least 3 studies required for bubble plot");

        if (req.moderators.Count != n || req.standardErrors.Count != n)
            throw new ArgumentException("All input lists must have the same length");

        // Weighted regression
        var weights = req.standardErrors.Select(se => 1.0 / (se * se)).ToList();
        double sumW = weights.Sum();
        double sumWx = weights.Zip(req.moderators, (w, x) => w * x).Sum();
        double sumWy = weights.Zip(req.effects, (w, y) => w * y).Sum();
        double sumWx2 = weights.Zip(req.moderators, (w, x) => w * x * x).Sum();
        double sumWxy = weights.Zip(req.moderators.Zip(req.effects, (x, y) => (x, y)), (w, p) => w * p.x * p.y).Sum();

        double denom = sumW * sumWx2 - sumWx * sumWx;
        double slope = (sumW * sumWxy - sumWx * sumWy) / denom;
        double intercept = (sumWy - slope * sumWx) / sumW;

        // Standard errors
        var residuals = new List<double>();
        for (int i = 0; i < n; i++)
        {
            double pred = intercept + slope * req.moderators[i];
            residuals.Add((req.effects[i] - pred) * Math.Max(weights[i], 1e-12));
        }
        double rss = residuals.Sum(r => r * r);
        double mse = rss / Math.Max(n - 2, 1);
        double slopeSe = Math.Sqrt(mse * sumW / denom);
        double interceptSe = Math.Sqrt(mse * sumWx2 / denom);

        // P-values
        double slopeT = slopeSe > 0 ? slope / slopeSe : 0;
        double interceptT = interceptSe > 0 ? intercept / interceptSe : 0;
        double slopeP = 2 * (1 - Stats.NormalCdf(Math.Abs(slopeT)));
        double interceptP = 2 * (1 - Stats.NormalCdf(Math.Abs(interceptT)));

        // R²
        double meanY = req.effects.Average();
        double ssTot = req.effects.Sum(y => (y - meanY) * (y - meanY));
        double ssRes = 0;
        for (int i = 0; i < n; i++)
        {
            double pred = intercept + slope * req.moderators[i];
            ssRes += (req.effects[i] - pred) * (req.effects[i] - pred);
        }
        double r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;

        // Qm (moderator test)
        double qm = 0;
        for (int i = 0; i < n; i++)
        {
            double pred = intercept + slope * req.moderators[i];
            qm += weights[i] * (req.effects[i] - pred) * (req.effects[i] - pred);
        }
        int df = n - 2;
        double qmP = 1 - Chi2.Cdf(qm, 1);

        // Generate SVG
        var svg = GenerateSvg(req, intercept, slope, interceptSe, slopeSe, slopeP, interceptP, r2, qm, qmP);

        return new BubblePlotResult
        {
            Svg = svg,
            Intercept = intercept,
            Slope = slope,
            InterceptSe = interceptSe,
            SlopeSe = slopeSe,
            InterceptP = interceptP,
            SlopeP = slopeP,
            R2 = r2,
            Qm = qm,
            QmP = qmP,
            Df = df
        };
    }

    private static string GenerateSvg(BubblePlotRequest req, double intercept, double slope, double interceptSe, double slopeSe, double slopeP, double interceptP, double r2, double qm, double qmP)
    {
        int w = 600, h = 450;
        int padLeft = 70, padRight = 30, padTop = 30, padBottom = 50;
        int plotW = w - padLeft - padRight;
        int plotH = h - padTop - padBottom;

        double xMin = req.moderators.Min();
        double xMax = req.moderators.Max();
        double yMin = req.effects.Min();
        double yMax = req.effects.Max();
        double xPad = (xMax - xMin) * 0.1;
        double yPad = (yMax - yMin) * 0.1;
        xMin -= xPad; xMax += xPad;
        yMin -= yPad; yMax += yPad;

        double Sx(double x) => padLeft + (x - xMin) / (xMax - xMin) * plotW;
        double Sy(double y) => padTop + plotH - (y - yMin) / (yMax - yMin) * plotH;

        var sb = new System.Text.StringBuilder();
        sb.AppendLine($"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"{w}\" height=\"{h}\" viewBox=\"0 0 {w} {h}\" font-family=\"Inter, Arial, sans-serif\">");
        sb.AppendLine("<rect width=\"100%\" height=\"100%\" fill=\"#0c0d11\"/>");

        // Axes
        sb.AppendLine($"<line x1=\"{padLeft}\" y1=\"{padTop + plotH}\" x2=\"{padLeft + plotW}\" y2=\"{padTop + plotH}\" stroke=\"#8b8d96\" stroke-width=\"1\"/>");
        sb.AppendLine($"<line x1=\"{padLeft}\" y1=\"{padTop}\" x2=\"{padLeft}\" y2=\"{padTop + plotH}\" stroke=\"#8b8d96\" stroke-width=\"1\"/>");

        // Regression line
        double x1 = xMin, y1 = intercept + slope * xMin;
        double x2 = xMax, y2 = intercept + slope * xMax;
        sb.AppendLine($"<line x1=\"{Sx(x1):F1}\" y1=\"{Sy(y1):F1}\" x2=\"{Sx(x2):F1}\" y2=\"{Sy(y2):F1}\" stroke=\"#ffffff\" stroke-width=\"2\" stroke-opacity=\"0.8\"/>");

        // Prediction interval (simplified)
        double piY1 = y1 + 1.96 * slopeSe * (xMax - xMin);
        double piY2 = y2 - 1.96 * slopeSe * (xMax - xMin);
        sb.AppendLine($"<line x1=\"{Sx(x1):F1}\" y1=\"{Sy(piY1):F1}\" x2=\"{Sx(x2):F1}\" y2=\"{Sy(piY2):F1}\" stroke=\"#8b8d96\" stroke-width=\"1\" stroke-dasharray=\"4 3\" stroke-opacity=\"0.5\"/>");

        // Bubbles
        for (int i = 0; i < req.effects.Count; i++)
        {
            double radius = 4 + 1.0 / req.standardErrors[i] * 0.5;
            radius = Math.Min(radius, 20);
            sb.AppendLine($"<circle cx=\"{Sx(req.moderators[i]):F1}\" cy=\"{Sy(req.effects[i]):F1}\" r=\"{radius:F1}\" fill=\"#e6e7ea\" fill-opacity=\"0.7\" stroke=\"#0c0d11\" stroke-width=\"0.5\"/>");
        }

        // Labels
        sb.AppendLine($"<text x=\"{padLeft + plotW / 2}\" y=\"{h - 10}\" text-anchor=\"middle\" font-size=\"11\" fill=\"#e6e7ea\">{req.moderatorLabel}</text>");
        sb.AppendLine($"<text x=\"20\" y=\"{padTop + plotH / 2}\" text-anchor=\"middle\" font-size=\"11\" fill=\"#e6e7ea\" transform=\"rotate(-90 20 {padTop + plotH / 2})\">{req.effectLabel}</text>");

        // Stats
        sb.AppendLine($"<text x=\"{padLeft + 5}\" y=\"{padTop + 15}\" font-size=\"10\" fill=\"#8b8d96\">Slope: {slope:F3} (SE {slopeSe:F3}, p={slopeP:F4})</text>");
        sb.AppendLine($"<text x=\"{padLeft + 5}\" y=\"{padTop + 28}\" font-size=\"10\" fill=\"#8b8d96\">Intercept: {intercept:F3} (SE {interceptSe:F3}, p={interceptP:F4})</text>");
        sb.AppendLine($"<text x=\"{padLeft + 5}\" y=\"{padTop + 41}\" font-size=\"10\" fill=\"#8b8d96\">R² = {r2:F3}, Qm = {qm:F2} (p = {qmP:F4})</text>");

        sb.AppendLine("</svg>");
        return sb.ToString();
    }
}

/// <summary>
/// League Matrix Heatmap engine for Network Meta-Analysis (v0.6.0).
/// Generates a color-coded heatmap of the league matrix.
/// Mirrors netmeta::netheatmap() functionality.
/// </summary>
public static class LeagueMatrixEngine
{
    public class LeagueMatrixRequest
    {
        public List<List<double>> matrix { get; set; } = new();
        public List<string> treatments { get; set; } = new();
        public string measure { get; set; } = "OR";
    }

    public class LeagueMatrixResult
    {
        public string Svg { get; set; } = "";
        public List<List<double>> matrix { get; set; } = new();
        public List<string> treatments { get; set; } = new();
    }

    public static LeagueMatrixResult Generate(LeagueMatrixRequest req)
    {
        int n = req.treatments.Count;
        if (n < 2)
            throw new ArgumentException("At least 2 treatments required");

        var result = new LeagueMatrixResult
        {
            matrix = req.matrix,
            treatments = req.treatments
        };

        result.Svg = GenerateHeatmapSvg(req.matrix, req.treatments, req.measure);
        return result;
    }

    private static string GenerateHeatmapSvg(List<List<double>> matrix, List<string> treatments, string measure)
    {
        int n = treatments.Count;
        if (matrix == null || matrix.Count < n)
            throw new ArgumentException("League matrix must have a row for each treatment");

        int cellSize = 50;
        int labelSize = 120;
        int w = labelSize + n * cellSize + 30;
        int h = labelSize + n * cellSize + 30;

        var sb = new System.Text.StringBuilder();
        sb.AppendLine($"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"{w}\" height=\"{h}\" viewBox=\"0 0 {w} {h}\" font-family=\"Inter, Arial, sans-serif\">");
        sb.AppendLine("<rect width=\"100%\" height=\"100%\" fill=\"#0c0d11\"/>");

        // Find range
        double maxAbs = 0;
        for (int i = 0; i < n; i++)
            for (int j = 0; j < n; j++)
                if (i != j)
                    maxAbs = Math.Max(maxAbs, Math.Abs(matrix[i][j]));

        // Cells
        for (int i = 0; i < n; i++)
        {
            for (int j = 0; j < n; j++)
            {
                int x = labelSize + j * cellSize;
                int y = labelSize + i * cellSize;

                if (i == j)
                {
                    sb.AppendLine($"<rect x=\"{x}\" y=\"{y}\" width=\"{cellSize}\" height=\"{cellSize}\" fill=\"#1a1b23\"/>");
                }
                else
                {
                    double val = matrix[i][j];
                    string color = GetHeatmapColor(val, maxAbs);
                    sb.AppendLine($"<rect x=\"{x}\" y=\"{y}\" width=\"{cellSize}\" height=\"{cellSize}\" fill=\"{color}\"/>");
                    sb.AppendLine($"<text x=\"{x + cellSize / 2}\" y=\"{y + cellSize / 2 + 4}\" text-anchor=\"middle\" font-size=\"9\" fill=\"#e6e7ea\">{val:F2}</text>");
                }
            }
        }

        // Labels
        for (int i = 0; i < n; i++)
        {
            sb.AppendLine($"<text x=\"{labelSize - 5}\" y=\"{labelSize + i * cellSize + cellSize / 2 + 4}\" text-anchor=\"end\" font-size=\"10\" fill=\"#e6e7ea\">{treatments[i]}</text>");
            sb.AppendLine($"<text x=\"{labelSize + i * cellSize + cellSize / 2}\" y=\"{labelSize - 5}\" text-anchor=\"middle\" font-size=\"10\" fill=\"#e6e7ea\" transform=\"rotate(-45 {labelSize + i * cellSize + cellSize / 2} {labelSize - 5})\">{treatments[i]}</text>");
        }

        // Title
        sb.AppendLine($"<text x=\"{w / 2}\" y=\"15\" text-anchor=\"middle\" font-size=\"11\" font-weight=\"700\" fill=\"#e6e7ea\">League Matrix ({measure})</text>");

        sb.AppendLine("</svg>");
        return sb.ToString();
    }

    private static string GetHeatmapColor(double value, double maxAbs)
    {
        if (maxAbs < 1e-9) return "#1a1b23";

        double normalized = value / maxAbs; // -1 to 1

        if (normalized > 0)
        {
            // Positive: red (favors row treatment)
            int intensity = (int)(255 * Math.Min(normalized, 1));
            return $"rgb({intensity}, {50}, {50})";
        }
        else
        {
            // Negative: blue (favors column treatment)
            int intensity = (int)(255 * Math.Min(-normalized, 1));
            return $"rgb({50}, {50}, {intensity})";
        }
    }
}
