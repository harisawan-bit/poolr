"""
Screening page - Title/Abstract and Full Text screening with dual independent screening support
"""

import tkinter as tk
from tkinter import filedialog, messagebox

import customtkinter as ctk
import pandas as pd

from poolr.pages.base import BasePage
from poolr.ui import PAD_X, SecondaryButton


class ScreeningPage(BasePage):
    def __init__(self, master, app):
        super().__init__(master, app)
        self._current_mode = "title_abstract"  # or "full_text"
        self._records = []
        self._current_index = 0
        self._reviewer = "reviewer1"  # or "reviewer2"
        self._build()

    def _build(self):
        from poolr.ui import PrimaryButton, SectionHeader

        SectionHeader(
            self,
            "Screening",
            "Dual independent screening with conflict detection and resolution.",
        )

        # Top controls
        top_frame = ctk.CTkFrame(self, fg_color="transparent")
        top_frame.pack(fill="x", padx=PAD_X, pady=(4, 10))

        # Mode selector
        self.mode_var = tk.StringVar(value="title_abstract")
        ctk.CTkSegmentedButton(
            top_frame, values=["Title/Abstract", "Full Text"], variable=self.mode_var, command=self._on_mode_change
        ).pack(side="left", padx=4)

        # Reviewer selector
        self.reviewer_var = tk.StringVar(value="reviewer1")
        ctk.CTkSegmentedButton(
            top_frame,
            values=["Reviewer 1", "Reviewer 2", "Consensus"],
            variable=self.reviewer_var,
            command=self._on_reviewer_change,
        ).pack(side="left", padx=12)

        # Import/export
        btn_frame = ctk.CTkFrame(top_frame, fg_color="transparent")
        btn_frame.pack(side="right", padx=4)
        SecondaryButton(btn_frame, text="📥  Import CSV", command=self._import_csv, height=32).pack(side="left", padx=4)
        SecondaryButton(btn_frame, text="📤  Export CSV", command=self._export_csv, height=32).pack(side="left", padx=4)
        SecondaryButton(btn_frame, text="💾  Save", command=self._save, height=32).pack(side="left", padx=4)
        PrimaryButton(
            btn_frame,
            text="🔍  View Conflicts",
            command=self._view_conflicts,
            height=32,
            fg_color="#F2B84B",
            hover_color="#F4C564",
        ).pack(side="left", padx=4)

        # Main area
        main = ctk.CTkFrame(self)
        main.pack(fill="both", expand=True)
        main.grid_columnconfigure(1, weight=1)
        main.grid_rowconfigure(0, weight=1)

        # Left: Record list
        left = ctk.CTkFrame(main, width=380)
        left.grid(row=0, column=0, sticky="nsew", padx=(0, 8))
        left.grid_rowconfigure(1, weight=1)
        left.grid_propagate(False)

        ctk.CTkLabel(left, text="Records", font=ctk.CTkFont(size=14, weight="bold")).grid(
            row=0, column=0, sticky="w", padx=12, pady=12
        )

        self.record_list = ctk.CTkScrollableFrame(left)
        self.record_list.grid(row=1, column=0, sticky="nsew", padx=8, pady=(0, 12))

        # Right: Record detail
        right = ctk.CTkFrame(main)
        right.grid(row=0, column=1, sticky="nsew")
        right.grid_rowconfigure(1, weight=1)

        self.detail_title = ctk.CTkLabel(right, text="Select a record", font=ctk.CTkFont(size=16, weight="bold"))
        self.detail_title.grid(row=0, column=0, sticky="w", padx=16, pady=(16, 8))

        self.detail_text = ctk.CTkTextbox(right, font=ctk.CTkFont(size=12))
        self.detail_text.grid(row=1, column=0, sticky="nsew", padx=16, pady=(0, 16))
        right.grid_columnconfigure(0, weight=1)

        # Decision buttons
        decision_frame = ctk.CTkFrame(right, fg_color="transparent")
        decision_frame.grid(row=2, column=0, sticky="ew", padx=16, pady=(0, 16))
        self.include_btn = ctk.CTkButton(
            decision_frame,
            text="✅  Include",
            command=lambda: self._decide(True),
            height=44,
            fg_color="#3FB950",
            hover_color="#46C758",
            font=ctk.CTkFont(size=14, weight="bold"),
        )
        self.include_btn.pack(side="left", padx=8, expand=True, fill="x")
        self.exclude_btn = ctk.CTkButton(
            decision_frame,
            text="❌  Exclude",
            command=lambda: self._decide(False),
            height=44,
            fg_color="#F05252",
            hover_color="#F76B6B",
            font=ctk.CTkFont(size=14, weight="bold"),
        )
        self.exclude_btn.pack(side="left", padx=8, expand=True, fill="x")
        self.unsure_btn = ctk.CTkButton(
            decision_frame,
            text="❓  Unsure",
            command=lambda: self._decide(None),
            height=44,
            fg_color="#F2B84B",
            hover_color="#F4C564",
            font=ctk.CTkFont(size=14, weight="bold"),
        )
        self.unsure_btn.pack(side="left", padx=8, expand=True, fill="x")

        # Reason entry
        self.reason_frame = ctk.CTkFrame(right, fg_color="transparent")
        self.reason_frame.grid(row=3, column=0, sticky="ew", padx=16, pady=(0, 16))
        ctk.CTkLabel(self.reason_frame, text="Exclusion reason:").pack(anchor="w")
        self.reason_entry = ctk.CTkEntry(self.reason_frame, placeholder_text="Reason for exclusion...")
        self.reason_entry.pack(fill="x", pady=(4, 0))
        self.reason_frame.grid_remove()

    def on_enter(self):
        self._load_records()
        self._update_list()

    def _on_mode_change(self, value):
        self._current_mode = "title_abstract" if value == "Title/Abstract" else "full_text"
        self._load_records()
        self._update_list()

    def _on_reviewer_change(self, value):
        self._reviewer = (
            "reviewer1" if value == "Reviewer 1" else ("reviewer2" if value == "Reviewer 2" else "consensus")
        )
        self._load_records()
        self._update_list()

    def _load_records(self):
        mode_key = "title_abstract" if self._current_mode == "title_abstract" else "full_text"
        self._records = self.app.project_data.get("screening", {}).get(mode_key, [])
        self._current_index = 0

    def _update_list(self):
        for widget in self.record_list.winfo_children():
            widget.destroy()

        for i, rec in enumerate(self._records):
            # Determine status color based on reviewer decisions
            r1 = rec.get("decision_reviewer1")
            r2 = rec.get("decision_reviewer2")

            if self._reviewer == "consensus":
                # Show consensus status
                if r1 is True and r2 is True:
                    color = "green"
                    icon = "✅"
                elif r1 is False and r2 is False:
                    color = "red"
                    icon = "❌"
                elif r1 is not None and r2 is not None and r1 != r2:
                    color = "orange"
                    icon = "⚠️"
                else:
                    color = "gray"
                    icon = "⏳"
            elif self._reviewer == "reviewer1":
                decision = r1
                if decision is True:
                    color, icon = "green", "✅"
                elif decision is False:
                    color, icon = "red", "❌"
                elif decision is None:
                    color, icon = "orange", "❓"
                else:
                    color, icon = "gray", "⏳"
            else:  # reviewer2
                decision = r2
                if decision is True:
                    color, icon = "green", "✅"
                elif decision is False:
                    color, icon = "red", "❌"
                elif decision is None:
                    color, icon = "orange", "❓"
                else:
                    color, icon = "gray", "⏳"

            btn = ctk.CTkButton(
                self.record_list,
                text=f"{icon} {rec.get('title', 'Untitled')[:60]}",
                anchor="w",
                height=32,
                fg_color="transparent",
                text_color=color,
                command=lambda idx=i: self._select_record(idx),
            )
            btn.pack(fill="x", padx=4, pady=2)

        if not self._records:
            ctk.CTkLabel(self.record_list, text="No records loaded. Click 'Import CSV' to start.").pack(pady=20)

    def _select_record(self, index):
        self._current_index = index
        self._show_record(index)

    def _show_record(self, index):
        if index >= len(self._records):
            return
        rec = self._records[index]
        self.detail_title.configure(text=rec.get("title", "Untitled"))
        self.detail_text.delete("0.0", "end")

        details = f"Authors: {rec.get('authors', 'N/A')}\n"
        details += f"Year: {rec.get('year', 'N/A')}\n"
        details += f"Journal: {rec.get('journal', 'N/A')}\n"
        details += f"DOI: {rec.get('doi', 'N/A')}\n\n"
        details += f"Abstract:\n{rec.get('abstract', 'No abstract available')}"

        self.detail_text.insert("0.0", details)

        # Update button states based on current reviewer
        decision = rec.get(f"decision_{self._reviewer}") if self._reviewer != "consensus" else None

        if self._reviewer == "consensus":
            r1 = rec.get("decision_reviewer1")
            r2 = rec.get("decision_reviewer2")
            if r1 is True and r2 is True:
                self.include_btn.configure(fg_color="darkgreen")
            elif r1 is False and r2 is False:
                self.exclude_btn.configure(fg_color="darkred")
            elif r1 != r2 and r1 is not None and r2 is not None:
                # Conflict!
                self.include_btn.configure(fg_color="green")
                self.exclude_btn.configure(fg_color="red")
                self.unsure_btn.configure(fg_color="orange")
            else:
                self.include_btn.configure(fg_color="green")
                self.exclude_btn.configure(fg_color="red")
                self.unsure_btn.configure(fg_color="orange")
            self.reason_frame.grid_remove()
        else:
            if decision is True:
                self.include_btn.configure(fg_color="darkgreen")
                self.exclude_btn.configure(fg_color="red")
                self.unsure_btn.configure(fg_color="orange")
                self.reason_frame.grid_remove()
            elif decision is False:
                self.include_btn.configure(fg_color="green")
                self.exclude_btn.configure(fg_color="darkred")
                self.unsure_btn.configure(fg_color="orange")
                self.reason_entry.delete(0, "end")
                self.reason_entry.insert(0, rec.get(f"reason_{self._reviewer}", ""))
                self.reason_frame.grid()
            elif decision is None:
                self.include_btn.configure(fg_color="green")
                self.exclude_btn.configure(fg_color="red")
                self.unsure_btn.configure(fg_color="darkorange")
                self.reason_frame.grid_remove()
            else:
                self.include_btn.configure(fg_color="green")
                self.exclude_btn.configure(fg_color="red")
                self.unsure_btn.configure(fg_color="orange")
                self.reason_frame.grid_remove()

    def _decide(self, decision):
        if self._current_index >= len(self._records) or self._reviewer == "consensus":
            return

        self._records[self._current_index][f"decision_{self._reviewer}"] = decision
        if decision is False:
            self._records[self._current_index][f"reason_{self._reviewer}"] = self.reason_entry.get()

        self._save_current_mode()
        self._update_list()
        self._show_record(self._current_index)

    def _import_csv(self):
        path = filedialog.askopenfilename(title="Import screening CSV", filetypes=[("CSV", "*.csv")])
        if not path:
            return

        try:
            df = pd.read_csv(path)
            required = ["title"]
            for col in required:
                if col not in df.columns:
                    messagebox.showerror("Error", f"CSV must contain '{col}' column")
                    return

            # Ensure all expected columns exist
            for col in ["authors", "year", "journal", "doi", "abstract"]:
                if col not in df.columns:
                    df[col] = ""

            records = df.to_dict("records")
            mode_key = "title_abstract" if self._current_mode == "title_abstract" else "full_text"
            self.app.project_data.setdefault("screening", {})[mode_key] = records

            self._load_records()
            self._update_list()
            self.app.save_project()
            messagebox.showinfo("Imported", f"Loaded {len(records)} records from CSV")
        except Exception as e:
            messagebox.showerror("Error", f"Failed to import CSV:\n{e}")

    def _export_csv(self):
        if not self._records:
            messagebox.showwarning("Warning", "No records to export")
            return
        path = filedialog.asksaveasfilename(
            title="Export screening CSV", defaultextension=".csv", filetypes=[("CSV", "*.csv")]
        )
        if not path:
            return

        try:
            df = pd.DataFrame(self._records)
            df.to_csv(path, index=False)
            messagebox.showinfo("Exported", f"Exported {len(self._records)} records to:\n{path}")
        except Exception as e:
            messagebox.showerror("Error", f"Failed to export CSV:\n{e}")

    def _save(self):
        self._save_current_mode()
        messagebox.showinfo("Saved", "Screening decisions saved")

    def _save_current_mode(self):
        mode_key = "title_abstract" if self._current_mode == "title_abstract" else "full_text"
        self.app.project_data.setdefault("screening", {})[mode_key] = self._records
        self.app.save_project()

    def _view_conflicts(self):
        """Show conflicts between reviewers"""
        mode_key = "title_abstract" if self._current_mode == "title_abstract" else "full_text"
        records = self.app.project_data.get("screening", {}).get(mode_key, [])

        conflicts = []
        for i, rec in enumerate(records):
            r1 = rec.get("decision_reviewer1")
            r2 = rec.get("decision_reviewer2")
            if r1 is not None and r2 is not None and r1 != r2:
                conflicts.append((i, rec, r1, r2))

        if not conflicts:
            messagebox.showinfo("No Conflicts", "No conflicts found between reviewers")
            return

        # Show conflict resolution dialog
        self._show_conflict_dialog(conflicts)

    def _show_conflict_dialog(self, conflicts):
        dialog = ctk.CTkToplevel(self)
        dialog.title("Conflict Resolution")
        dialog.geometry("800x600")
        dialog.grab_set()

        ctk.CTkLabel(dialog, text=f"Found {len(conflicts)} conflicts", font=ctk.CTkFont(size=16, weight="bold")).pack(
            pady=16
        )

        scroll = ctk.CTkScrollableFrame(dialog)
        scroll.pack(fill="both", expand=True, padx=16, pady=(0, 16))

        for idx, rec, r1, r2 in conflicts:
            frame = ctk.CTkFrame(scroll)
            frame.pack(fill="x", padx=8, pady=8)

            ctk.CTkLabel(frame, text=rec.get("title", "Untitled")[:80], font=ctk.CTkFont(size=13, weight="bold")).pack(
                anchor="w", padx=12, pady=(8, 4)
            )
            ctk.CTkLabel(
                frame,
                text=f"Reviewer 1: {'Include' if r1 else 'Exclude'} | Reviewer 2: {'Include' if r2 else 'Exclude'}",
            ).pack(anchor="w", padx=12)

            btn_frame = ctk.CTkFrame(frame, fg_color="transparent")
            btn_frame.pack(fill="x", padx=12, pady=8)

            def resolve(inc, i=idx, r=rec):
                if inc:
                    r["decision_reviewer1"] = True
                    r["decision_reviewer2"] = True
                else:
                    r["decision_reviewer1"] = False
                    r["decision_reviewer2"] = False
                self._save_current_mode()
                self._update_list()
                dialog.destroy()
                self._show_conflict_dialog(conflicts)

            ctk.CTkButton(
                btn_frame, text="✅ Resolve as Include", command=lambda: resolve(True), fg_color="green"
            ).pack(side="left", padx=4)
            ctk.CTkButton(btn_frame, text="❌ Resolve as Exclude", command=lambda: resolve(False), fg_color="red").pack(
                side="left", padx=4
            )
            ctk.CTkButton(btn_frame, text="⏭ Skip", command=lambda: None).pack(side="left", padx=4)
