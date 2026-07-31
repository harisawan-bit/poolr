"""
Risk of Bias page - RoB 2, NOS, PROBAST
"""

import tkinter as tk
from tkinter import messagebox

import customtkinter as ctk

from poolr.pages.base import BasePage
from poolr.ui import PAD_X, PrimaryButton, SecondaryButton, SectionHeader


class RoBPage(BasePage):
    def __init__(self, master, app):
        super().__init__(master, app)
        self._build()

    def _build(self):
        SectionHeader(
            self,
            "Risk of Bias Assessment",
            "RoB 2, Newcastle-Ottawa, and PROBAST — domain-level judgments with overall ratings.",
        )

        # Top controls
        top = ctk.CTkFrame(self, fg_color="transparent")
        top.pack(fill="x", padx=PAD_X, pady=(4, 10))

        # Tool selector
        self.tool_var = tk.StringVar(value="rob2")
        ctk.CTkSegmentedButton(
            top, values=["RoB 2", "NOS", "PROBAST"], variable=self.tool_var, command=self._on_tool_change
        ).pack(side="left", padx=4)

        btn_frame = ctk.CTkFrame(top, fg_color="transparent")
        btn_frame.pack(side="right")
        SecondaryButton(btn_frame, text="➕  Add Assessment", command=self._add_assessment, height=34).pack(
            side="left", padx=4
        )
        SecondaryButton(btn_frame, text="💾  Save", command=self._save, height=34).pack(side="left", padx=4)

        # Main area
        self.form_area = ctk.CTkScrollableFrame(self, fg_color="transparent")
        self.form_area.pack(fill="both", expand=True, padx=PAD_X, pady=(0, 8))
        self.form_area.grid_columnconfigure(0, weight=1)

        self._build_rob2_form()
        self._build_nos_form()
        self._build_probast_form()

        self.rob2_frame.pack(fill="x", padx=16, pady=12)
        self.nos_frame.pack_forget()
        self.probast_frame.pack_forget()

        # Save button
        PrimaryButton(
            self,
            text="💾  Save Assessment",
            command=self._save_assessment,
            height=42,
        ).pack(fill="x", padx=20, pady=16)

    def _build_rob2_form(self):
        self.rob2_frame = ctk.CTkFrame(self.form_area)
        self.rob2_fields = {}

        ctk.CTkLabel(self.rob2_frame, text="RoB 2 (RCTs)", font=ctk.CTkFont(size=16, weight="bold")).pack(
            anchor="w", padx=12, pady=(12, 8)
        )

        rob2_domains = [
            ("randomization", "Bias arising from the randomization process"),
            ("deviations", "Bias due to deviations from intended interventions"),
            ("missing_data", "Bias due to missing outcome data"),
            ("measurement", "Bias in measurement of the outcome"),
            ("selection", "Bias in selection of the reported result"),
        ]

        for i, (key, label) in enumerate(rob2_domains):
            frame = ctk.CTkFrame(self.rob2_frame)
            frame.pack(fill="x", padx=12, pady=8)
            frame.grid_columnconfigure(1, weight=1)

            ctk.CTkLabel(frame, text=label, font=ctk.CTkFont(size=12)).grid(
                row=0, column=0, sticky="w", padx=12, pady=12
            )

            combo = ctk.CTkComboBox(frame, values=["Low", "Some concerns", "High", "No information"])
            combo.grid(row=0, column=1, padx=12, pady=12, sticky="ew")
            combo.set("Low")
            self.rob2_fields[key] = combo
            frame.grid_columnconfigure(1, weight=1)

        # Overall
        frame = ctk.CTkFrame(self.rob2_frame)
        frame.pack(fill="x", padx=12, pady=8)
        frame.grid_columnconfigure(1, weight=1)
        ctk.CTkLabel(frame, text="Overall Risk of Bias", font=ctk.CTkFont(size=12, weight="bold")).grid(
            row=0, column=0, sticky="w", padx=12, pady=12
        )
        self.rob2_fields["overall"] = ctk.CTkComboBox(frame, values=["Low", "Some concerns", "High"])
        self.rob2_fields["overall"].grid(row=0, column=1, padx=12, pady=12, sticky="ew")
        self.rob2_fields["overall"].set("Low")
        frame.grid_columnconfigure(1, weight=1)

    def _build_nos_form(self):
        self.nos_frame = ctk.CTkFrame(self.form_area)
        self.nos_fields = {}

        ctk.CTkLabel(
            self.nos_frame, text="Newcastle-Ottawa Scale (Cohort Studies)", font=ctk.CTkFont(size=16, weight="bold")
        ).pack(anchor="w", padx=12, pady=(12, 8))

        # Selection
        ctk.CTkLabel(self.nos_frame, text="Selection (max 4 stars)", font=ctk.CTkFont(size=13, weight="bold")).pack(
            anchor="w", padx=12, pady=(8, 4)
        )
        nos_selection = [
            ("representativeness", "Representativeness of the exposed cohort"),
            ("selection", "Selection of the non-exposed cohort"),
            ("ascertainment", "Ascertainment of exposure"),
            ("outcome", "Demonstration that outcome of interest was not present at start"),
        ]
        for key, label in nos_selection:
            frame = ctk.CTkFrame(self.nos_frame)
            frame.pack(fill="x", padx=12, pady=4)
            frame.grid_columnconfigure(1, weight=1)
            ctk.CTkLabel(frame, text=label).grid(row=0, column=0, sticky="w", padx=12, pady=8)
            combo = ctk.CTkComboBox(frame, values=["★", "☆"])
            combo.grid(row=0, column=1, padx=12, pady=8)
            combo.set("★")
            self.nos_fields[key] = combo
            frame.grid_columnconfigure(1, weight=1)

        # Comparability
        ctk.CTkLabel(self.nos_frame, text="Comparability (max 2 stars)", font=ctk.CTkFont(size=13, weight="bold")).pack(
            anchor="w", padx=12, pady=(8, 4)
        )
        for key, label in [
            ("comparability1", "Study controls for most important factor"),
            ("comparability2", "Study controls for additional factor"),
        ]:
            frame = ctk.CTkFrame(self.nos_frame)
            frame.pack(fill="x", padx=12, pady=4)
            frame.grid_columnconfigure(1, weight=1)
            ctk.CTkLabel(frame, text=label).grid(row=0, column=0, sticky="w", padx=12, pady=8)
            combo = ctk.CTkComboBox(frame, values=["★", "☆"])
            combo.grid(row=0, column=1, padx=12, pady=8)
            combo.set("★")
            self.nos_fields[key] = combo
            frame.grid_columnconfigure(1, weight=1)

        # Outcome
        ctk.CTkLabel(self.nos_frame, text="Outcome (max 3 stars)", font=ctk.CTkFont(size=13, weight="bold")).pack(
            anchor="w", padx=12, pady=(8, 4)
        )
        for key, label in [
            ("assessment", "Assessment of outcome"),
            ("followup", "Follow-up long enough"),
            ("adequacy", "Adequacy of follow-up"),
        ]:
            frame = ctk.CTkFrame(self.nos_frame)
            frame.pack(fill="x", padx=12, pady=4)
            frame.grid_columnconfigure(1, weight=1)
            ctk.CTkLabel(frame, text=label).grid(row=0, column=0, sticky="w", padx=12, pady=8)
            combo = ctk.CTkComboBox(frame, values=["★", "☆"])
            combo.grid(row=0, column=1, padx=12, pady=8)
            combo.set("★")
            self.nos_fields[key] = combo
            frame.grid_columnconfigure(1, weight=1)

        # Total
        frame = ctk.CTkFrame(self.nos_frame)
        frame.pack(fill="x", padx=12, pady=8)
        frame.grid_columnconfigure(1, weight=1)
        ctk.CTkLabel(frame, text="Total Score (0-9)", font=ctk.CTkFont(size=13, weight="bold")).grid(
            row=0, column=0, sticky="w", padx=12, pady=12
        )
        self.nos_fields["total"] = ctk.CTkEntry(frame)
        self.nos_fields["total"].grid(row=0, column=1, padx=12, pady=12, sticky="ew")
        self.nos_fields["total"].insert(0, "0")
        frame.grid_columnconfigure(1, weight=1)

    def _build_probast_form(self):
        self.probast_frame = ctk.CTkFrame(self.form_area)
        self.probast_fields = {}

        ctk.CTkLabel(
            self.probast_frame, text="PROBAST (Diagnostic/Prognostic Studies)", font=ctk.CTkFont(size=16, weight="bold")
        ).pack(anchor="w", padx=12, pady=(12, 8))

        domains = [
            ("participants", "Participants", ["Low", "High", "Unclear"]),
            ("predictors", "Predictors", ["Low", "High", "Unclear"]),
            ("outcome", "Outcome", ["Low", "High", "Unclear"]),
            ("analysis", "Analysis", ["Low", "High", "Unclear"]),
        ]

        for key, label, values in domains:
            frame = ctk.CTkFrame(self.probast_frame)
            frame.pack(fill="x", padx=12, pady=8)
            frame.grid_columnconfigure(1, weight=1)
            ctk.CTkLabel(frame, text=label, font=ctk.CTkFont(size=12)).grid(
                row=0, column=0, sticky="w", padx=12, pady=12
            )
            combo = ctk.CTkComboBox(frame, values=values)
            combo.grid(row=0, column=1, padx=12, pady=12, sticky="ew")
            combo.set("Low")
            self.probast_fields[key] = combo
            frame.grid_columnconfigure(1, weight=1)

        # Applicability
        ctk.CTkLabel(self.probast_frame, text="Applicability Concerns", font=ctk.CTkFont(size=13, weight="bold")).pack(
            anchor="w", padx=12, pady=(12, 8)
        )
        for key, label in [
            ("app_participants", "Participants"),
            ("app_predictors", "Predictors"),
            ("app_outcome", "Outcome"),
        ]:
            frame = ctk.CTkFrame(self.probast_frame)
            frame.pack(fill="x", padx=12, pady=8)
            frame.grid_columnconfigure(1, weight=1)
            ctk.CTkLabel(frame, text=label).grid(row=0, column=0, sticky="w", padx=12, pady=12)
            combo = ctk.CTkComboBox(frame, values=["Low", "High", "Unclear"])
            combo.grid(row=0, column=1, padx=12, pady=12, sticky="ew")
            combo.set("Low")
            self.probast_fields[key] = combo
            frame.grid_columnconfigure(1, weight=1)

    def _on_tool_change(self, value):
        self.rob2_frame.pack_forget()
        self.nos_frame.pack_forget()
        self.probast_frame.pack_forget()

        if value == "RoB 2":
            self.rob2_frame.pack(fill="x", padx=16, pady=12)
        elif value == "NOS":
            self.nos_frame.pack(fill="x", padx=16, pady=12)
        elif value == "PROBAST":
            self.probast_frame.pack(fill="x", padx=16, pady=12)

    def _add_assessment(self):
        # Create new assessment based on current tool
        assessment = {
            "tool": self.tool_var.get(),
            "study_id": "",
            "data": {},
        }
        self.app.project_data.setdefault("rob", {}).setdefault("assessments", []).append(assessment)
        messagebox.showinfo("Added", "New assessment added. Fill in the form and save.")

    def _save_assessment(self):
        assessments = self.app.project_data.get("rob", {}).get("assessments", [])
        if not assessments:
            messagebox.showwarning("Warning", "No assessments to save. Click 'Add Assessment' first.")
            return

        # Save current form data to the last assessment
        data = {}
        tool = self.tool_var.get()
        if tool == "RoB 2":
            for key, widget in self.rob2_fields.items():
                data[key] = widget.get()
        elif tool == "NOS":
            for key, widget in self.nos_fields.items():
                if isinstance(widget, ctk.CTkComboBox):
                    data[key] = widget.get()
                else:
                    data[key] = widget.get()
        elif tool == "PROBAST":
            for key, widget in self.probast_fields.items():
                data[key] = widget.get()

        assessments[-1]["data"] = data
        assessments[-1]["tool"] = tool
        self.app.save_project()
        messagebox.showinfo("Saved", "Risk of bias assessment saved")

    def _save(self):
        self._save_assessment()
