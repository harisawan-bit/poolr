"""
Plotting module - Forest plots, Funnel plots, PRISMA flow diagrams
Generates publication-ready SVG/PNG/PDF figures
"""

import matplotlib
matplotlib.use('Agg')  # Non-interactive backend
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import FancyBboxPatch
import numpy as np
import math
from typing import Dict, List, Any, Optional
import warnings
warnings.filterwarnings("ignore")


def create_forest_plot(results: Dict[str, Any], figsize: tuple = (10, 12)) -> plt.Figure:
    """
    Create publication-ready forest plot
    """
    studies = results.get("studies", [])
    pooled = results.get("pooled", {})
    hetero = results.get("heterogeneity", {})
    measure = results.get("measure", "OR")
    model = results.get("model", "Random-effects")
    
    if not studies:
        fig, ax = plt.subplots(figsize=figsize)
        ax.text(0.5, 0.5, "No studies to display", ha='center', va='center', fontsize=14)
        return fig
    
    k = len(studies)
    
    # Calculate dimensions
    fig_height = max(8, 2 + k * 0.5)
    fig, ax = plt.subplots(figsize=(figsize[0], fig_height))
    
    # Prepare data
    study_names = [s["study"] for s in studies]
    effects = [s["effect"] for s in studies]
    ci_lower = [s["ci_lower"] for s in studies]
    ci_upper = [s["ci_upper"] for s in studies]
    weights = [s["weight"] for s in studies]
    
    # Pooled
    pooled_effect = pooled.get("effect", 0)
    pooled_lower = pooled.get("ci_lower", 0)
    pooled_upper = pooled.get("ci_upper", 0)
    
    # Set up scales
    if measure in ["OR", "RR", "HR"]:
        # Log scale for ratio measures
        all_values = ci_lower + ci_upper + [pooled_lower, pooled_upper]
        min_val = min(v for v in all_values if v > 0)
        max_val = max(all_values)
        x_min = min_val * 0.5
        x_max = max_val * 2
        use_log = True
    else:
        # Linear scale for MD, SMD, RD
        all_values = ci_lower + ci_upper + [pooled_lower, pooled_upper]
        x_min = min(all_values) - 0.5
        x_max = max(all_values) + 0.5
        use_log = False
    
    # Y positions (bottom to top)
    y_positions = list(range(k, 0, -1))  # Studies at top
    pooled_y = 0  # Pooled at bottom
    
    # Colors
    study_color = '#2196F3'
    pooled_color = '#4CAF50'
    ci_color = '#BBDEFB'
    
    # Draw study CIs and points
    for i, (y, name, eff, lo, hi, wt) in enumerate(zip(y_positions, study_names, effects, ci_lower, ci_upper, weights)):
        # CI line
        ax.plot([lo, hi], [y, y], color=study_color, linewidth=1.5, alpha=0.8, zorder=2)
        
        # CI ends
        ax.plot([lo, lo], [y - 0.1, y + 0.1], color=study_color, linewidth=1.5, zorder=2)
        ax.plot([hi, hi], [y - 0.1, y + 0.1], color=study_color, linewidth=1.5, zorder=2)
        
        # Effect size point (square proportional to weight)
        size = 50 + wt * 3  # Weight-proportional
        if use_log:
            ax.scatter(math.log(eff), y, s=size, color=study_color, edgecolor='white', linewidth=0.5, zorder=3)
        else:
            ax.scatter(eff, y, s=size, color=study_color, edgecolor='white', linewidth=0.5, zorder=3)
        
        # Study name
        ax.text(-0.02, y, name, ha='right', va='center', fontsize=9, transform=ax.get_yaxis_transform(), clip_on=False)
        
        # Effect and CI text
        if use_log:
            eff_text = f"{eff:.2f} ({lo:.2f}, {hi:.2f})"
        else:
            eff_text = f"{eff:.2f} ({lo:.2f}, {hi:.2f})"
        ax.text(1.02, y, eff_text, ha='left', va='center', fontsize=9, fontfamily='monospace', 
               transform=ax.get_yaxis_transform(), clip_on=False)
        
        # Weight
        ax.text(1.15, y, f"{wt:.1f}%", ha='left', va='center', fontsize=8, color='gray',
               transform=ax.get_yaxis_transform(), clip_on=False)
    
    # Draw pooled effect (diamond)
    diamond_width = (pooled_upper - pooled_lower) / 2 if not use_log else (math.log(pooled_upper) - math.log(pooled_lower)) / 2
    diamond_center = math.log(pooled_effect) if use_log else pooled_effect
    
    # Diamond vertices
    if use_log:
        diamond_x = [diamond_center - diamond_width, diamond_center, diamond_center + diamond_width, diamond_center]
        diamond_y = [pooled_y - 0.2, pooled_y, pooled_y + 0.2, pooled_y]
    else:
        diamond_x = [diamond_center - diamond_width, diamond_center, diamond_center + diamond_width, diamond_center]
        diamond_y = [pooled_y - 0.2, pooled_y, pooled_y + 0.2, pooled_y]
    
    diamond = plt.Polygon(list(zip(diamond_x, diamond_y)), 
                         facecolor=pooled_color, edgecolor='darkgreen', linewidth=1.5, zorder=3)
    ax.add_patch(diamond)
    
    # Pooled label
    ax.text(-0.02, pooled_y, f"Pooled ({model})", ha='right', va='center', fontsize=10, fontweight='bold',
           transform=ax.get_yaxis_transform(), clip_on=False)
    
    # Pooled effect text
    if use_log:
        pooled_text = f"{pooled_effect:.2f} ({pooled_lower:.2f}, {pooled_upper:.2f})"
    else:
        pooled_text = f"{pooled_effect:.2f} ({pooled_lower:.2f}, {pooled_upper:.2f})"
    ax.text(1.02, pooled_y, pooled_text, ha='left', va='center', fontsize=10, fontweight='bold', fontfamily='monospace',
           transform=ax.get_yaxis_transform(), clip_on=False)
    
    # Reference line (null effect)
    null_line = math.log(1) if use_log else 0
    ax.axvline(null_line, color='gray', linestyle='--', linewidth=1, alpha=0.7, zorder=1)
    
    # Labels
    ax.set_ylabel('')
    ax.set_xlabel(f'{measure} (95% CI)', fontsize=11)
    
    # Title
    title = f"Forest Plot — {measure} ({model})"
    if hetero:
        title += f"  |  I² = {hetero.get('i2', 0):.1f}%, τ² = {hetero.get('tau2', 0):.3f}, Q = {hetero.get('q', 0):.1f} (df={hetero.get('df', 0)})"
    ax.set_title(title, fontsize=12, pad=20)
    
    # Set x scale
    if use_log:
        ax.set_xscale('log')
        ax.set_xlim(x_min, x_max)
        # Custom tick formatter
        from matplotlib.ticker import FuncFormatter
        ax.xaxis.set_major_formatter(FuncFormatter(lambda x, _: f'{x:.2f}'))
    else:
        ax.set_xlim(x_min, x_max)
    
    # Y limits
    ax.set_ylim(-0.8, k + 0.5)
    
    # Hide y axis
    ax.yaxis.set_visible(False)
    
    # Grid
    ax.grid(axis='x', alpha=0.3)
    
    # Column headers
    ax.text(-0.02, k + 0.3, "Study", ha='right', va='center', fontsize=10, fontweight='bold',
           transform=ax.get_yaxis_transform(), clip_on=False)
    ax.text(1.02, k + 0.3, f"{measure} (95% CI)", ha='left', va='center', fontsize=10, fontweight='bold',
           transform=ax.get_yaxis_transform(), clip_on=False)
    ax.text(1.15, k + 0.3, "Weight", ha='left', va='center', fontsize=10, fontweight='bold',
           transform=ax.get_yaxis_transform(), clip_on=False)
    
    # Separator line
    ax.axhline(k + 0.15, color='black', linewidth=0.5)
    
    plt.tight_layout()
    return fig


