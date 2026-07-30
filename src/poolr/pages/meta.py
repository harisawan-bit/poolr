"""
Meta-Analysis page - Advanced statistical analysis
"""

import customtkinter as ctk
import tkinter as tk
from tkinter import messagebox, filedialog
import json
import math
import traceback
from poolr.pages.base import BasePage
from poolr.meta.analysis import MetaAnalysis
from poolr.plotting.figures import create_forest_plot, create_funnel_plot


class MetaPage(BasePage):
    def __init__(self, master, app):
        super().__init__(master, app)
        self.meta_results = None
        self._build()

    def _build(self):
        top = ctk.CTkFrame(self)
        top.pack(fill="x", pady=(0, 12))

        ctk.CTkLabel(top, text="Meta-Analysis", font=ctk.CTkFont(size=20, weight="bold")).pack(side="left", padx=16, pady=12)

        btn_frame = ctk.CTkFrame(top, fg_color="transparent")
        btn_frame.pack(side="right", padx=12)
        ctk.CTkButton(btn_frame, text="▶️ Run Analysis", command=self._run_analysis, height=36, font=ctk.CTkFont(size=13, weight="bold")).pack(side="left", padx=4)
        ctk.CTkButton(btn_frame, text="📊 Forest Plot", command=self._show_forest_plot, height=36).pack(side="left", padx=4)
        ctk.CTkButton(btn_frame, text="📈 Funnel Plot", command=self._show_funnel_plot, height=36).pack(side="left", padx=4)
        ctk.CTkButton(btn_frame, text="📤 Export", command=self._export, height=36).pack(side="left", padx=4)

        # Settings
        settings = ctk.CTkFrame(self)
        settings.pack(fill="x", pady=(0, 12))
        
        ctk.CTkLabel(settings, text="Model:", font=ctk.CTkFont(size=13)).pack(side="left", padx=16, pady=12)
        self.model_var = tk.StringVar(value="random")
        ctk.CTkSegmentedButton(settings, values=["Random-effects", "Fixed-effect"], variable=self.model_var).pack(side="left", padx=8, pady=12)

        ctk.CTkLabel(settings, text="Effect Measure:", font=ctk.CTkFont(size=13)).pack(side="left", padx=16, pady=12)
        self.measure_var = tk.StringVar(value="OR")
        ctk.CTkSegmentedButton(settings, values=["OR", "RR", "RD", "MD", "SMD", "HR"], variable=self.measure_var).pack(side="left", padx=8, pady=12)

        ctk.CTkLabel(settings, text="Method:", font=ctk.CTkFont(size=13)).pack(side="left", padx=16, pady=12)
        self.method_var = tk.StringVar(value="DL")
        ctk.CTkComboBox(settings, values=["DL", "REML", "PM", "HS", "SJ", "ML", "EB"], variable=self.method_var, width=120).pack(side="left", padx=8, pady=12)

        ctk.CTkLabel(settings, text="Subgroup:", font=ctk.CTkFont(size=13)).pack(side="left", padx=16, pady=12)
        self.subgroup_var = tk.StringVar(value="none")
        ctk.CTkComboBox(settings, values=["none", "design", "country", "year", "custom"], variable=self.subgroup_var, width=150).pack(side="left", padx=8, pady=12)

        ctk.CTkLabel(settings, text="Publication Bias:", font=ctk.CTkFont(size=13)).pack(side="left", padx=16, pady=12)
        self.pub_bias_var = tk.StringVar(value="none")
        ctk.CTkComboBox(settings, values=["none", "egger", "begg", "trimfill"], variable=self.pub_bias_var, width=120).pack(side="left", padx=8, pady=12)

        # Results area
        self.results_area = ctk.CTkFrame(self)
        self.results_area.pack(fill="both", expand=True)
        self.results_area.grid_columnconfigure(0, weight=1)
        self.results_area.grid_rowconfigure(1, weight=1)

        self.results_text = ctk.CTkTextbox(self.results_area, font=ctk.CTkFont(family="Consolas", size=11))
        self.results_text.grid(row=0, column=0, sticky="nsew", padx=16, pady=16)

        # Plot frame
        self.plot_frame = ctk.CTkFrame(self.results_area)
        self.plot_frame.grid(row=1, column=0, sticky="nsew", padx=16, pady=(0, 16))
        self.plot_label = ctk.CTkLabel(self.plot_frame, text="Forest/Funnel plot will appear here after analysis", font=ctk.CTkFont(size=13))
        self.plot_label.pack(expand=True)

    def _run_analysis(self):
        studies = self.app.project_data.get("extraction", {}).get("studies", [])
        if not studies:
            messagebox.showwarning("Warning", "No extraction data available. Add studies in Extraction tab first.")
            return

        try:
            # Prepare data for meta-analysis
            analysis_data = self._prepare_analysis_data(studies)
            if not analysis_data:
                messagebox.showwarning("Warning", "No valid outcome data found. Ensure studies have outcome fields filled.")
                return

            # Run meta-analysis
            meta = MetaAnalysis(
                model=self.model_var.get(),
                measure=self.measure_var.get(),
                method=self.method_var.get(),
                subgroup=self.subgroup_var.get(),
                pub_bias=self.pub_bias_var.get()
            )
            
            results = meta.run(analysis_data)
            self.meta_results = results
            
            # Display results
            self._display_results(results)
            
            # Save to project
            self.app.project_data["meta"]["results"] = results
            self.app.save_project()
            
        except Exception as e:
            messagebox.showerror("Error", f"Meta-analysis failed:\n{e}")
            traceback.print_exc()

    def _prepare_analysis_data(self, studies):
        """Extract and validate outcome data from studies"""
        analysis_data = []
        
        for s in studies:
            measure = self.measure_var.get()
            
            if measure in ["OR", "RR", "RD"]:
                # Binary outcomes
                int_events = s.get("int_events", "")
                int_n = s.get("int_n", "")
                ctrl_events = s.get("ctrl_events", "")
                ctrl_n = s.get("ctrl_n", "")
                
                if int_events and int_n and ctrl_events and ctrl_n:
                    try:
                        analysis_data.append({
                            "study": s.get("study_id", "Unknown"),
                            "design": s.get("design", ""),
                            "country": s.get("country", ""),
                            "year": s.get("year", ""),
                            "type": "binary",
                            "int_events": int(int_events),
                            "int_n": int(int_n),
                            "ctrl_events": int(ctrl_events),
                            "ctrl_n": int(ctrl_n),
                        })
                    except ValueError:
                        pass
            
            elif measure in ["MD", "SMD"]:
                # Continuous outcomes
                int_mean = s.get("int_mean", "")
                int_sd = s.get("int_sd", "")
                int_n = s.get("int_n", "")
                ctrl_mean = s.get("ctrl_mean", "")
                ctrl_sd = s.get("ctrl_sd", "")
                ctrl_n = s.get("ctrl_n", "")
                
                if all([int_mean, int_sd, int_n, ctrl_mean, ctrl_sd, ctrl_n]):
                    try:
                        analysis_data.append({
                            "study": s.get("study_id", "Unknown"),
                            "design": s.get("design", ""),
                            "country": s.get("country", ""),
                            "year": s.get("year", ""),
                            "type": "continuous",
                            "int_mean": float(int_mean),
                            "int_sd": float(int_sd),
                            "int_n": int(int_n),
                            "ctrl_mean": float(ctrl_mean),
                            "ctrl_sd": float(ctrl_sd),
                            "ctrl_n": int(ctrl_n),
                        })
                    except ValueError:
                        pass
            
            elif measure == "HR":
                # Time-to-event
                int_hr = s.get("int_hr", "")
                int_hr_ci = s.get("int_hr_ci", "")
                ctrl_hr = s.get("ctrl_hr", "")
                ctrl_hr_ci = s.get("ctrl_hr_ci", "")
                
                if int_hr and int_hr_ci:
                    try:
                        # Parse HR and CI
                        import re
                        ci_match = re.match(r'[\s]*([0-9.]+)[\s]*,[\s]*([0-9.]+)', int_hr_ci)
                        if ci_match:
                            analysis_data.append({
                                "study": s.get("study_id", "Unknown"),
                                "design": s.get("design", ""),
                                "country": s.get("country", ""),
                                "year": s.get("year", ""),
                                "type": "survival",
                                "hr": float(int_hr),
                                "hr_lower": float(ci_match.group(1)),
                                "hr_upper": float(ci_match.group(2)),
                            })
                    except (ValueError, AttributeError):
                        pass
        
        return analysis_data

    def _display_results(self, results):
        self.results_text.delete("0.0", "end")
        
        out = "═══ META-ANALYSIS RESULTS ═══\n\n"
        out += f"Model: {results['model']}\n"
        out += f"Effect Measure: {results['measure']}\n"
        out += f"Method: {results.get('method', 'DL')}\n"
        out += f"Studies Included: {len(results['studies'])}\n\n"
        
        out += "Individual Studies:\n"
        out += "─" * 90 + "\n"
        out += f"{'Study':<20} {'Effect':>10} {'95% CI':>22} {'Weight':>8} {'Subgroup':>12}\n"
        out += "─" * 90 + "\n"
        
        for s in results["studies"]:
            out += f"{s['study']:<20} {s['effect']:>10.3f} ({s['ci_lower']:.3f}, {s['ci_upper']:.3f}) {s['weight']:>7.1f}% {s.get('subgroup', ''):>12}\n"
        
        out += "─" * 90 + "\n\n"
        
        p = results["pooled"]
        out += f"POOLED ESTIMATE ({p['model']}):\n"
        out += f"  {results['measure']} = {p['effect']:.3f} (95% CI: {p['ci_lower']:.3f} to {p['ci_upper']:.3f})\n"
        out += f"  Z = {p.get('z', 0):.3f}, P = {p.get('p', 1):.4f}\n\n"
        
        h = results["heterogeneity"]
        out += "HETEROGENEITY:\n"
        out += f"  Cochran's Q = {h['q']:.2f} (df = {h['df']})\n"
        out += f"  P(Q) = {h.get('q_p', 1):.4f}\n"
        out += f"  I² = {h['i2']:.1f}%\n"
        out += f"  τ² = {h.get('tau2', 0):.4f}\n"
        out += f"  τ = {h.get('tau', 0):.4f}\n\n"
        
        if results.get("subgroups"):
            out += "SUBGROUP ANALYSIS:\n"
            for sg in results["subgroups"]:
                out += f"  {sg['name']}: {sg['measure']} = {sg['effect']:.3f} (95% CI: {sg['ci_lower']:.3f}-{sg['ci_upper']:.3f}), n={sg['k']}\n"
            out += "\n"
        
        if results.get("publication_bias"):
            pb = results["publication_bias"]
            out += "PUBLICATION BIAS:\n"
            for test, val in pb.items():
                out += f"  {test}: {val}\n"
            out += "\n"
        
        # Interpretation
        if p["ci_lower"] > 1 or p["ci_upper"] < 1:
            out += "✓ Statistically significant (95% CI does not include 1)\n"
        else:
            out += "✗ Not statistically significant (95% CI includes 1)\n"
        
        if h["i2"] < 25:
            out += "✓ Low heterogeneity\n"
        elif h["i2"] < 50:
            out += "⚠ Moderate heterogeneity\n"
        elif h["i2"] < 75:
            out += "⚠ Substantial heterogeneity\n"
        else:
            out += "⚠ Considerable heterogeneity\n"
        
        self.results_text.insert("0.0", out)
        
        # Also show in messagebox for quick view
        messagebox.showinfo("Analysis Complete", f"Pooled {results['measure']} = {p['effect']:.3f} (95% CI: {p['ci_lower']:.3f}-{p['ci_upper']:.3f})\nI² = {h['i2']:.1f}%")

    def _show_forest_plot(self):
        if not self.meta_results:
            messagebox.showwarning("Warning", "Run analysis first")
            return
        
        try:
            fig = create_forest_plot(self.meta_results)
            # Show in new window
            self._show_plot_window(fig, "Forest Plot")
        except Exception as e:
            messagebox.showerror("Error", f"Failed to create forest plot:\n{e}")

    def _show_funnel_plot(self):
        if not self.meta_results:
            messagebox.showwarning("Warning", "Run analysis first")
            return
        
        try:
            fig = create_funnel_plot(self.meta_results)
            self._show_plot_window(fig, "Funnel Plot")
        except Exception as e:
            messagebox.showerror("Error", f"Failed to create funnel plot:\n{e}")

    def _show_plot_window(self, fig, title):
        import matplotlib
        matplotlib.use('TkAgg')
        from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg
        
        win = ctk.CTkToplevel(self)
        win.title(title)
        win.geometry("900x700")
        
        canvas = FigureCanvasTkAgg(fig, master=win)
        canvas.draw()
        canvas.get_tk_widget().pack(fill="both", expand=True, padx=10, pady=10)
        
        # Save button
        ctk.CTkButton(win, text="💾 Save as SVG", command=lambda: self._save_plot(fig)).pack(pady=10)

    def _save_plot(self, fig):
        path = filedialog.asksaveasfilename(defaultextension=".svg", filetypes=[("SVG", "*.svg"), ("PNG", "*.png"), ("PDF", "*.pdf")])
        if path:
            fig.savefig(path, format=path.split(".")[-1], dpi=300, bbox_inches="tight")
            messagebox.showinfo("Saved", f"Plot saved to:\n{path}")

    def _export(self):
        if not self.app.project_path:
            messagebox.showwarning("Warning", "No project open")
            return
        if not self.meta_results:
            messagebox.showwarning("Warning", "No results to export")
            return
        path = self.app.project_path / "meta_analysis_results.json"
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(self.meta_results, fh, indent=2)
        messagebox.showinfo("Exported", f"Results exported to:\n{path}")

    def on_enter(self):
        # Load previous results if exist
        if self.app.project_data.get("meta", {}).get("results"):
            self.meta_results = self.app.project_data["meta"]["results"]
            self._display_results(self.meta_results)