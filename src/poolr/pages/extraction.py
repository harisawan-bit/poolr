"""
Extraction page - Data extraction with structured forms
"""

from tkinter import filedialog, messagebox

import customtkinter as ctk
import pandas as pd

from poolr.pages.base import BasePage


class ExtractionPage(BasePage):
    def __init__(self, master, app):
        super().__init__(master, app)
        self._current_study = None
        self._study_index = 0
        self._build()

    def _build(self):
        top = ctk.CTkFrame(self)
        top.pack(fill="x", pady=(0, 12))

        ctk.CTkLabel(top, text="Data Extraction", font=ctk.CTkFont(size=20, weight="bold")).pack(
            side="left", padx=16, pady=12
        )

        btn_frame = ctk.CTkFrame(top, fg_color="transparent")
        btn_frame.pack(side="right", padx=12)
        ctk.CTkButton(btn_frame, text="➕ Add Study", command=self._add_study, height=32).pack(side="left", padx=4)
        ctk.CTkButton(btn_frame, text="📥 Import CSV", command=self._import_csv, height=32).pack(side="left", padx=4)
        ctk.CTkButton(btn_frame, text="📤 Export CSV", command=self._export_csv, height=32).pack(side="left", padx=4)
        ctk.CTkButton(btn_frame, text="📥 Import RIS", command=self._import_ris, height=32).pack(side="left", padx=4)
        ctk.CTkButton(btn_frame, text="💾 Save", command=self._save, height=32).pack(side="left", padx=4)

        # Main area
        main = ctk.CTkFrame(self)
        main.pack(fill="both", expand=True)
        main.grid_columnconfigure(1, weight=1)
        main.grid_rowconfigure(0, weight=1)

        # Left: Study list
        left = ctk.CTkFrame(main, width=320)
        left.grid(row=0, column=0, sticky="nsew", padx=(0, 8))
        left.grid_rowconfigure(1, weight=1)
        left.grid_propagate(False)

        ctk.CTkLabel(left, text="Studies", font=ctk.CTkFont(size=14, weight="bold")).grid(
            row=0, column=0, sticky="w", padx=12, pady=12
        )

        self.study_list = ctk.CTkScrollableFrame(left)
        self.study_list.grid(row=1, column=0, sticky="nsew", padx=8, pady=(0, 12))

        # Right: Extraction form
        self.form_scroll = ctk.CTkScrollableFrame(main)
        self.form_scroll.grid(row=0, column=1, sticky="nsew", padx=(8, 0))
        self.form_scroll.grid_columnconfigure(0, weight=1)

        self._build_form()

    def _build_form(self):
        self.form_fields = {}

        sections = [
            (
                "Study Identification",
                [
                    ("study_id", "Study ID", "entry"),
                    ("title", "Title", "text"),
                    ("authors", "Authors", "entry"),
                    ("year", "Year", "entry"),
                    ("journal", "Journal", "entry"),
                    ("doi", "DOI", "entry"),
                    ("country", "Country", "entry"),
                    ("pmid", "PMID", "entry"),
                ],
            ),
            (
                "Study Design",
                [
                    (
                        "design",
                        "Design",
                        "combo",
                        ["RCT", "Cohort", "Case-Control", "Cross-Sectional", "Case Series", "Other"],
                    ),
                    ("setting", "Setting", "entry"),
                    ("follow_up", "Follow-up Duration", "entry"),
                    ("funding", "Funding Source", "entry"),
                    ("coi", "Conflicts of Interest", "text"),
                ],
            ),
            (
                "Population",
                [
                    ("population_description", "Description", "text"),
                    ("age_mean", "Mean Age", "entry"),
                    ("age_sd", "SD Age", "entry"),
                    ("age_range", "Age Range", "entry"),
                    ("sex_male_pct", "Male (%)", "entry"),
                    ("sample_size", "Total Sample Size", "entry"),
                    ("inclusion_criteria", "Inclusion Criteria", "text"),
                    ("exclusion_criteria", "Exclusion Criteria", "text"),
                ],
            ),
            (
                "Intervention Group",
                [
                    ("int_description", "Description", "text"),
                    ("int_n", "N", "entry"),
                    ("int_events", "Events (binary)", "entry"),
                    ("int_mean", "Mean (continuous)", "entry"),
                    ("int_sd", "SD (continuous)", "entry"),
                    ("int_median", "Median", "entry"),
                    ("int_iqr", "IQR", "entry"),
                    ("int_hr", "Hazard Ratio", "entry"),
                    ("int_hr_ci", "HR 95% CI", "entry"),
                ],
            ),
            (
                "Control Group",
                [
                    ("ctrl_description", "Description", "text"),
                    ("ctrl_n", "N", "entry"),
                    ("ctrl_events", "Events (binary)", "entry"),
                    ("ctrl_mean", "Mean (continuous)", "entry"),
                    ("ctrl_sd", "SD (continuous)", "entry"),
                    ("ctrl_median", "Median", "entry"),
                    ("ctrl_iqr", "IQR", "entry"),
                    ("ctrl_hr", "Hazard Ratio", "entry"),
                    ("ctrl_hr_ci", "HR 95% CI", "entry"),
                ],
            ),
            (
                "Outcomes",
                [
                    ("primary_outcome", "Primary Outcome", "entry"),
                    ("secondary_outcomes", "Secondary Outcomes", "text"),
                    ("timepoints", "Timepoints", "entry"),
                    ("outcome_measure", "Outcome Measure", "entry"),
                ],
            ),
            (
                "Neurosurgery Specific",
                [
                    ("gcs_mean", "Mean GCS", "entry"),
                    ("gcs_range", "GCS Range", "entry"),
                    ("icp_monitoring", "ICP Monitoring (%)", "entry"),
                    ("craniectomy_type", "Craniectomy Type", "combo", ["Hemicraniectomy", "Bifrontal", "Other"]),
                    ("treatment_timing", "Treatment Timing (hrs)", "entry"),
                ],
            ),
            (
                "Notes",
                [
                    ("notes", "Notes", "text"),
                ],
            ),
        ]

        for section_idx, (section_title, fields) in enumerate(sections):
            frame = ctk.CTkFrame(self.form_scroll)
            frame.pack(fill="x", padx=12, pady=12)
            frame.grid_columnconfigure(1, weight=1)

            ctk.CTkLabel(frame, text=section_title, font=ctk.CTkFont(size=15, weight="bold")).grid(
                row=0, column=0, columnspan=2, sticky="w", padx=12, pady=(12, 8)
            )

            for field_idx, field_info in enumerate(fields):
                if len(field_info) == 3:
                    key, label, ftype = field_info
                    options = None
                else:
                    key, label, ftype, options = field_info

                row = field_idx + 1
                ctk.CTkLabel(frame, text=label).grid(row=row, column=0, sticky="w", padx=12, pady=6)

                if ftype == "entry":
                    widget = ctk.CTkEntry(frame)
                    widget.grid(row=row, column=1, sticky="ew", padx=12, pady=6)
                elif ftype == "text":
                    widget = ctk.CTkTextbox(frame, height=60)
                    widget.grid(row=row, column=1, sticky="ew", padx=12, pady=6)
                elif ftype == "combo":
                    widget = ctk.CTkComboBox(frame, values=options)
                    widget.grid(row=row, column=1, sticky="ew", padx=12, pady=6)

                self.form_fields[key] = widget
                frame.grid_columnconfigure(1, weight=1)

        # Save button at bottom
        ctk.CTkButton(
            self.form_scroll,
            text="💾 Save Study",
            command=self._save_study,
            height=40,
            font=ctk.CTkFont(size=14, weight="bold"),
        ).pack(fill="x", padx=20, pady=20)

    def on_enter(self):
        self._update_list()

    def _update_list(self):
        for widget in self.study_list.winfo_children():
            widget.destroy()

        studies = self.app.project_data.get("extraction", {}).get("studies", [])
        for i, study in enumerate(studies):
            btn = ctk.CTkButton(
                self.study_list,
                text=f"{study.get('study_id', f'Study {i+1}')}: {study.get('title', 'Untitled')[:40]}",
                anchor="w",
                height=32,
                command=lambda idx=i: self._load_study(idx),
            )
            btn.pack(fill="x", padx=4, pady=2)

        if not studies:
            ctk.CTkLabel(self.study_list, text="No studies added yet. Click 'Add Study' to begin.").pack(pady=20)

    def _load_study(self, index):
        self._study_index = index
        studies = self.app.project_data.get("extraction", {}).get("studies", [])
        if index >= len(studies):
            return
        self._current_study = studies[index]

        for key, widget in self.form_fields.items():
            value = self._current_study.get(key, "")
            if isinstance(widget, ctk.CTkEntry) or isinstance(widget, ctk.CTkComboBox):
                widget.delete(0, "end")
                if value:
                    widget.insert(0, str(value))
            elif isinstance(widget, ctk.CTkTextbox):
                widget.delete("0.0", "end")
                if value:
                    widget.insert("0.0", str(value))

    def _add_study(self):
        new_study = {key: "" for key in self.form_fields.keys()}
        new_study["study_id"] = f"Study_{len(self.app.project_data.get('extraction', {}).get('studies', [])) + 1}"
        self.app.project_data.setdefault("extraction", {}).setdefault("studies", []).append(new_study)
        self._update_list()
        self._load_study(len(self.app.project_data["extraction"]["studies"]) - 1)

    def _save_study(self):
        if self._current_study is None:
            return

        for key, widget in self.form_fields.items():
            if isinstance(widget, ctk.CTkEntry) or isinstance(widget, ctk.CTkComboBox):
                self._current_study[key] = widget.get()
            elif isinstance(widget, ctk.CTkTextbox):
                self._current_study[key] = widget.get("0.0", "end").strip()

        self.app.project_data.setdefault("extraction", {}).setdefault("studies", [])[
            self._study_index
        ] = self._current_study
        self.app.save_project()
        self._update_list()
        messagebox.showinfo("Saved", "Study data saved")

    def _import_csv(self):
        path = filedialog.askopenfilename(title="Import extraction CSV", filetypes=[("CSV", "*.csv")])
        if not path:
            return
        try:
            df = pd.read_csv(path)
            studies = df.to_dict("records")
            self.app.project_data.setdefault("extraction", {})["studies"] = studies
            self._update_list()
            self.app.save_project()
            messagebox.showinfo("Imported", f"Loaded {len(studies)} studies")
        except Exception as e:
            messagebox.showerror("Error", f"Failed to import:\n{e}")

    def _import_ris(self):
        path = filedialog.askopenfilename(title="Import RIS file", filetypes=[("RIS", "*.ris")])
        if not path:
            return
        try:
            from poolr.import_.ris import parse_ris

            studies = parse_ris(path)
            self.app.project_data.setdefault("extraction", {})["studies"] = studies
            self._update_list()
            self.app.save_project()
            messagebox.showinfo("Imported", f"Loaded {len(studies)} records from RIS")
        except Exception as e:
            messagebox.showerror("Error", f"Failed to import RIS:\n{e}")

    def _export_csv(self):
        studies = self.app.project_data.get("extraction", {}).get("studies", [])
        if not studies:
            messagebox.showwarning("Warning", "No studies to export")
            return
        path = filedialog.asksaveasfilename(
            title="Export extraction CSV", defaultextension=".csv", filetypes=[("CSV", "*.csv")]
        )
        if not path:
            return
        try:
            df = pd.DataFrame(studies)
            df.to_csv(path, index=False)
            messagebox.showinfo("Exported", f"Exported {len(studies)} studies")
        except Exception as e:
            messagebox.showerror("Error", f"Failed to export:\n{e}")

    def _save(self):
        messagebox.showinfo("Saved", "Extraction data saved")