def create_funnel_plot(results: Dict[str, Any], figsize: tuple = (8, 8)) -> plt.Figure:
    """
    Create publication-ready funnel plot
    """
    studies = results.get("studies", [])
    measure = results.get("measure", "OR")
    pooled = results.get("pooled", {})
    
    if len(studies) < 3:
        fig, ax = plt.subplots(figsize=figsize)
        ax.text(0.5, 0.5, "Need ≥3 studies for funnel plot", ha='center', va='center', fontsize=14)
        return fig
    
    fig, ax = plt.subplots(figsize=figsize)
    
    # Extract effects and standard errors
    effects = []
    ses = []
    weights = []
    
    for s in studies:
        eff = s["effect"]
        lo = s["ci_lower"]
        hi = s["ci_upper"]
        wt = s["weight"]
        
        if measure in ["OR", "RR", "HR"]:
            log_eff = math.log(eff)
            se = (math.log(hi) - math.log(lo)) / (2 * 1.96)
        else:
            log_eff = eff
            se = (hi - lo) / (2 * 1.96)
        
        effects.append(log_eff)
        ses.append(se)
        weights.append(wt)
    
    pooled_eff = math.log(pooled.get("effect", 1)) if measure in ["OR", "RR", "HR"] else pooled.get("effect", 0)
    
    # Convert for plotting
    effects_arr = np.array(effects)
    ses_arr = np.array(ses)
    
    # Pseudo 95% CI lines (pseudo-confidence intervals)
    se_range = np.linspace(min(ses_arr) * 0.8, max(ses_arr) * 1.5, 100)
    ci_upper = pooled_eff + 1.96 * se_range
    ci_lower = pooled_eff - 1.96 * se_range
    
    # Plot pseudo-CI region
    if measure in ["OR", "RR", "HR"]:
        ax.fill_betweenx(se_range, ci_lower, ci_upper, alpha=0.15, color='blue', label='95% CI')
    else:
        ax.fill_betweenx(se_range, ci_lower, ci_upper, alpha=0.15, color='blue', label='95% CI')
    
    # Plot studies
    scatter = ax.scatter(effects_arr, ses_arr, c=weights, s=[w * 5 for w in weights], 
                        cmap='Blues', alpha=0.7, edgecolors='black', linewidth=0.5, zorder=3)
    
    # Pooled effect line
    ax.axvline(pooled_eff, color='red', linestyle='-', linewidth=2, label=f'Pooled {measure}', zorder=2)
    
    # Null line
    null_line = 0
    ax.axvline(null_line, color='gray', linestyle='--', linewidth=1, alpha=0.5)
    
    # Labels
    ax.set_xlabel(f'Log {measure}' if measure in ["OR", "RR", "HR"] else f'{measure}', fontsize=12)
    ax.set_ylabel('Standard Error', fontsize=12)
    ax.set_title(f'Funnel Plot — {measure}', fontsize=14, pad=20)
    
    # Invert y-axis (larger studies at top)
    ax.invert_yaxis()
    
    # Legend
    ax.legend(loc='upper right')
    
    # Colorbar
    cbar = plt.colorbar(scatter, ax=ax, shrink=0.8)
    cbar.set_label('Weight (%)', fontsize=10)
    
    # Grid
    ax.grid(True, alpha=0.3)
    
    plt.tight_layout()
    return fig


