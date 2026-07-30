#!/usr/bin/env python3
"""
Headless CLI for poolr - enables CI/CD automation without GUI.
Usage:
  poolr-cli <project_path> [options]

Options:
  --run-meta          Run meta-analysis
  --export FORMAT     Export (word, latex, json, all)
  --output PATH       Output directory
  --generate-plots    Generate forest/funnel plots
  --generate-prisma   Generate PRISMA flow diagram
  --generate-grade    Generate GRADE evidence profile
"""

import argparse
import json
import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from poolr.export.reports import export_to_latex, export_to_word
from poolr.grade import create_grade_summary
from poolr.meta.analysis import MetaAnalysis
from poolr.plotting.figures import create_forest_plot, create_funnel_plot, create_prisma_flow_diagram


def load_project(project_path):
    """Load a poolr project from JSON."""
    poolr_json = Path(project_path) / "poolr.json"
    if not poolr_json.exists():
        print(f"Error: {poolr_json} not found")
        sys.exit(1)

    with open(poolr_json) as f:
        data = json.load(f)

    # Make the project directory available for figure embedding during exports
    data["project_path"] = Path(project_path)
    return data


def run_meta_analysis(project_data, measure="OR", model="random", method="DL"):
    """Run meta-analysis on extraction data."""
    studies = project_data.get("extraction", {}).get("studies", [])
    if not studies:
        print("Error: No extraction data found")
        return None

    # Prepare data for meta-analysis
    analysis_data = []
    for s in studies:
        if s.get("type") == "binary":
            analysis_data.append(
                {
                    "study": s.get("study_id", s.get("title", "Unknown")),
                    "type": "binary",
                    "int_events": s.get("int_events", 0),
                    "int_n": s.get("int_n", 0),
                    "ctrl_events": s.get("ctrl_events", 0),
                    "ctrl_n": s.get("ctrl_n", 0),
                }
            )
        elif s.get("type") == "continuous":
            analysis_data.append(
                {
                    "study": s.get("study_id", s.get("title", "Unknown")),
                    "type": "continuous",
                    "int_mean": s.get("int_mean", 0),
                    "int_sd": s.get("int_sd", 0),
                    "int_n": s.get("int_n", 0),
                    "ctrl_mean": s.get("ctrl_mean", 0),
                    "ctrl_sd": s.get("ctrl_sd", 0),
                    "ctrl_n": s.get("ctrl_n", 0),
                }
            )
        elif s.get("type") == "survival":
            analysis_data.append(
                {
                    "study": s.get("study_id", s.get("title", "Unknown")),
                    "type": "survival",
                    "hr": s.get("int_hr", 0),
                    "hr_lower": s.get("int_hr_ci_lower", 0),
                    "hr_upper": s.get("int_hr_ci_upper", 0),
                }
            )

    if not analysis_data:
        print("Error: No valid outcome data found")
        return None

    meta = MetaAnalysis(model=model, measure=measure, method=method)
    results = meta.run(analysis_data)

    print("\nMeta-Analysis Results:")
    print(f"  Model: {results['model']}")
    print(f"  Measure: {results['measure']}")
    print(f"  Studies: {results['k']}")
    print(
        f"  Pooled effect: {results['pooled']['effect']:.4f} "
        f"(95% CI: {results['pooled']['ci_lower']:.4f}-{results['pooled']['ci_upper']:.4f})"
    )
    print(f"  Heterogeneity: I² = {results['heterogeneity']['i2']:.1f}%")

    # Store results in project data
    project_data["meta"] = {"results": results}

    return results


def generate_plots(project_data, output_dir):
    """Generate forest and funnel plots."""
    results = project_data.get("meta", {}).get("results", {})
    if not results:
        print("Error: No meta-analysis results found")
        return

    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    # Forest plot
    fig = create_forest_plot(results)
    fig.savefig(output_dir / "forest_plot.svg", format="svg", dpi=300, bbox_inches="tight")
    print(f"  ✓ Forest plot saved: {output_dir / 'forest_plot.svg'}")

    # Funnel plot
    fig = create_funnel_plot(results)
    fig.savefig(output_dir / "funnel_plot.svg", format="svg", dpi=300, bbox_inches="tight")
    print(f"  ✓ Funnel plot saved: {output_dir / 'funnel_plot.svg'}")


def generate_prisma(project_data, output_dir):
    """Generate PRISMA flow diagram."""
    screening = project_data.get("screening", {})

    # Calculate flow numbers from screening data
    ta_decisions = screening.get("title_abstract", [])
    ft_decisions = screening.get("full_text", [])

    identified = len(ta_decisions)
    included_ta = sum(1 for d in ta_decisions if d.get("decision") is True)
    excluded_ta = sum(1 for d in ta_decisions if d.get("decision") is False)

    # Full-text stage: fall back to title/abstract counts when no FT screening yet
    included_ft = sum(1 for d in ft_decisions if d.get("decision") is True)
    excluded_ft = sum(1 for d in ft_decisions if d.get("decision") is False)
    assessed_ft = len(ft_decisions) if ft_decisions else included_ta
    final_included = included_ft if ft_decisions else included_ta

    flow_data = {
        "identified": identified,
        "before_screening": identified,
        "excluded_ta": excluded_ta,
        "sought": included_ta,
        "not_retrieved": 0,
        "assessed": assessed_ft,
        "excluded_ft": excluded_ft,
        "included": final_included,
    }

    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    fig = create_prisma_flow_diagram(flow_data)
    fig.savefig(output_dir / "prisma_flow.svg", format="svg", dpi=300, bbox_inches="tight")
    print(f"  ✓ PRISMA flow diagram saved: {output_dir / 'prisma_flow.svg'}")


