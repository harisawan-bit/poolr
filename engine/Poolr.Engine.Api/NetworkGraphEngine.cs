using System;
using System.Collections.Generic;
using System.Linq;

namespace Poolr.Engine.Api;

/// <summary>
/// SVG Network Graph generator for NMA.
/// Circular or force-directed layout.
/// </summary>
public static class NetworkGraphEngine
{
    public class Edge
    {
        public string treatment1 { get; set; } = "";
        public string treatment2 { get; set; } = "";
        public int nStudies { get; set; }
        public double weight { get; set; }
    }

    public class GraphRequest
    {
        public List<Edge> edges { get; set; } = new();
        public string layout { get; set; } = "circular"; // circular, force
        public int width { get; set; } = 500;
        public int height { get; set; } = 400;
    }

    public class GraphResult
    {
        public string svg { get; set; } = "";
        public List<NodePosition> nodes { get; set; } = new();
        public int nNodes { get; set; }
        public int nEdges { get; set; }
    }

    public class NodePosition
    {
        public string treatment { get; set; } = "";
        public double x { get; set; }
        public double y { get; set; }
        public double radius { get; set; }
        public int connections { get; set; }
        public double totalWeight { get; set; }
    }

    public static GraphResult Generate(GraphRequest req)
    {
        // Collect unique treatments
        var treatments = new HashSet<string>();
        foreach (var e in req.edges)
        {
            treatments.Add(e.treatment1);
            treatments.Add(e.treatment2);
        }

        var nodes = treatments.ToList();
        int n = nodes.Count;

        // Compute connectivity
        var connCount = new Dictionary<string, int>();
        var totalWeight = new Dictionary<string, double>();
        foreach (var t in nodes) { connCount[t] = 0; totalWeight[t] = 0; }
        foreach (var e in req.edges)
        {
            connCount[e.treatment1]++;
            connCount[e.treatment2]++;
            totalWeight[e.treatment1] += e.weight;
            totalWeight[e.treatment2] += e.weight;
        }

        // Layout
        double cx = req.width / 2.0;
        double cy = req.height / 2.0;
        double radius = Math.Min(req.width, req.height) * 0.35;

        var positions = new Dictionary<string, (double x, double y)>();

        if (req.layout == "circular")
        {
            for (int i = 0; i < n; i++)
            {
                double angle = 2 * Math.PI * i / n;
                positions[nodes[i]] = (
                    cx + radius * Math.Cos(angle),
                    cy + radius * Math.Sin(angle)
                );
            }
        }
        else
        {
            // Simple force-directed (random init + repulsion)
            var rng = new Random(42);
            foreach (var t in nodes)
                positions[t] = (cx + (rng.NextDouble() - 0.5) * radius, cy + (rng.NextDouble() - 0.5) * radius);

            // Iterate force simulation
            for (int iter = 0; iter < 50; iter++)
            {
                var forces = new Dictionary<string, (double fx, double fy)>();
                foreach (var t in nodes) forces[t] = (0, 0);

                // Repulsion between all nodes
                for (int i = 0; i < n; i++)
                    for (int j = i + 1; j < n; j++)
                    {
                        double dx = positions[nodes[j]].x - positions[nodes[i]].x;
                        double dy = positions[nodes[j]].y - positions[nodes[i]].y;
                        double dist = Math.Max(0.01, Math.Sqrt(dx * dx + dy * dy));
                        double f = 500 / (dist * dist);
                        double fx = f * dx / dist;
                        double fy = f * dy / dist;
                        forces[nodes[i]] = (forces[nodes[i]].fx - fx, forces[nodes[i]].fy - fy);
                        forces[nodes[j]] = (forces[nodes[j]].fx + fx, forces[nodes[j]].fy + fy);
                    }

                // Attraction along edges
                foreach (var e in req.edges)
                {
                    double dx = positions[e.treatment2].x - positions[e.treatment1].x;
                    double dy = positions[e.treatment2].y - positions[e.treatment1].y;
                    double dist = Math.Max(0.01, Math.Sqrt(dx * dx + dy * dy));
                    double f = dist * 0.01 * e.weight;
                    double fx = f * dx / dist;
                    double fy = f * dy / dist;
                    forces[e.treatment1] = (forces[e.treatment1].fx + fx, forces[e.treatment1].fy + fy);
                    forces[e.treatment2] = (forces[e.treatment2].fx - fx, forces[e.treatment2].fy - fy);
                }

                // Apply forces
                foreach (var t in nodes)
                {
                    var p = positions[t];
                    positions[t] = (
                        Math.Max(40, Math.Min(req.width - 40, p.x + forces[t].fx * 0.01)),
                        Math.Max(40, Math.Min(req.height - 40, p.y + forces[t].fy * 0.01))
                    );
                }
            }
        }

        // Compute max weight for scaling
        double maxW = req.edges.Count > 0 ? req.edges.Max(e => e.weight) : 1;

        // Generate SVG
        var sb = new System.Text.StringBuilder();
        sb.AppendLine($"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"{req.width}\" height=\"{req.height}\" viewBox=\"0 0 {req.width} {req.height}\" font-family=\"Inter, Arial, sans-serif\">");
        sb.AppendLine("<rect width=\"100%\" height=\"100%\" fill=\"#0c0d11\"/>");

        // Edges
        foreach (var e in req.edges)
        {
            var p1 = positions[e.treatment1];
            var p2 = positions[e.treatment2];
            double thickness = 1 + 5 * e.weight / maxW;
            sb.AppendLine($"<line x1=\"{p1.x:F1}\" y1=\"{p1.y:F1}\" x2=\"{p2.x:F1}\" y2=\"{p2.y:F1}\" stroke=\"#8b8d96\" stroke-width=\"{thickness:F1}\" stroke-opacity=\"0.7\"/>");
            // Edge weight label
            double mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
            sb.AppendLine($"<text x=\"{mx:F1}\" y=\"{my:F1}\" text-anchor=\"middle\" font-size=\"9\" fill=\"#e6e7ea\">{e.weight:F0}</text>");
        }

        // Nodes
        var nodeList = new List<NodePosition>();
        foreach (var t in nodes)
        {
            var p = positions[t];
            double nodeR = 12 + 8 * connCount[t] / Math.Max(1, connCount.Values.Max());
            sb.AppendLine($"<circle cx=\"{p.x:F1}\" cy=\"{p.y:F1}\" r=\"{nodeR:F1}\" fill=\"#3fb950\" stroke=\"#0c0d11\" stroke-width=\"2\"/>");
            sb.AppendLine($"<text x=\"{p.x:F1}\" y=\"{p.y:F1}\" text-anchor=\"middle\" dominant-baseline=\"middle\" font-size=\"9\" font-weight=\"700\" fill=\"#0c0d11\">{Truncate(t, 4)}</text>");
            // Full label below
            sb.AppendLine($"<text x=\"{p.x:F1}\" y=\"{p.y + nodeR + 12:F1}\" text-anchor=\"middle\" font-size=\"10\" fill=\"#e6e7ea\">{t}</text>");

            nodeList.Add(new NodePosition
            {
                treatment = t,
                x = p.x,
                y = p.y,
                radius = nodeR,
                connections = connCount[t],
                totalWeight = totalWeight[t]
            });
        }

        sb.AppendLine("</svg>");

        return new GraphResult
        {
            svg = sb.ToString(),
            nodes = nodeList,
            nNodes = n,
            nEdges = req.edges.Count
        };
    }

    private static string Truncate(string s, int max) => s.Length <= max ? s : s.Substring(0, max) + ".";
}