def create_prisma_flow_diagram(flow_data: Dict[str, int], figsize: tuple = (10, 14)) -> plt.Figure:
    """
    Create PRISMA 2020 flow diagram as matplotlib figure
    """
    fig, ax = plt.subplots(figsize=figsize)
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 14)
    ax.axis('off')
    
    # Colors
    box_color = '#E3F2FD'
    border_color = '#1976D2'
    excluded_color = '#FFEBEE'
    excluded_border = '#C62828'
    text_color = '#212121'
    arrow_color = '#424242'
    
    def draw_box(x, y, w, h, text, fill_color=box_color, edge_color=border_color, fontsize=10):
        box = FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.1", 
                            facecolor=fill_color, edgecolor=edge_color, linewidth=1.5)
        ax.add_patch(box)
        ax.text(x + w/2, y + h/2, text, ha='center', va='center', fontsize=fontsize, color=text_color)
        return (x + w/2, y + h)  # bottom center for arrows
    
    def draw_arrow(x1, y1, x2, y2):
        ax.annotate('', xy=(x2, y2), xytext=(x1, y1),
                   arrowprops=dict(arrowstyle='->', color=arrow_color, lw=1.5))
    
    # Extract flow numbers
    identified = flow_data.get("identified", 0)
    before_screening = flow_data.get("before_screening", identified)
    excluded_ta = flow_data.get("excluded_ta", 0)
    sought = flow_data.get("sought", 0)
    not_retrieved = flow_data.get("not_retrieved", 0)
    assessed = flow_data.get("assessed", 0)
    excluded_ft = flow_data.get("excluded_ft", 0)
    included = flow_data.get("included", 0)
    
    # Column positions
    left_col = 0.5
    mid_col = 3.5
    right_col = 7
    
    box_w = 2.8
    box_h = 1.1
    gap = 0.4
    
    # Row positions (from top)
    y = 12.5
    
    # Step 1: Identification
    pos1 = draw_box(left_col, y, box_w, box_h, 
                   f"Records identified from\ndatabases (n = {identified})")
    y -= box_h + gap
    
    # Step 2: Before screening
    pos2 = draw_box(mid_col, y, box_w, box_h,
                   f"Records before\nscreening (n = {before_screening})")
    draw_arrow(pos1[0], pos1[1], pos2[0], pos2[1])
    y -= box_h + gap
    
    # Step 3: Excluded TA (side box)
    if excluded_ta > 0:
        pos3_ex = draw_box(right_col, y, box_w, box_h,
                          f"Records excluded\n(title/abstract)\n(n = {excluded_ta})",
                          fill_color=excluded_color, edge_color=excluded_border)
        draw_arrow(pos2[0] + box_w/2, pos2[1], pos3_ex[0] - box_w/2, pos3_ex[1])
    
    # Step 4: Reports sought
    pos4 = draw_box(mid_col, y - box_h - gap, box_w, box_h,
                   f"Reports sought for\nretrieval (n = {sought})")
    draw_arrow(pos2[0], pos2[1] - box_h, pos4[0], pos4[1])
    y = pos4[1]
    
    # Step 5: Not retrieved
    if not_retrieved > 0:
        pos5_nr = draw_box(right_col, y, box_w, box_h,
                          f"Reports not\nretrieved (n = {not_retrieved})",
                          fill_color=excluded_color, edge_color=excluded_border)
        draw_arrow(pos4[0] + box_w/2, pos4[1], pos5_nr[0] - box_w/2, pos5_nr[1])
    
    # Step 6: Assessed
    pos6 = draw_box(mid_col, y - box_h - gap, box_w, box_h,
                   f"Reports assessed for\neligibility (n = {assessed})")
    draw_arrow(pos4[0], pos4[1] - box_h, pos6[0], pos6[1])
    y = pos6[1]
    
    # Step 7: Excluded FT (side box)
    if excluded_ft > 0:
        pos7_ex = draw_box(right_col, y, box_w, box_h,
                          f"Reports excluded\n(full text)\n(n = {excluded_ft})",
                          fill_color=excluded_color, edge_color=excluded_border)
        draw_arrow(pos6[0] + box_w/2, pos6[1], pos7_ex[0] - box_w/2, pos7_ex[1])
    
    # Step 8: Included
    pos8 = draw_box(mid_col, y - box_h - gap, box_w, box_h,
                   f"Studies included in\nreview (n = {included})",
                   fill_color='#E8F5E9', edge_color='#2E7D32', fontsize=11)
    draw_arrow(pos6[0], pos6[1] - box_h, pos8[0], pos8[1])
    
    # Title
    ax.text(5, 13.5, "PRISMA 2020 Flow Diagram", ha='center', va='center', 
           fontsize=18, fontweight='bold', color='#1565C0')
    
    plt.tight_layout()
    return fig


def save_figure(fig: plt.Figure, path: str, dpi: int = 300):
    """Save figure to file"""
    fig.savefig(path, dpi=dpi, bbox_inches='tight', facecolor='white')
    plt.close(fig)