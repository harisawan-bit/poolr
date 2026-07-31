"""
PRISMA page - PRISMA 2020 checklist and flow diagram
"""

import json
import tkinter as tk
from datetime import datetime
from tkinter import filedialog, messagebox

import customtkinter as ctk

from poolr.export.reports import export_to_latex, export_to_word
from poolr.grade import create_grade_summary
from poolr.pages.base import BasePage
from poolr.plotting.figures import create_prisma_flow_diagram


class PrismaPage(BasePage):
    def __init__(self, master, app):
        super().__init__(master, app)
        self._build()

    def _build(self):
        top = ctk.CTkFrame(self)
        top.pack(fill="x", pady=(0, 12))

        ctk.CTkLabel(top, text="PRISMA 2020", font=ctk.CTkFont(size=20, weight="bold")).pack(
            side="left", padx=16, pady=12
        )

        btn_frame = ctk.CTkFrame(top, fg_color="transparent")
        btn_frame.pack(side="right", padx=12)
        ctk.CTkButton(btn_frame, text="📄 Generate Checklist", command=self._generate_checklist, height=32).pack(
            side="left", padx=4
        )
        ctk.CTkButton(btn_frame, text="📊 Generate Flow", command=self._generate_flow, height=32).pack(
            side="left", padx=4
        )
        ctk.CTkButton(btn_frame, text="📤 Export Report", command=self._export, height=32).pack(side="left", padx=4)
        ctk.CTkButton(btn_frame, text="📝 Export Word", command=self._export_word, height=32).pack(side="left", padx=4)
        ctk.CTkButton(btn_frame, text="📄 Export LaTeX", command=self._export_latex, height=32).pack(
            side="left", padx=4
        )

        # Tabs
        self.tab_view = ctk.CTkTabview(self)
        self.tab_view.pack(fill="both", expand=True, padx=16, pady=(0, 16))

        self.tab_checklist = self.tab_view.add("✅ Checklist")
        self.tab_flow = self.tab_view.add("📊 Flow Diagram")
        self.tab_report = self.tab_view.add("📄 Report")
        self.tab_grade = self.tab_view.add("📊 GRADE")

        self._build_checklist_tab()
        self._build_flow_tab()
        self._build_report_tab()
        self._build_grade_tab()

    def _build_checklist_tab(self):
        scroll = ctk.CTkScrollableFrame(self.tab_checklist)
        scroll.pack(fill="both", expand=True)
        scroll.grid_columnconfigure(0, weight=1)

        self.checklist_items = {}
        prisma_items = [
            ("Title", "Identify the report as a systematic review, meta-analysis, or both."),
            (
                "Abstract",
                "Provide a structured summary including background, objectives, data sources, eligibility criteria, participants, interventions, appraisal methods, results, limitations, conclusions.",
            ),
            ("Introduction", "Describe the rationale for the review in the context of existing knowledge."),
            ("Objectives", "Provide explicit statement of questions with reference to PICOS."),
            ("Protocol", "Indicate if review protocol exists and where it can be accessed."),
            ("Eligibility Criteria", "Specify study and report characteristics used as criteria for eligibility."),
            ("Information Sources", "Describe all information sources in the search and date last searched."),
            ("Search Strategy", "Present full electronic search strategy for at least one database."),
            ("Selection Process", "State the process for selecting studies (screening, eligibility, included)."),
            ("Data Collection", "Describe method of data extraction and processes for obtaining data."),
            ("Data Items", "List and define all variables for which data were sought."),
            ("Risk of Bias", "Describe methods for assessing risk of bias of individual studies."),
            ("Effect Measures", "State the principal summary measures (e.g., risk ratio, difference in means)."),
            ("Synthesis Methods", "Describe methods of handling data and combining results."),
            ("Reporting Bias", "Specify assessment of risk of bias affecting cumulative evidence."),
            ("Certainty Assessment", "Describe methods for assessing certainty of evidence."),
            (
                "Study Selection",
                "Give numbers of studies screened, assessed for eligibility, included, with reasons for exclusions.",
            ),
            ("Study Characteristics", "Present characteristics for which data were extracted."),
            ("Risk of Bias Results", "Present data on risk of bias of each study."),
            ("Individual Study Results", "Present simple summary data and effect estimates with confidence intervals."),
            (
                "Synthesis Results",
                "Present results of each meta-analysis with confidence intervals and consistency measures.",
            ),
            ("Reporting Bias Results", "Present results of assessment of risk of bias across studies."),
            ("Certainty of Evidence", "Present assessments of certainty of evidence for each outcome."),
            ("Discussion", "Summarize main findings, strength of evidence, limitations, conclusions."),
            ("Registration", "Provide registration information."),
            ("Funding", "Describe sources of funding and role of funders."),
        ]

        for i, (item, desc) in enumerate(prisma_items):
            frame = ctk.CTkFrame(scroll)
            frame.pack(fill="x", padx=12, pady=6)
            frame.grid_columnconfigure(1, weight=1)

            var = tk.BooleanVar()
            cb = ctk.CTkCheckBox(frame, text=f"  {item}", variable=var, font=ctk.CTkFont(size=12))
            cb.grid(row=0, column=0, sticky="w", padx=12, pady=8)
            self.checklist_items[item] = var

            ctk.CTkLabel(frame, text=desc, wraplength=600, justify="left", font=ctk.CTkFont(size=11)).grid(
                row=0, column=1, sticky="w", padx=12, pady=8
            )
            frame.grid_columnconfigure(1, weight=1)

    def _build_flow_tab(self):
        # Flow diagram generator
        flow_frame = ctk.CTkFrame(self.tab_flow)
        flow_frame.pack(fill="both", expand=True, padx=16, pady=16)
        flow_frame.grid_columnconfigure(0, weight=1)
        flow_frame.grid_rowconfigure(1, weight=1)

        # Input numbers
        input_frame = ctk.CTkFrame(flow_frame)
        input_frame.grid(row=0, column=0, sticky="ew", pady=(0, 16))
        input_frame.grid_columnconfigure((1, 3, 5), weight=1)

        self.flow_inputs = {}
        flow_fields = [
            ("Records identified", "identified"),
            ("Records before screening", "before_screening"),
            ("Records excluded (title/abstract)", "excluded_ta"),
            ("Reports sought for retrieval", "sought"),
            ("Reports not retrieved", "not_retrieved"),
            ("Reports assessed for eligibility", "assessed"),
            ("Reports excluded (full text)", "excluded_ft"),
            ("Studies included", "included"),
        ]

        for i, (label, key) in enumerate(flow_fields):
            row = i // 2
            col = (i % 2) * 3
            ctk.CTkLabel(input_frame, text=label).grid(row=row, column=col, sticky="w", padx=12, pady=8)
            entry = ctk.CTkEntry(input_frame, width=100)
            entry.grid(row=row, column=col + 1, padx=8, pady=8)
            entry.insert(0, "0")
            self.flow_inputs[key] = entry

        btn_frame = ctk.CTkFrame(input_frame, fg_color="transparent")
        btn_frame.grid(row=4, column=0, columnspan=6, pady=12)
        ctk.CTkButton(btn_frame, text="🔄 Generate Diagram", command=self._draw_flow, height=36).pack(
            side="left", padx=8
        )
        ctk.CTkButton(btn_frame, text="💾 Save as SVG", command=self._save_flow_svg, height=36).pack(
            side="left", padx=8
        )

        # Canvas for flow diagram
        self.flow_canvas = tk.Canvas(flow_frame, bg="#2b2b2b", highlightthickness=0)
        self.flow_canvas.grid(row=1, column=0, sticky="nsew")
        flow_frame.grid_rowconfigure(1, weight=1)

    def _build_report_tab(self):
        self.report_text = ctk.CTkTextbox(self.tab_report, font=ctk.CTkFont(family="Consolas", size=11))
        self.report_text.pack(fill="both", expand=True, padx=16, pady=16)

    def _build_grade_tab(self):
        grade_frame = ctk.CTkFrame(self.tab_grade)
        grade_frame.pack(fill="both", expand=True, padx=16, pady=16)

        ctk.CTkLabel(grade_frame, text="GRADE Evidence Profile", font=ctk.CTkFont(size=18, weight="bold")).pack(
            anchor="w", pady=(0, 12)
        )

        btn_frame = ctk.CTkFrame(grade_frame, fg_color="transparent")
        btn_frame.pack(fill="x", pady=(0, 12))
        ctk.CTkButton(btn_frame, text="🔄 Auto-generate", command=self._generate_grade, height=36).pack(
            side="left", padx=4
        )
        ctk.CTkButton(btn_frame, text="📤 Export Table", command=self._export_grade, height=36).pack(
            side="left", padx=4
        )

        # Scrollable table
        self.grade_scroll = ctk.CTkScrollableFrame(grade_frame)
        self.grade_scroll.pack(fill="both", expand=True)

        self.grade_table_frame = ctk.CTkFrame(self.grade_scroll)
        self.grade_table_frame.pack(fill="x", padx=8, pady=8)

        self.grade_labels = []

    def _generate_checklist(self, interactive: bool = True):
        """Auto-fill checklist based on project data"""
        data = self.app.project_data

        # Title
        if self.app.project_path:
            self.checklist_items["Title"].set(True)

        # Abstract - check if meta results exist
        if data.get("meta", {}).get("results", {}):
            self.checklist_items["Abstract"].set(True)

        # Introduction - check if PICO defined
        if data.get("pico", {}):
            self.checklist_items["Introduction"].set(True)
            self.checklist_items["Objectives"].set(True)
            self.checklist_items["Eligibility Criteria"].set(True)

        # Protocol
        if data.get("protocol", {}):
            self.checklist_items["Protocol"].set(True)

        # Information Sources
        if data.get("protocol", {}).get("databases"):
            self.checklist_items["Information Sources"].set(True)

        # Search Strategy
        if data.get("search_strategies", {}):
            self.checklist_items["Search Strategy"].set(True)

        # Selection Process
        if data.get("screening", {}).get("title_abstract"):
            self.checklist_items["Selection Process"].set(True)

        # Data Collection
        if data.get("extraction", {}).get("studies"):
            self.checklist_items["Data Collection"].set(True)
            self.checklist_items["Data Items"].set(True)

        # Risk of Bias
        if data.get("rob", {}).get("assessments"):
            self.checklist_items["Risk of Bias"].set(True)

        # Effect Measures
        if data.get("meta", {}).get("results"):
            self.checklist_items["Effect Measures"].set(True)
            self.checklist_items["Synthesis Methods"].set(True)
            self.checklist_items["Synthesis Results"].set(True)

        # Reporting Bias
        if data.get("meta", {}).get("results", {}).get("publication_bias"):
            self.checklist_items["Reporting Bias"].set(True)

        # Certainty Assessment
        if data.get("grade"):
            self.checklist_items["Certainty Assessment"].set(True)

        # Results items
        if data.get("screening", {}).get("title_abstract"):
            self.checklist_items["Study Selection"].set(True)

        if data.get("extraction", {}).get("studies"):
            self.checklist_items["Study Characteristics"].set(True)
            self.checklist_items["Individual Study Results"].set(True)

        if data.get("rob", {}).get("assessments"):
            self.checklist_items["Risk of Bias Results"].set(True)

        if data.get("meta", {}).get("results"):
            self.checklist_items["Synthesis Results"].set(True)

        if data.get("meta", {}).get("results", {}).get("publication_bias"):
            self.checklist_items["Reporting Bias Results"].set(True)

        if data.get("grade"):
            self.checklist_items["Certainty of Evidence"].set(True)

        # Discussion, Registration, Funding
        if data.get("meta", {}).get("results"):
            self.checklist_items["Discussion"].set(True)

        if data.get("protocol", {}).get("registration"):
            self.checklist_items["Registration"].set(True)

        if data.get("protocol", {}).get("funding"):
            self.checklist_items["Funding"].set(True)

        if interactive:
            messagebox.showinfo(
                "Checklist", "PRISMA checklist auto-filled based on project data. Review and adjust as needed."
            )

    def _draw_flow(self):
        try:
            vals = {k: int(v.get()) for k, v in self.flow_inputs.items()}
        except ValueError:
            messagebox.showerror("Error", "Please enter valid numbers in all fields")
            return

        self.flow_canvas.delete("all")
        w = self.flow_canvas.winfo_width() or 800

        # Colors
        box_color = "#3d3d3d"
        text_color = "#ffffff"
        arrow_color = "#aaaaaa"
        highlight = "#4CAF50"
        excluded_color = "#5d2d2d"
        excluded_border = "#ff6b6b"

        # Draw boxes
        y_start = 50
        box_w = 300
        box_h = 60
        gap = 40
        x_center = w // 2 - box_w // 2

        steps = [
            ("Records identified\nthrough database searching", vals["identified"]),
            ("Records before\nscreening", vals["before_screening"]),
            ("Records excluded\n(title/abstract)", vals["excluded_ta"]),
            ("Reports assessed\nfor eligibility", vals["assessed"]),
            ("Reports excluded\n(full text)", vals["excluded_ft"]),
            ("Studies included\nin review", vals["included"]),
        ]

        y = y_start
        for i, (label, count) in enumerate(steps):
            # Main box
            self.flow_canvas.create_rectangle(
                x_center, y, x_center + box_w, y + box_h, fill=box_color, outline=highlight, width=2
            )
            self.flow_canvas.create_text(
                x_center + box_w // 2,
                y + box_h // 2,
                text=f"{label}\nn = {count}",
                fill=text_color,
                font=("Segoe UI", 11),
                justify="center",
            )

            # Arrow to next
            if i < len(steps) - 1:
                arrow_y = y + box_h
                self.flow_canvas.create_line(
                    x_center + box_w // 2,
                    arrow_y,
                    x_center + box_w // 2,
                    arrow_y + gap,
                    fill=arrow_color,
                    width=2,
                    arrow=tk.LAST,
                )
                y = arrow_y + gap

        # Excluded boxes on the side
        side_x = x_center + box_w + 80
        if vals["excluded_ta"] > 0:
            y = y_start + box_h + gap
            self.flow_canvas.create_rectangle(
                side_x, y, side_x + 250, y + box_h, fill=excluded_color, outline=excluded_border, width=2
            )
            self.flow_canvas.create_text(
                side_x + 125,
                y + box_h // 2,
                text=f"Excluded (title/abstract)\nn = {vals['excluded_ta']}",
                fill=text_color,
                font=("Segoe UI", 10),
                justify="center",
            )
            # Arrow from step 2
            self.flow_canvas.create_line(
                x_center + box_w, y + box_h // 2, side_x, y + box_h // 2, fill=arrow_color, width=2, arrow=tk.LAST
            )

        if vals["excluded_ft"] > 0:
            y = y_start + 3 * (box_h + gap)
            self.flow_canvas.create_rectangle(
                side_x, y, side_x + 250, y + box_h, fill=excluded_color, outline=excluded_border, width=2
            )
            self.flow_canvas.create_text(
                side_x + 125,
                y + box_h // 2,
                text=f"Excluded (full text)\nn = {vals['excluded_ft']}",
                fill=text_color,
                font=("Segoe UI", 10),
                justify="center",
            )
            self.flow_canvas.create_line(
                x_center + box_w, y + box_h // 2, side_x, y + box_h // 2, fill=arrow_color, width=2, arrow=tk.LAST
            )

    def _save_flow_svg(self):
        """Save flow diagram as SVG using matplotlib"""
        try:
            vals = {k: int(v.get()) for k, v in self.flow_inputs.items()}
        except ValueError:
            messagebox.showerror("Error", "Please enter valid numbers")
            return

        path = filedialog.asksaveasfilename(
            defaultextension=".svg", filetypes=[("SVG", "*.svg"), ("PNG", "*.png"), ("PDF", "*.pdf")]
        )
        if not path:
            return

        try:
            fig = create_prisma_flow_diagram(vals)
            fig.savefig(path, format=path.split(".")[-1], dpi=300, bbox_inches="tight")
            import matplotlib.pyplot as plt

            plt.close(fig)
            messagebox.showinfo("Saved", f"Flow diagram saved to:\n{path}")
        except Exception as e:
            messagebox.showerror("Error", f"Failed to save:\n{e}")

    def _generate_flow(self, interactive: bool = True):
        """Auto-populate from screening data"""
        data = self.app.project_data
        ta = data.get("screening", {}).get("title_abstract", [])
        ft = data.get("screening", {}).get("full_text", [])

        identified = len(ta)
        excluded_ta = sum(1 for r in ta if r.get("decision_reviewer1") is False or r.get("decision_reviewer2") is False)
        assessed = sum(
            1 for r in ft if r.get("decision_reviewer1") is not None or r.get("decision_reviewer2") is not None
        )
        excluded_ft = sum(1 for r in ft if r.get("decision_reviewer1") is False or r.get("decision_reviewer2") is False)
        included = sum(1 for r in ft if r.get("decision_reviewer1") is True or r.get("decision_reviewer2") is True)

        self.flow_inputs["identified"].delete(0, "end")
        self.flow_inputs["identified"].insert(0, str(identified))
        self.flow_inputs["before_screening"].delete(0, "end")
        self.flow_inputs["before_screening"].insert(0, str(identified))
        self.flow_inputs["excluded_ta"].delete(0, "end")
        self.flow_inputs["excluded_ta"].insert(0, str(excluded_ta))
        self.flow_inputs["assessed"].delete(0, "end")
        self.flow_inputs["assessed"].insert(0, str(assessed))
        self.flow_inputs["excluded_ft"].delete(0, "end")
        self.flow_inputs["excluded_ft"].insert(0, str(excluded_ft))
        self.flow_inputs["included"].delete(0, "end")
        self.flow_inputs["included"].insert(0, str(included))
        self.flow_inputs["sought"].delete(0, "end")
        self.flow_inputs["sought"].insert(0, str(assessed))
        self.flow_inputs["not_retrieved"].delete(0, "end")
        self.flow_inputs["not_retrieved"].insert(0, "0")

        self._draw_flow()
        if interactive:
            messagebox.showinfo("Flow", "Flow diagram auto-populated from screening data")

    def _generate_grade(self):
        """Generate GRADE evidence profile"""
        grade_data = create_grade_summary(self.app.project_data)
        self.app.project_data["grade"] = grade_data

        # Display in table
        for widget in self.grade_table_frame.winfo_children():
            widget.destroy()

        if not grade_data["assessments"]:
            ctk.CTkLabel(self.grade_table_frame, text="No meta-analysis results available for GRADE assessment").pack(
                pady=20
            )
            return

        # Table header
        headers = [
            "Outcome",
            "Studies",
            "Design",
            "Risk of Bias",
            "Inconsistency",
            "Indirectness",
            "Imprecision",
            "Pub. Bias",
            "Start",
            "Final",
            "Downgrades",
        ]

        header_frame = ctk.CTkFrame(self.grade_table_frame)
        header_frame.pack(fill="x", padx=4, pady=4)
        for i, h in enumerate(headers):
            ctk.CTkLabel(header_frame, text=h, font=ctk.CTkFont(size=10, weight="bold")).grid(
                row=0, column=i, padx=4, pady=4
            )
            header_frame.grid_columnconfigure(i, weight=1)

        # Data rows
        for assessment in grade_data["assessments"]:
            row_frame = ctk.CTkFrame(self.grade_table_frame)
            row_frame.pack(fill="x", padx=4, pady=2)

            vals = [
                assessment["outcome"][:30],
                str(assessment["studies"]),
                assessment["design"],
                assessment["risk_of_bias"],
                assessment["inconsistency"],
                assessment["indirectness"],
                assessment["imprecision"],
                assessment["publication_bias"],
                assessment["starting_certainty"],
                assessment["final_certainty"],
                "; ".join(assessment["downgrade_reasons"]) if assessment["downgrade_reasons"] else "None",
            ]

            for i, v in enumerate(vals):
                label = ctk.CTkLabel(row_frame, text=v, font=ctk.CTkFont(size=9))
                label.grid(row=0, column=i, padx=4, pady=2, sticky="w")
                row_frame.grid_columnconfigure(i, weight=1)

                # Color final certainty
                if i == 9:
                    color_map = {
                        "High": "#00B050",
                        "Moderate": "#FFC000",
                        "Low": "#FF6600",
                        "Very Low": "#FF0000",
                    }
                    label.configure(text_color=color_map.get(v, "white"))

        # Summary
        summary = grade_data.get("summary", {})
        ctk.CTkLabel(
            self.grade_table_frame,
            text=f"Summary: {summary.get('total_outcomes', 0)} outcomes assessed | "
            f"High: {summary.get('high_certainty', 0)} | Moderate: {summary.get('moderate_certainty', 0)} | "
            f"Low: {summary.get('low_certainty', 0)} | Very Low: {summary.get('very_low_certainty', 0)}",
            font=ctk.CTkFont(size=11, weight="bold"),
        ).pack(pady=12)

    def _export_grade(self):
        """Export GRADE table"""
        if not self.app.project_path:
            messagebox.showwarning("Warning", "No project open")
            return

        grade_data = create_grade_summary(self.app.project_data)

        path = self.app.project_path / "grade_evidence_profile.json"
        with open(path, "w") as f:
            json.dump(grade_data, f, indent=2)

        messagebox.showinfo("Exported", f"GRADE profile saved to:\n{path}")

    def _export(self):
        """Export PRISMA report as JSON"""
        if not self.app.project_path:
            messagebox.showwarning("Warning", "No project open")
            return

        report = {
            "checklist": {k: v.get() for k, v in self.checklist_items.items()},
            "flow": {k: v.get() for k, v in self.flow_inputs.items()},
            "grade": self.app.project_data.get("grade", {}),
            "generated": datetime.now().isoformat(),
        }

        path = self.app.project_path / "prisma_report.json"
        with open(path, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2)

        # Generate text report
        self.report_text.delete("0.0", "end")
        text = "PRISMA 2020 CHECKLIST\n"
        text += "=" * 60 + "\n\n"
        for item, var in self.checklist_items.items():
            status = "✓" if var.get() else "✗"
            text += f"{status} {item}\n"

        text += "\n\nPRISMA FLOW DIAGRAM DATA\n"
        text += "=" * 60 + "\n\n"
        for k, v in self.flow_inputs.items():
            text += f"{k}: {v.get()}\n"

        if self.app.project_data.get("grade"):
            text += "\n\nGRADE EVIDENCE PROFILE\n"
            text += "=" * 60 + "\n\n"
            text += json.dumps(self.app.project_data["grade"], indent=2)

        self.report_text.insert("0.0", text)
        messagebox.showinfo("Exported", f"PRISMA report exported to:\n{path}")

    def _export_word(self):
        """Export full SRMA report to Word"""
        if not self.app.project_path:
            messagebox.showwarning("Warning", "No project open")
            return

        try:
            path = export_to_word(self.app.project_data, self.app.project_path)
            messagebox.showinfo("Exported", f"Word report saved to:\n{path}")
        except ImportError as e:
            messagebox.showerror("Error", f"Required package not installed:\n{e}\nRun: pip install python-docx")
        except Exception as e:
            messagebox.showerror("Error", f"Export failed:\n{e}")

    def _export_latex(self):
        """Export to LaTeX"""
        if not self.app.project_path:
            messagebox.showwarning("Warning", "No project open")
            return

        try:
            path = export_to_latex(self.app.project_data, self.app.project_path)
            messagebox.showinfo("Exported", f"LaTeX report saved to:\n{path}\nCompile with: pdflatex {path.name}")
        except ImportError as e:
            messagebox.showerror("Error", f"Required package not installed:\n{e}\nRun: pip install pylatex")
        except Exception as e:
            messagebox.showerror("Error", f"Export failed:\n{e}")

    def on_enter(self):
        # Auto-generate checklist if not done (non-interactive: never block headless CI)
        if not any(v.get() for v in self.checklist_items.values()):
            self._generate_checklist(interactive=False)

        # Auto-generate flow if not done (non-interactive: never block headless CI)
        if all(v.get() == "0" for v in self.flow_inputs.values()):
            self._generate_flow(interactive=False)