def generate_grade(project_data, output_dir):
    """Generate GRADE evidence profile."""
    grade_summary = create_grade_summary(project_data)

    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    grade_json = output_dir / "grade_evidence.json"
    with open(grade_json, "w") as f:
        json.dump(grade_summary, f, indent=2)

    print(f"  ✓ GRADE evidence profile saved: {grade_json}")
    print(f"    Total outcomes: {grade_summary['summary']['total_outcomes']}")


def export_report(project_data, format_type, output_dir):
    """Export project report."""
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    if format_type == "word":
        export_to_word(project_data, output_dir, output_path=output_dir / "report.docx")
        print(f"  ✓ Word report saved: {output_dir / 'report.docx'}")
    elif format_type == "latex":
        export_to_latex(project_data, output_dir, output_path=output_dir / "report.tex")
        print(f"  ✓ LaTeX report saved: {output_dir / 'report.tex'}")
    elif format_type == "json":
        with open(output_dir / "report.json", "w") as f:
            json.dump(project_data, f, indent=2, default=str)
        print(f"  ✓ JSON report saved: {output_dir / 'report.json'}")
    elif format_type == "all":
        export_to_word(project_data, output_dir, output_path=output_dir / "report.docx")
        print(f"  ✓ Word report saved: {output_dir / 'report.docx'}")
        export_to_latex(project_data, output_dir, output_path=output_dir / "report.tex")
        print(f"  ✓ LaTeX report saved: {output_dir / 'report.tex'}")
        with open(output_dir / "report.json", "w") as f:
            json.dump(project_data, f, indent=2, default=str)
        print(f"  ✓ JSON report saved: {output_dir / 'report.json'}")


def main():
    parser = argparse.ArgumentParser(
        description="poolr CLI - Headless systematic review & meta-analysis tool",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  poolr-cli ./my_project --run-meta --export word --output ./reports/
  poolr-cli ./my_project --generate-plots --output ./plots/
  poolr-cli ./my_project --generate-prisma --output ./figures/
  poolr-cli ./my_project --generate-grade --output ./grade/
  poolr-cli ./my_project --export all --output ./dist/
        """,
    )

    parser.add_argument("project_path", help="Path to poolr project directory")
    parser.add_argument("--run-meta", action="store_true", help="Run meta-analysis")
    parser.add_argument("--export", choices=["word", "latex", "json", "all"], help="Export format")
    parser.add_argument("--output", "-o", default="./output", help="Output directory")
    parser.add_argument("--generate-plots", action="store_true", help="Generate forest/funnel plots")
    parser.add_argument("--generate-prisma", action="store_true", help="Generate PRISMA flow diagram")
    parser.add_argument("--generate-grade", action="store_true", help="Generate GRADE evidence profile")
    parser.add_argument("--measure", default="OR", choices=["OR", "RR", "RD", "MD", "SMD", "HR"], help="Effect measure")
    parser.add_argument("--model", default="random", choices=["random", "fixed"], help="Meta-analysis model")
    parser.add_argument(
        "--method", default="DL", choices=["DL", "REML", "PM", "HS", "SJ", "ML", "EB"], help="Estimation method"
    )

    args = parser.parse_args()

    # Load project
    print(f"Loading project: {args.project_path}")
    project_data = load_project(args.project_path)
    print(f"  Project: {project_data.get('metadata', {}).get('name', 'Unnamed')}")

    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    # Run meta-analysis
    if args.run_meta:
        print("\nRunning meta-analysis...")
        results = run_meta_analysis(project_data, args.measure, args.model, args.method)
        if results:
            # Save results to project (drop the runtime-injected project_path key)
            poolr_json = Path(args.project_path) / "poolr.json"
            persisted = {k: v for k, v in project_data.items() if k != "project_path"}
            with open(poolr_json, "w") as f:
                json.dump(persisted, f, indent=2)

    # Generate plots
    if args.generate_plots:
        print("\nGenerating plots...")
        generate_plots(project_data, output_dir)

    # Generate PRISMA flow
    if args.generate_prisma:
        print("\nGenerating PRISMA flow diagram...")
        generate_prisma(project_data, output_dir)

    # Generate GRADE
    if args.generate_grade:
        print("\nGenerating GRADE evidence profile...")
        generate_grade(project_data, output_dir)

    # Export report
    if args.export:
        print(f"\nExporting report ({args.export})...")
        export_report(project_data, args.export, output_dir)

    print("\n✓ Done!")


if __name__ == "__main__":
    main()
