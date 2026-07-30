"""
Protocol / PICO page
"""

import json
from tkinter import messagebox

import customtkinter as ctk

from poolr.pages.base import BasePage


class ProtocolPage(BasePage):
    def __init__(self, master, app):
        super().__init__(master, app)
        self._build()

    def _build(self):
        # Scrollable frame
        self.scroll = ctk.CTkScrollableFrame(self)
        self.scroll.pack(fill="both", expand=True)
        self.scroll.grid_columnconfigure(0, weight=1)

        # PICO Section
        ctk.CTkLabel(self.scroll, text="PICO Definition", font=ctk.CTkFont(size=20, weight="bold")).grid(
            row=0, column=0, sticky="w", pady=(0, 12)
        )

        pico_help = "Define your Population, Intervention, Comparator, and Outcomes clearly. This forms the foundation of your systematic review."
        ctk.CTkLabel(self.scroll, text=pico_help, wraplength=800, justify="left").grid(
            row=1, column=0, sticky="w", pady=(0, 16)
        )

        self.entries = {}
        pico_fields = [
            ("Population", "population", "e.g., Adults with traumatic brain injury (GCS ≤ 8)"),
            ("Intervention", "intervention", "e.g., Decompressive craniectomy within 48 hours"),
            ("Comparator", "comparator", "e.g., Medical management alone (ICP monitoring, osmotherapy)"),
            ("Outcomes", "outcomes", "e.g., Mortality at 6 months; Glasgow Outcome Scale at 12 months"),
        ]

        for i, (label, key, placeholder) in enumerate(pico_fields):
            row = i + 2
            ctk.CTkLabel(self.scroll, text=label, font=ctk.CTkFont(size=14, weight="bold")).grid(
                row=row, column=0, sticky="w", pady=(16, 4)
            )
            entry = ctk.CTkTextbox(self.scroll, height=80)
            entry.grid(row=row + 1, column=0, sticky="ew", pady=(0, 4))
            self.entries[key] = entry

            # Placeholder
            if not self.app.project_data.get("pico", {}).get(key):
                entry.insert("0.0", placeholder)
                entry.configure(text_color=("gray50", "gray50"))
            else:
                entry.insert("0.0", self.app.project_data.get("pico", {}).get(key, ""))
                entry.configure(text_color=("gray10", "gray90"))

        # Additional protocol fields
        ctk.CTkLabel(self.scroll, text="Additional Protocol Details", font=ctk.CTkFont(size=18, weight="bold")).grid(
            row=10, column=0, sticky="w", pady=(20, 12)
        )

        self.additional_fields = {}
        add_fields = [
            ("Study Designs", "study_designs", "RCTs, cohort studies, case-control"),
            ("Date Range", "date_range", "2000-01-01 to 2024-12-31"),
            ("Languages", "languages", "English"),
            ("Databases", "databases", "PubMed, Embase, Cochrane CENTRAL, Scopus"),
            ("Registration", "registration", "PROSPERO ID: CRD..."),
        ]

        for i, (label, key, placeholder) in enumerate(add_fields):
            row = 11 + i * 2
            ctk.CTkLabel(self.scroll, text=label).grid(row=row, column=0, sticky="w", pady=(8, 2))
            entry = ctk.CTkEntry(self.scroll)
            entry.grid(row=row + 1, column=0, sticky="ew", pady=(0, 4))
            entry.insert(0, placeholder)
            entry.configure(text_color=("gray50", "gray50"))
            self.additional_fields[key] = entry

        # Save button
        btn_frame = ctk.CTkFrame(self.scroll, fg_color="transparent")
        btn_frame.grid(row=22, column=0, sticky="ew", pady=24)
        ctk.CTkButton(
            btn_frame, text="💾 Save Protocol", command=self._save, height=40, font=ctk.CTkFont(size=14, weight="bold")
        ).pack(side="right")
        ctk.CTkButton(btn_frame, text="📄 Export Protocol", command=self._export_protocol, height=40).pack(
            side="right", padx=8
        )

    def on_enter(self):
        self.refresh()

    def refresh(self):
        pico = self.app.project_data.get("pico", {})
        for key, entry in self.entries.items():
            entry.delete("0.0", "end")
            if pico.get(key):
                entry.insert("0.0", pico[key])
                entry.configure(text_color=("gray10", "gray90"))

        proto = self.app.project_data.get("protocol", {})
        for key, entry in self.additional_fields.items():
            entry.delete(0, "end")
            if proto.get(key):
                entry.insert(0, proto[key])
                entry.configure(text_color=("gray10", "gray90"))

    def _save(self):
        pico_data = {}
        for key, entry in self.entries.items():
            text = entry.get("0.0", "end").strip()
            if text and not text.startswith("e.g."):
                pico_data[key] = text
        self.app.project_data["pico"] = pico_data

        proto_data = {}
        for key, entry in self.additional_fields.items():
            text = entry.get().strip()
            if text and not text.startswith("e.g.") and not text.startswith("RCTs") and not text.startswith("2000"):
                proto_data[key] = text
        self.app.project_data["protocol"] = proto_data

        self.app.save_project()
        messagebox.showinfo("Saved", "Protocol saved to poolr.json")
        self.app._update_progress()

    def _export_protocol(self):
        if not self.app.project_path:
            messagebox.showwarning("Warning", "No project open")
            return
        report = {
            "pico": self.app.project_data.get("pico", {}),
            "protocol": self.app.project_data.get("protocol", {}),
        }
        path = self.app.project_path / "protocol_report.json"
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(report, fh, indent=2)
        messagebox.showinfo("Exported", f"Protocol exported to:\n{path}")
