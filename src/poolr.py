#!/usr/bin/env python3
"""
poolr — standalone GUI for systematic reviews and meta-analyses.
Platform: Windows / macOS / Linux
GUI: CustomTkinter
"""

import customtkinter as ctk
import tkinter as tk
from tkinter import filedialog, messagebox, ttk
import json
import os
import pandas as pd
from pathlib import Path
import webbrowser
import threading
import traceback

ctk.set_appearance_mode("dark")
ctk.set_default_color_theme("dark-blue")


class PoolrApp(ctk.CTk):
    def __init__(self):
        super().__init__()

        self.title("poolr — Systematic Review & Meta-Analysis")
        self.geometry("1200x800")
        self.minsize(1000, 700)

        self.project_path = None
        self.project_data = self._get_empty_project()
        self._current_page_key = None
        self._pages = {}

        self.grid_columnconfigure(1, weight=1)
        self.grid_rowconfigure(0, weight=1)

        self._build_sidebar()
        self._build_main_area()
        self._build_menu()

        # Defer initial page selection until all widgets are realized.
        self.after_idle(self._load_dashboard)

    def _load_dashboard(self):
        self._select_page("dashboard")


    def _get_empty_project(self):
        return {
            "pico": {},
            "search_strategies": {},
            "screening": {
                "title_abstract": [],
                "full_text": []
            },
            "extraction": {"studies": []},
            "rob": {"assessments": []},
            "meta": {"results": {}},
            "metadata": {
                "created": "",
                "modified": "",
                "version": "0.2.0"
            }
        }

    def _build_menu(self):
        menubar = tk.Menu(self)
        self.config(menu=menubar)

        file_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="File", menu=file_menu)
        file_menu.add_command(label="New Project", command=self._new_project, accelerator="Ctrl+N")
        file_menu.add_command(label="Open Project", command=self._open_project, accelerator="Ctrl+O")
        file_menu.add_separator()
        file_menu.add_command(label="Save Project", command=self.save_project, accelerator="Ctrl+S")
        file_menu.add_command(label="Export Report", command=self._export_report)
        file_menu.add_separator()
        file_menu.add_command(label="Exit", command=self.quit)

        edit_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="Edit", menu=edit_menu)
        edit_menu.add_command(label="Preferences", command=self._show_preferences)

        view_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="View", menu=view_menu)
        self._theme_var = tk.StringVar(value="dark")
        view_menu.add_radiobutton(label="Dark Mode", variable=self._theme_var, value="dark", command=lambda: ctk.set_appearance_mode("dark"))
        view_menu.add_radiobutton(label="Light Mode", variable=self._theme_var, value="light", command=lambda: ctk.set_appearance_mode("light"))
        view_menu.add_radiobutton(label="System", variable=self._theme_var, value="system", command=lambda: ctk.set_appearance_mode("system"))

        help_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="Help", menu=help_menu)
        help_menu.add_command(label="Documentation", command=lambda: webbrowser.open("https://github.com/harisawan-bit/poolr"))
        help_menu.add_command(label="Report Issue", command=lambda: webbrowser.open("https://github.com/harisawan-bit/poolr/issues"))
        help_menu.add_separator()
        help_menu.add_command(label="About", command=self._show_about)

        # Keyboard shortcuts
        self.bind("<Control-n>", lambda e: self._new_project())
        self.bind("<Control-o>", lambda e: self._open_project())
        self.bind("<Control-s>", lambda e: self.save_project())

    def _build_sidebar(self):
        self.sidebar = ctk.CTkFrame(self, width=240, corner_radius=0)
        self.sidebar.grid(row=0, column=0, sticky="nsew")
        self.sidebar.grid_rowconfigure(8, weight=1)

        ctk.CTkLabel(self.sidebar, text="poolr", font=ctk.CTkFont(size=24, weight="bold")).grid(
            row=0, column=0, padx=20, pady=(20, 5)
        )
        ctk.CTkLabel(self.sidebar, text="SRMA Studio", font=ctk.CTkFont(size=12)).grid(
            row=1, column=0, padx=20, pady=(0, 20)
        )

        self.nav_buttons = {}
        pages = [
            ("📊 Dashboard", "dashboard"),
            ("📋 Protocol / PICO", "protocol"),
            ("🔍 Search", "search"),
            ("☑️ Screening", "screening"),
            ("📝 Extraction", "extraction"),
            ("⚠️ Risk of Bias", "rob"),
            ("📈 Meta-Analysis", "meta"),
            ("📄 PRISMA", "prisma"),
        ]
        for idx, (label, key) in enumerate(pages, start=2):
            btn = ctk.CTkButton(self.sidebar, text=label, anchor="w", height=40, 
                               font=ctk.CTkFont(size=13), command=lambda k=key: self._select_page(k))
            btn.grid(row=idx, column=0, padx=12, pady=3, sticky="ew")
            self.nav_buttons[key] = btn

        self.project_btn = ctk.CTkButton(self.sidebar, text="📁 Open Project", command=self._open_project, height=36)
        self.project_btn.grid(row=10, column=0, padx=16, pady=(0, 8), sticky="ew")

        self.new_project_btn = ctk.CTkButton(self.sidebar, text="➕ New Project", command=self._new_project, height=36)
        self.new_project_btn.grid(row=11, column=0, padx=16, pady=(0, 8), sticky="ew")

        # Progress indicator
        self.progress_frame = ctk.CTkFrame(self.sidebar)
        self.progress_frame.grid(row=12, column=0, padx=16, pady=8, sticky="ew")
        self.progress_frame.grid_columnconfigure(0, weight=1)
        ctk.CTkLabel(self.progress_frame, text="Progress", font=ctk.CTkFont(size=11, weight="bold")).pack(anchor="w", padx=8, pady=(8, 2))
        self.progress_bar = ctk.CTkProgressBar(self.progress_frame)
        self.progress_bar.pack(fill="x", padx=8, pady=(0, 8))
        self.progress_bar.set(0)
        self.progress_label = ctk.CTkLabel(self.progress_frame, text="0% complete", font=ctk.CTkFont(size=10))
        self.progress_label.pack(anchor="w", padx=8, pady=(0, 8))

        self.status_label = ctk.CTkLabel(self.sidebar, text="No project loaded", font=ctk.CTkFont(size=11))
        self.status_label.grid(row=13, column=0, padx=20, pady=(0, 20))

    def _build_main_area(self):
        self.main_area = ctk.CTkFrame(self, corner_radius=10)
        self.main_area.grid(row=0, column=1, sticky="nsew", padx=16, pady=16)
        self.main_area.grid_rowconfigure(1, weight=1)
        self.main_area.grid_columnconfigure(0, weight=1)

        self.title_label = ctk.CTkLabel(self.main_area, text="Dashboard", font=ctk.CTkFont(size=28, weight="bold"))
        self.title_label.grid(row=0, column=0, padx=24, pady=(24, 12), sticky="w")

        self.page_container = ctk.CTkFrame(self.main_area, fg_color="transparent")
        self.page_container.grid(row=1, column=0, sticky="nsew", padx=24, pady=(12, 24))

    def _select_page(self, key):
        # Save current page data if needed
        if self._current_page_key and self._current_page_key in self._pages:
            page = self._pages[self._current_page_key]
            if hasattr(page, 'on_leave'):
                page.on_leave()

        for widget in self.page_container.winfo_children():
            widget.destroy()

        page = self._pages.get(key)
        if page is None:
            if key == "dashboard":
                page = DashboardPage(self.page_container, app=self)
            elif key == "protocol":
                page = ProtocolPage(self.page_container, app=self)
            elif key == "search":
                page = SearchPage(self.page_container, app=self)
            elif key == "screening":
                page = ScreeningPage(self.page_container, app=self)
            elif key == "extraction":
                page = ExtractionPage(self.page_container, app=self)
            elif key == "rob":
                page = RoBPage(self.page_container, app=self)
            elif key == "meta":
                page = MetaPage(self.page_container, app=self)
            elif key == "prisma":
                page = PrismaPage(self.page_container, app=self)
            else:
                page = ctk.CTkLabel(self.page_container, text="Coming soon")
            self._pages[key] = page

        page.pack(fill="both", expand=True)
        self.title_label.configure(text=self.nav_buttons[key].cget("text") if key != "dashboard" else "📊 Dashboard")
        self._current_page_key = key

        # Call on_enter if exists
        if hasattr(page, 'on_enter'):
            page.on_enter()

        for k, btn in self.nav_buttons.items():
            btn.configure(fg_color=("gray75", "gray25") if k == key else "transparent")

        self._update_progress()

    def _new_project(self):
        path = filedialog.askdirectory(title="Create new poolr project folder")
        if path:
            self.project_path = Path(path)
            self.project_data = self._get_empty_project()
            from datetime import datetime
            self.project_data["metadata"]["created"] = datetime.now().isoformat()
            self.project_data["metadata"]["modified"] = datetime.now().isoformat()
            self.status_label.configure(text=f"Project: {self.project_path.name}")
            self.save_project()
            self._refresh_all_pages()
            messagebox.showinfo("Success", f"New project created at:\n{self.project_path}")

    def _open_project(self):
        path = filedialog.askdirectory(title="Open poolr project folder")
        if path:
            self.project_path = Path(path)
            pool_json = self.project_path / "poolr.json"
            if pool_json.exists():
                try:
                    with open(pool_json, "r", encoding="utf-8") as fh:
                        self.project_data = json.load(fh)
                    # Ensure all keys exist
                    for key in self._get_empty_project():
                        if key not in self.project_data:
                            self.project_data[key] = self._get_empty_project()[key]
                    self.status_label.configure(text=f"Project: {self.project_path.name}")
                    self._refresh_all_pages()
                    messagebox.showinfo("Success", f"Project loaded:\n{self.project_path}")
                except Exception as e:
                    messagebox.showerror("Error", f"Failed to load project:\n{e}")
            else:
                messagebox.showerror("Error", "No poolr.json found in this folder")

    def save_project(self):
        if not self.project_path:
            return
        from datetime import datetime
        self.project_data["metadata"]["modified"] = datetime.now().isoformat()
        out = self.project_path / "poolr.json"
        try:
            with open(out, "w", encoding="utf-8") as fh:
                json.dump(self.project_data, fh, indent=2)
            self._update_progress()
        except Exception as e:
            messagebox.showerror("Error", f"Failed to save project:\n{e}")

    def _refresh_all_pages(self):
        for page in self._pages.values():
            if hasattr(page, 'refresh'):
                page.refresh()

    def _update_progress(self):
        # Calculate progress based on completed sections
        steps = [
            ("pico", bool(self.project_data.get("pico", {}))),
            ("search_strategies", bool(self.project_data.get("search_strategies", {}))),
            ("screening", len(self.project_data.get("screening", {}).get("title_abstract", [])) > 0 or 
                       len(self.project_data.get("screening", {}).get("full_text", [])) > 0),
            ("extraction", len(self.project_data.get("extraction", {}).get("studies", [])) > 0),
            ("rob", len(self.project_data.get("rob", {}).get("assessments", [])) > 0),
            ("meta", bool(self.project_data.get("meta", {}).get("results", {}))),
            ("prisma", bool(self.project_data.get("prisma", {}))),
        ]
        completed = sum(1 for _, done in steps if done)
        total = len(steps)
        progress = completed / total if total > 0 else 0
        self.progress_bar.set(progress)
        self.progress_label.configure(text=f"{int(progress * 100)}% complete ({completed}/{total} sections)")

    def _export_report(self):
        if not self.project_path:
            messagebox.showwarning("Warning", "No project open")
            return
        # Export all data to a comprehensive report
        report_path = self.project_path / "poolr_report.json"
        with open(report_path, "w", encoding="utf-8") as fh:
            json.dump(self.project_data, fh, indent=2)
        messagebox.showinfo("Exported", f"Report saved to:\n{report_path}")

    def _show_preferences(self):
        messagebox.showinfo("Preferences", "Preferences dialog coming soon")

    def _show_about(self):
        messagebox.showinfo("About poolr", 
            "poolr v0.2.0\n\n"
            "Standalone GUI for systematic reviews and meta-analyses.\n\n"
            "Built with CustomTkinter, pandas, and Python.\n\n"
            "https://github.com/harisawan-bit/poolr")

    def on_closing(self):
        if self.project_path and self.project_data:
            self.save_project()
        self.quit()


class DashboardPage(ctk.CTkFrame):
    def __init__(self, master, app: PoolrApp):
        super().__init__(master)
        self.app = app
        self._build()

    def _build(self):
        # Welcome header
        header = ctk.CTkFrame(self)
        header.pack(fill="x", pady=(0, 20))
        ctk.CTkLabel(header, text="Welcome to poolr", font=ctk.CTkFont(size=24, weight="bold")).pack(anchor="w")
        ctk.CTkLabel(header, text="Your systematic review & meta-analysis workspace", font=ctk.CTkFont(size=13)).pack(anchor="w", pady=(4, 0))

        # Quick stats
        stats_frame = ctk.CTkFrame(self)
        stats_frame.pack(fill="x", pady=(0, 20))
        stats_frame.grid_columnconfigure((0,1,2,3), weight=1)
        
        self.stat_cards = {}
        for i, (label, key) in enumerate([
            ("Studies Found", "studies_found"),
            ("Studies Included", "studies_included"),
            ("Extraction Complete", "extraction_done"),
            ("Meta-Analysis Done", "meta_done"),
        ]):
            card = ctk.CTkFrame(stats_frame)
            card.grid(row=0, column=i, padx=8, pady=8, sticky="ew")
            ctk.CTkLabel(card, text=label, font=ctk.CTkFont(size=11)).pack(anchor="w", padx=12, pady=(10, 2))
            val = ctk.CTkLabel(card, text="0", font=ctk.CTkFont(size=28, weight="bold"))
            val.pack(anchor="w", padx=12, pady=(0, 10))
            self.stat_cards[key] = val

        # Recent activity / quick actions
        actions_frame = ctk.CTkFrame(self)
        actions_frame.pack(fill="x", pady=(0, 20))
        ctk.CTkLabel(actions_frame, text="Quick Actions", font=ctk.CTkFont(size=16, weight="bold")).pack(anchor="w", padx=16, pady=(12, 8))
        
        actions = [
            ("📋 Define PICO", "protocol"),
            ("🔍 Build Search", "search"),
            ("☑️ Start Screening", "screening"),
            ("📝 Extract Data", "extraction"),
            ("⚠️ Assess Bias", "rob"),
            ("📈 Run Meta-Analysis", "meta"),
        ]
        btn_frame = ctk.CTkFrame(actions_frame, fg_color="transparent")
        btn_frame.pack(fill="x", padx=16, pady=(0, 16))
        for i, (label, key) in enumerate(actions):
            btn = ctk.CTkButton(btn_frame, text=label, height=36, 
                               command=lambda k=key: self.app._select_page(k))
            btn.grid(row=i//3, column=i%3, padx=6, pady=6, sticky="ew")
            btn_frame.grid_columnconfigure(i%3, weight=1)

        # Project info
        self.info_frame = ctk.CTkFrame(self)
        self.info_frame.pack(fill="both", expand=True)
        ctk.CTkLabel(self.info_frame, text="Project Information", font=ctk.CTkFont(size=16, weight="bold")).pack(anchor="w", padx=16, pady=(12, 8))
        self.info_text = ctk.CTkTextbox(self.info_frame, height=150)
        self.info_text.pack(fill="both", expand=True, padx=16, pady=(0, 16))

    def refresh(self):
        self._update_stats()
        self._update_info()

    def _update_stats(self):
        data = self.app.project_data
        ta_count = len(data.get("screening", {}).get("title_abstract", []))
        ft_count = len(data.get("screening", {}).get("full_text", []))
        ext_count = len(data.get("extraction", {}).get("studies", []))
        rob_count = len(data.get("rob", {}).get("assessments", []))
        meta_done = bool(data.get("meta", {}).get("results", {}))

        self.stat_cards["studies_found"].configure(text=str(ta_count))
        self.stat_cards["studies_included"].configure(text=str(ft_count))
        self.stat_cards["extraction_done"].configure(text=f"{ext_count} studies")
        self.stat_cards["meta_done"].configure(text="Yes" if meta_done else "No")

    def _update_info(self):
        self.info_text.delete("0.0", "end")
        if not self.app.project_path:
            self.info_text.insert("0.0", "No project loaded. Create a new project or open an existing one.")
            return

        info = f"Project: {self.app.project_path.name}\n"
        info += f"Location: {self.app.project_path}\n\n"
        meta = self.app.project_data.get("metadata", {})
        info += f"Created: {meta.get('created', 'Unknown')}\n"
        info += f"Last Modified: {meta.get('modified', 'Unknown')}\n"
        info += f"Version: {meta.get('version', '0.2.0')}\n\n"

        pico = self.app.project_data.get("pico", {})
        if pico:
            info += "PICO Summary:\n"
            for k, v in pico.items():
                if v:
                    info += f"  {k.capitalize()}: {v[:80]}{'...' if len(v) > 80 else ''}\n"
        else:
            info += "PICO not yet defined."

        self.info_text.insert("0.0", info)


class ProtocolPage(ctk.CTkFrame):
    def __init__(self, master, app: PoolrApp):
        super().__init__(master)
        self.app = app
        self._build()

    def _build(self):
        # Scrollable frame
        self.scroll = ctk.CTkScrollableFrame(self)
        self.scroll.pack(fill="both", expand=True)
        self.scroll.grid_columnconfigure(0, weight=1)

        # PICO Section
        ctk.CTkLabel(self.scroll, text="PICO Definition", font=ctk.CTkFont(size=20, weight="bold")).grid(row=0, column=0, sticky="w", pady=(0, 12))

        pico_help = "Define your Population, Intervention, Comparator, and Outcomes clearly. This forms the foundation of your systematic review."
        ctk.CTkLabel(self.scroll, text=pico_help, wraplength=800, justify="left").grid(row=1, column=0, sticky="w", pady=(0, 16))

        self.entries = {}
        pico_fields = [
            ("Population", "population", "e.g., Adults with traumatic brain injury (GCS ≤ 8)"),
            ("Intervention", "intervention", "e.g., Decompressive craniectomy within 48 hours"),
            ("Comparator", "comparator", "e.g., Medical management alone (ICP monitoring, osmotherapy)"),
            ("Outcomes", "outcomes", "e.g., Mortality at 6 months; Glasgow Outcome Scale at 12 months"),
        ]

        for i, (label, key, placeholder) in enumerate(pico_fields):
            row = i + 2
            ctk.CTkLabel(self.scroll, text=label, font=ctk.CTkFont(size=14, weight="bold")).grid(row=row, column=0, sticky="w", pady=(16, 4))
            entry = ctk.CTkTextbox(self.scroll, height=80)
            entry.grid(row=row+1, column=0, sticky="ew", pady=(0, 4))
            self.entries[key] = entry
            
            # Placeholder
            if not self.app.project_data.get("pico", {}).get(key):
                entry.insert("0.0", placeholder)
                entry.configure(text_color=("gray50", "gray50"))

        # Additional protocol fields
        ctk.CTkLabel(self.scroll, text="Additional Protocol Details", font=ctk.CTkFont(size=18, weight="bold")).grid(row=10, column=0, sticky="w", pady=(20, 12))

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
            entry.grid(row=row+1, column=0, sticky="ew", pady=(0, 4))
            entry.insert(0, placeholder)
            entry.configure(text_color=("gray50", "gray50"))
            self.additional_fields[key] = entry

        # Save button
        btn_frame = ctk.CTkFrame(self.scroll, fg_color="transparent")
        btn_frame.grid(row=22, column=0, sticky="ew", pady=24)
        ctk.CTkButton(btn_frame, text="💾 Save Protocol", command=self._save, height=40, font=ctk.CTkFont(size=14, weight="bold")).pack(side="right")
        ctk.CTkButton(btn_frame, text="📄 Export Protocol", command=self._export_protocol, height=40).pack(side="right", padx=8)

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


class SearchPage(ctk.CTkFrame):
    def __init__(self, master, app: PoolrApp):
        super().__init__(master)
        self.app = app
        self._build()

    def _build(self):
        self.scroll = ctk.CTkScrollableFrame(self)
        self.scroll.pack(fill="both", expand=True)
        self.scroll.grid_columnconfigure(0, weight=1)

        ctk.CTkLabel(self.scroll, text="Search Strategy Builder", font=ctk.CTkFont(size=20, weight="bold")).grid(row=0, column=0, sticky="w", pady=(0, 8))
        ctk.CTkLabel(self.scroll, text="Generate search strings for each database from your PICO. Edit as needed.", wraplength=800).grid(row=1, column=0, sticky="w", pady=(0, 16))

        # Generate button
        ctk.CTkButton(self.scroll, text="🔄 Generate from PICO", command=self._generate_from_pico, height=40, font=ctk.CTkFont(size=13)).grid(row=2, column=0, sticky="w", pady=(0, 16))

        # Database tabs
        self.db_textboxes = {}
        databases = [
            ("PubMed/MEDLINE", "pubmed"),
            ("Embase", "embase"),
            ("Cochrane CENTRAL", "cochrane"),
            ("Scopus", "scopus"),
            ("Web of Science", "wos"),
        ]

        for i, (label, key) in enumerate(databases):
            row = 3 + i * 2
            ctk.CTkLabel(self.scroll, text=label, font=ctk.CTkFont(size=14, weight="bold")).grid(row=row, column=0, sticky="w", pady=(12, 4))
            tb = ctk.CTkTextbox(self.scroll, height=120, font=ctk.CTkFont(family="Consolas", size=11))
            tb.grid(row=row+1, column=0, sticky="ew", pady=(0, 4))
            self.db_textboxes[key] = tb

        # Save button
        ctk.CTkButton(self.scroll, text="💾 Save All Strategies", command=self._save, height=40, font=ctk.CTkFont(size=14, weight="bold")).grid(row=14, column=0, sticky="ew", pady=20)

        # Export
        ctk.CTkButton(self.scroll, text="📤 Export All (.txt)", command=self._export, height=36).grid(row=15, column=0, sticky="ew", pady=(0, 20))

    def on_enter(self):
        self.refresh()

    def refresh(self):
        strategies = self.app.project_data.get("search_strategies", {})
        for key, tb in self.db_textboxes.items():
            tb.delete("0.0", "end")
            if strategies.get(key):
                tb.insert("0.0", strategies[key])

    def _generate_from_pico(self):
        pico = self.app.project_data.get("pico", {})
        if not any(pico.values()):
            messagebox.showwarning("Warning", "Please define PICO in Protocol tab first")
            return

        pop = pico.get("population", "")
        interv = pico.get("intervention", "")
        comp = pico.get("comparator", "")
        outc = pico.get("outcomes", "")

        # PubMed
        pubmed = self._build_pubmed(pop, interv, comp, outc)
        self.db_textboxes["pubmed"].delete("0.0", "end")
        self.db_textboxes["pubmed"].insert("0.0", pubmed)

        # Embase
        embase = self._build_embase(pop, interv, comp, outc)
        self.db_textboxes["embase"].delete("0.0", "end")
        self.db_textboxes["embase"].insert("0.0", embase)

        # Cochrane
        cochrane = self._build_cochrane(pop, interv, comp, outc)
        self.db_textboxes["cochrane"].delete("0.0", "end")
        self.db_textboxes["cochrane"].insert("0.0", cochrane)

        # Scopus
        scopus = self._build_scopus(pop, interv, comp, outc)
        self.db_textboxes["scopus"].delete("0.0", "end")
        self.db_textboxes["scopus"].insert("0.0", scopus)

        # Web of Science
        wos = self._build_wos(pop, interv, comp, outc)
        self.db_textboxes["wos"].delete("0.0", "end")
        self.db_textboxes["wos"].insert("0.0", wos)

        messagebox.showinfo("Generated", "Search strategies generated from PICO. Review and edit as needed.")

    def _build_pubmed(self, pop, interv, comp, outc):
        parts = []
        if pop: parts.append(f"({pop}[MeSH Terms] OR {pop}[Title/Abstract])")
        if interv: parts.append(f"({interv}[MeSH Terms] OR {interv}[Title/Abstract])")
        if comp: parts.append(f"({comp}[MeSH Terms] OR {comp}[Title/Abstract])")
        if outc: parts.append(f"({outc}[MeSH Terms] OR {outc}[Title/Abstract])")
        return " AND\n".join(parts)

    def _build_embase(self, pop, interv, comp, outc):
        parts = []
        if pop: parts.append(f"('{pop}'/exp OR '{pop}':ti,ab)")
        if interv: parts.append(f"('{interv}'/exp OR '{interv}':ti,ab)")
        if comp: parts.append(f"('{comp}'/exp OR '{comp}':ti,ab)")
        if outc: parts.append(f"('{outc}'/exp OR '{outc}':ti,ab)")
        return " AND\n".join(parts)

    def _build_cochrane(self, pop, interv, comp, outc):
        lines = []
        idx = 1
        if pop: lines.append(f"#{idx} {pop}:ti,ab,kw"); idx += 1
        if interv: lines.append(f"#{idx} {interv}:ti,ab,kw"); idx += 1
        if comp: lines.append(f"#{idx} {comp}:ti,ab,kw"); idx += 1
        if outc: lines.append(f"#{idx} {outc}:ti,ab,kw"); idx += 1
        lines.append(f"#{idx} " + " AND ".join([f"#{i}" for i in range(1, idx)]))
        return "\n".join(lines)

    def _build_scopus(self, pop, interv, comp, outc):
        parts = []
        if pop: parts.append(f'TITLE-ABS-KEY("{pop}")')
        if interv: parts.append(f'TITLE-ABS-KEY("{interv}")')
        if comp: parts.append(f'TITLE-ABS-KEY("{comp}")')
        if outc: parts.append(f'TITLE-ABS-KEY("{outc}")')
        return " AND\n".join(parts)

    def _build_wos(self, pop, interv, comp, outc):
        parts = []
        if pop: parts.append(f'TS=("{pop}")')
        if interv: parts.append(f'TS=("{interv}")')
        if comp: parts.append(f'TS=("{comp}")')
        if outc: parts.append(f'TS=("{outc}")')
        return " AND\n".join(parts)

    def _save(self):
        strategies = {}
        for key, tb in self.db_textboxes.items():
            text = tb.get("0.0", "end").strip()
            if text:
                strategies[key] = text
        self.app.project_data["search_strategies"] = strategies
        self.app.save_project()
        messagebox.showinfo("Saved", "Search strategies saved to poolr.json")
        self.app._update_progress()

    def _export(self):
        if not self.app.project_path:
            messagebox.showwarning("Warning", "No project open")
            return
        strategies = {}
        for key, tb in self.db_textboxes.items():
            text = tb.get("0.0", "end").strip()
            if text:
                strategies[key] = text
        path = self.app.project_path / "search_strategies.txt"
        with open(path, "w", encoding="utf-8") as fh:
            for db, strat in strategies.items():
                fh.write(f"=== {db.upper()} ===\n{strat}\n\n")
        messagebox.showinfo("Exported", f"Strategies exported to:\n{path}")


class ScreeningPage(ctk.CTkFrame):
    def __init__(self, master, app: PoolrApp):
        super().__init__(master)
        self.app = app
        self._build()
        self._current_mode = "title_abstract"  # or "full_text"
        self._records = []
        self._current_index = 0

    def _build(self):
        # Top controls
        top_frame = ctk.CTkFrame(self)
        top_frame.pack(fill="x", pady=(0, 12))

        ctk.CTkLabel(top_frame, text="Screening", font=ctk.CTkFont(size=20, weight="bold")).pack(side="left", padx=16, pady=12)

        self.mode_var = tk.StringVar(value="title_abstract")
        ctk.CTkSegmentedButton(top_frame, values=["Title/Abstract", "Full Text"], variable=self.mode_var, command=self._on_mode_change).pack(side="right", padx=16, pady=12)

        # Import/export
        btn_frame = ctk.CTkFrame(top_frame, fg_color="transparent")
        btn_frame.pack(side="right", padx=12)
        ctk.CTkButton(btn_frame, text="📥 Import CSV", command=self._import_csv, height=32).pack(side="left", padx=4)
        ctk.CTkButton(btn_frame, text="📤 Export CSV", command=self._export_csv, height=32).pack(side="left", padx=4)
        ctk.CTkButton(btn_frame, text="💾 Save", command=self._save, height=32).pack(side="left", padx=4)

        # Main area
        main = ctk.CTkFrame(self)
        main.pack(fill="both", expand=True)
        main.grid_columnconfigure(1, weight=1)
        main.grid_rowconfigure(0, weight=1)

        # Left: Record list
        left = ctk.CTkFrame(main, width=350)
        left.grid(row=0, column=0, sticky="nsew", padx=(0, 8))
        left.grid_rowconfigure(1, weight=1)
        left.grid_propagate(False)

        ctk.CTkLabel(left, text="Records", font=ctk.CTkFont(size=14, weight="bold")).grid(row=0, column=0, sticky="w", padx=12, pady=12)

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
        self.include_btn = ctk.CTkButton(decision_frame, text="✅ Include", command=lambda: self._decide(True), height=40, fg_color="green", font=ctk.CTkFont(size=14, weight="bold"))
        self.include_btn.pack(side="left", padx=8, expand=True, fill="x")
        self.exclude_btn = ctk.CTkButton(decision_frame, text="❌ Exclude", command=lambda: self._decide(False), height=40, fg_color="red", font=ctk.CTkFont(size=14, weight="bold"))
        self.exclude_btn.pack(side="left", padx=8, expand=True, fill="x")
        self.unsure_btn = ctk.CTkButton(decision_frame, text="❓ Unsure", command=lambda: self._decide(None), height=40, fg_color="orange", font=ctk.CTkFont(size=14, weight="bold"))
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

    def _load_records(self):
        mode_key = "title_abstract" if self._current_mode == "title_abstract" else "full_text"
        self._records = self.app.project_data.get("screening", {}).get(mode_key, [])
        self._current_index = 0

    def _update_list(self):
        for widget in self.record_list.winfo_children():
            widget.destroy()

        for i, rec in enumerate(self._records):
            # Determine status color
            decision = rec.get("decision")
            if decision is True:
                color = "green"
                icon = "✅"
            elif decision is False:
                color = "red"
                icon = "❌"
            elif decision is None:
                color = "orange"
                icon = "❓"
            else:
                color = "gray"
                icon = "⏳"

            btn = ctk.CTkButton(self.record_list, text=f"{icon} {rec.get('title', 'Untitled')[:60]}", 
                               anchor="w", height=32, fg_color="transparent",
                               text_color=color, command=lambda idx=i: self._select_record(idx))
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

        # Update button states
        decision = rec.get("decision")
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
            self.reason_entry.insert(0, rec.get("reason", ""))
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
        if self._current_index >= len(self._records):
            return
        
        self._records[self._current_index]["decision"] = decision
        if decision is False:
            self._records[self._current_index]["reason"] = self.reason_entry.get()
        
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
        path = filedialog.asksaveasfilename(title="Export screening CSV", defaultextension=".csv", filetypes=[("CSV", "*.csv")])
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


class ExtractionPage(ctk.CTkFrame):
    def __init__(self, master, app: PoolrApp):
        super().__init__(master)
        self.app = app
        self._build()
        self._current_study = None
        self._study_index = 0

    def _build(self):
        top = ctk.CTkFrame(self)
        top.pack(fill="x", pady=(0, 12))

        ctk.CTkLabel(top, text="Data Extraction", font=ctk.CTkFont(size=20, weight="bold")).pack(side="left", padx=16, pady=12)

        btn_frame = ctk.CTkFrame(top, fg_color="transparent")
        btn_frame.pack(side="right", padx=12)
        ctk.CTkButton(btn_frame, text="➕ Add Study", command=self._add_study, height=32).pack(side="left", padx=4)
        ctk.CTkButton(btn_frame, text="📥 Import CSV", command=self._import_csv, height=32).pack(side="left", padx=4)
        ctk.CTkButton(btn_frame, text="📤 Export CSV", command=self._export_csv, height=32).pack(side="left", padx=4)
        ctk.CTkButton(btn_frame, text="💾 Save", command=self._save, height=32).pack(side="left", padx=4)

        # Main area
        main = ctk.CTkFrame(self)
        main.pack(fill="both", expand=True)
        main.grid_columnconfigure(1, weight=1)
        main.grid_rowconfigure(0, weight=1)

        # Left: Study list
        left = ctk.CTkFrame(main, width=300)
        left.grid(row=0, column=0, sticky="nsew", padx=(0, 8))
        left.grid_rowconfigure(1, weight=1)
        left.grid_propagate(False)

        ctk.CTkLabel(left, text="Studies", font=ctk.CTkFont(size=14, weight="bold")).grid(row=0, column=0, sticky="w", padx=12, pady=12)

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
            ("Study Identification", [
                ("study_id", "Study ID", "entry"),
                ("title", "Title", "text"),
                ("authors", "Authors", "entry"),
                ("year", "Year", "entry"),
                ("journal", "Journal", "entry"),
                ("doi", "DOI", "entry"),
                ("country", "Country", "entry"),
            ]),
            ("Study Design", [
                ("design", "Design", "combo", ["RCT", "Cohort", "Case-Control", "Cross-Sectional", "Other"]),
                ("setting", "Setting", "entry"),
                ("follow_up", "Follow-up Duration", "entry"),
            ]),
            ("Population", [
                ("population_description", "Description", "text"),
                ("age_mean", "Mean Age", "entry"),
                ("age_sd", "SD Age", "entry"),
                ("sex_male", "Male (%)", "entry"),
                ("sample_size", "Total Sample Size", "entry"),
            ]),
            ("Intervention Group", [
                ("int_description", "Description", "text"),
                ("int_n", "N", "entry"),
                ("int_events", "Events (for binary outcomes)", "entry"),
                ("int_mean", "Mean (for continuous)", "entry"),
                ("int_sd", "SD (for continuous)", "entry"),
            ]),
            ("Control Group", [
                ("ctrl_description", "Description", "text"),
                ("ctrl_n", "N", "entry"),
                ("ctrl_events", "Events (for binary outcomes)", "entry"),
                ("ctrl_mean", "Mean (for continuous)", "entry"),
                ("ctrl_sd", "SD (for continuous)", "entry"),
            ]),
            ("Outcomes", [
                ("primary_outcome", "Primary Outcome", "entry"),
                ("secondary_outcomes", "Secondary Outcomes", "text"),
                ("timepoints", "Timepoints", "entry"),
            ]),
            ("Notes", [
                ("notes", "Notes", "text"),
            ]),
        ]

        for section_idx, (section_title, fields) in enumerate(sections):
            frame = ctk.CTkFrame(self.form_scroll)
            frame.pack(fill="x", padx=12, pady=12)
            frame.grid_columnconfigure(1, weight=1)

            ctk.CTkLabel(frame, text=section_title, font=ctk.CTkFont(size=15, weight="bold")).grid(row=0, column=0, columnspan=2, sticky="w", padx=12, pady=(12, 8))

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
        ctk.CTkButton(self.form_scroll, text="💾 Save Study", command=self._save_study, height=40, font=ctk.CTkFont(size=14, weight="bold")).pack(fill="x", padx=20, pady=20)

    def on_enter(self):
        self._update_list()

    def _update_list(self):
        for widget in self.study_list.winfo_children():
            widget.destroy()

        studies = self.app.project_data.get("extraction", {}).get("studies", [])
        for i, study in enumerate(studies):
            btn = ctk.CTkButton(self.study_list, text=f"{study.get('study_id', f'Study {i+1}')}: {study.get('title', 'Untitled')[:40]}",
                               anchor="w", height=32, command=lambda idx=i: self._load_study(idx))
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
        
        self.app.project_data.setdefault("extraction", {}).setdefault("studies", [])[self._study_index] = self._current_study
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

    def _export_csv(self):
        studies = self.app.project_data.get("extraction", {}).get("studies", [])
        if not studies:
            messagebox.showwarning("Warning", "No studies to export")
            return
        path = filedialog.asksaveasfilename(title="Export extraction CSV", defaultextension=".csv", filetypes=[("CSV", "*.csv")])
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


class RoBPage(ctk.CTkFrame):
    def __init__(self, master, app: PoolrApp):
        super().__init__(master)
        self.app = app
        self._build()

    def _build(self):
        top = ctk.CTkFrame(self)
        top.pack(fill="x", pady=(0, 12))

        ctk.CTkLabel(top, text="Risk of Bias Assessment", font=ctk.CTkFont(size=20, weight="bold")).pack(side="left", padx=16, pady=12)

        btn_frame = ctk.CTkFrame(top, fg_color="transparent")
        btn_frame.pack(side="right", padx=12)
        ctk.CTkButton(btn_frame, text="➕ Add Assessment", command=self._add_assessment, height=32).pack(side="left", padx=4)
        ctk.CTkButton(btn_frame, text="💾 Save", command=self._save, height=32).pack(side="left", padx=4)

        # Tool selector
        self.tool_var = tk.StringVar(value="rob2")
        ctk.CTkSegmentedButton(top, values=["RoB 2", "NOS", "PROBAST"], variable=self.tool_var, command=self._on_tool_change).pack(side="right", padx=12)

        # Main area
        self.form_area = ctk.CTkScrollableFrame(self)
        self.form_area.pack(fill="both", expand=True)
        self.form_area.grid_columnconfigure(0, weight=1)

        self._build_rob2_form()
        self._build_nos_form()
        self._build_probast_form()

        self.rob2_frame.pack(fill="x", padx=16, pady=12)
        self.nos_frame.pack_forget()
        self.probast_frame.pack_forget()

        # Save button
        ctk.CTkButton(self, text="💾 Save Assessment", command=self._save_assessment, height=40, font=ctk.CTkFont(size=14, weight="bold")).pack(fill="x", padx=20, pady=20)

    def _build_rob2_form(self):
        self.rob2_frame = ctk.CTkFrame(self.form_area)
        self.rob2_fields = {}
        
        ctk.CTkLabel(self.rob2_frame, text="RoB 2 (RCTs)", font=ctk.CTkFont(size=16, weight="bold")).pack(anchor="w", padx=12, pady=(12, 8))
        
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
            
            ctk.CTkLabel(frame, text=label, font=ctk.CTkFont(size=12)).grid(row=0, column=0, sticky="w", padx=12, pady=12)
            
            combo = ctk.CTkComboBox(frame, values=["Low", "Some concerns", "High", "No information"])
            combo.grid(row=0, column=1, padx=12, pady=12, sticky="ew")
            combo.set("Low")
            self.rob2_fields[key] = combo
            frame.grid_columnconfigure(1, weight=1)

        # Overall
        frame = ctk.CTkFrame(self.rob2_frame)
        frame.pack(fill="x", padx=12, pady=8)
        frame.grid_columnconfigure(1, weight=1)
        ctk.CTkLabel(frame, text="Overall Risk of Bias", font=ctk.CTkFont(size=12, weight="bold")).grid(row=0, column=0, sticky="w", padx=12, pady=12)
        self.rob2_fields["overall"] = ctk.CTkComboBox(frame, values=["Low", "Some concerns", "High"])
        self.rob2_fields["overall"].grid(row=0, column=1, padx=12, pady=12, sticky="ew")
        self.rob2_fields["overall"].set("Low")
        frame.grid_columnconfigure(1, weight=1)

    def _build_nos_form(self):
        self.nos_frame = ctk.CTkFrame(self.form_area)
        self.nos_fields = {}
        
        ctk.CTkLabel(self.nos_frame, text="Newcastle-Ottawa Scale (Cohort Studies)", font=ctk.CTkFont(size=16, weight="bold")).pack(anchor="w", padx=12, pady=(12, 8))
        
        # Selection
        ctk.CTkLabel(self.nos_frame, text="Selection (max 4 stars)", font=ctk.CTkFont(size=13, weight="bold")).pack(anchor="w", padx=12, pady=(8, 4))
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
        ctk.CTkLabel(self.nos_frame, text="Comparability (max 2 stars)", font=ctk.CTkFont(size=13, weight="bold")).pack(anchor="w", padx=12, pady=(8, 4))
        for key, label in [("comparability1", "Study controls for most important factor"), ("comparability2", "Study controls for additional factor")]:
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
        ctk.CTkLabel(self.nos_frame, text="Outcome (max 3 stars)", font=ctk.CTkFont(size=13, weight="bold")).pack(anchor="w", padx=12, pady=(8, 4))
        for key, label in [("assessment", "Assessment of outcome"), ("followup", "Follow-up long enough"), ("adequacy", "Adequacy of follow-up")]:
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
        ctk.CTkLabel(frame, text="Total Score (0-9)", font=ctk.CTkFont(size=13, weight="bold")).grid(row=0, column=0, sticky="w", padx=12, pady=12)
        self.nos_fields["total"] = ctk.CTkEntry(frame)
        self.nos_fields["total"].grid(row=0, column=1, padx=12, pady=12, sticky="ew")
        self.nos_fields["total"].insert(0, "0")
        frame.grid_columnconfigure(1, weight=1)

    def _build_probast_form(self):
        self.probast_frame = ctk.CTkFrame(self.form_area)
        self.probast_fields = {}
        
        ctk.CTkLabel(self.probast_frame, text="PROBAST (Diagnostic/Prognostic Studies)", font=ctk.CTkFont(size=16, weight="bold")).pack(anchor="w", padx=12, pady=(12, 8))
        
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
            ctk.CTkLabel(frame, text=label, font=ctk.CTkFont(size=12)).grid(row=0, column=0, sticky="w", padx=12, pady=12)
            combo = ctk.CTkComboBox(frame, values=values)
            combo.grid(row=0, column=1, padx=12, pady=12, sticky="ew")
            combo.set("Low")
            self.probast_fields[key] = combo
            frame.grid_columnconfigure(1, weight=1)

        # Applicability
        ctk.CTkLabel(self.probast_frame, text="Applicability Concerns", font=ctk.CTkFont(size=13, weight="bold")).pack(anchor="w", padx=12, pady=(12, 8))
        for key, label in [("app_participants", "Participants"), ("app_predictors", "Predictors"), ("app_outcome", "Outcome")]:
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


class MetaPage(ctk.CTkFrame):
    def __init__(self, master, app: PoolrApp):
        super().__init__(master)
        self.app = app
        self._build()

    def _build(self):
        top = ctk.CTkFrame(self)
        top.pack(fill="x", pady=(0, 12))

        ctk.CTkLabel(top, text="Meta-Analysis", font=ctk.CTkFont(size=20, weight="bold")).pack(side="left", padx=16, pady=12)

        btn_frame = ctk.CTkFrame(top, fg_color="transparent")
        btn_frame.pack(side="right", padx=12)
        ctk.CTkButton(btn_frame, text="▶️ Run Analysis", command=self._run_analysis, height=36, font=ctk.CTkFont(size=13, weight="bold")).pack(side="left", padx=4)
        ctk.CTkButton(btn_frame, text="📤 Export", command=self._export, height=36).pack(side="left", padx=4)

        # Settings
        settings = ctk.CTkFrame(self)
        settings.pack(fill="x", pady=(0, 12))
        
        ctk.CTkLabel(settings, text="Model:", font=ctk.CTkFont(size=13)).pack(side="left", padx=16, pady=12)
        self.model_var = tk.StringVar(value="random")
        ctk.CTkSegmentedButton(settings, values=["Random-effects", "Fixed-effect"], variable=self.model_var).pack(side="left", padx=8, pady=12)

        ctk.CTkLabel(settings, text="Effect Measure:", font=ctk.CTkFont(size=13)).pack(side="left", padx=16, pady=12)
        self.measure_var = tk.StringVar(value="OR")
        ctk.CTkSegmentedButton(settings, values=["OR", "RR", "MD", "SMD", "HR"], variable=self.measure_var).pack(side="left", padx=8, pady=12)

        ctk.CTkLabel(settings, text="Subgroup:", font=ctk.CTkFont(size=13)).pack(side="left", padx=16, pady=12)
        self.subgroup_var = tk.StringVar(value="none")
        ctk.CTkComboBox(settings, values=["none", "design", "country", "year"], variable=self.subgroup_var, width=150).pack(side="left", padx=8, pady=12)

        # Results area
        self.results_area = ctk.CTkFrame(self)
        self.results_area.pack(fill="both", expand=True)
        self.results_area.grid_columnconfigure(0, weight=1)
        self.results_area.grid_rowconfigure(1, weight=1)

        self.results_text = ctk.CTkTextbox(self.results_area, font=ctk.CTkFont(family="Consolas", size=11))
        self.results_text.grid(row=0, column=0, sticky="nsew", padx=16, pady=16)

        # Forest plot placeholder
        self.plot_frame = ctk.CTkFrame(self.results_area)
        self.plot_frame.grid(row=1, column=0, sticky="nsew", padx=16, pady=(0, 16))
        ctk.CTkLabel(self.plot_frame, text="Forest plot will appear here after analysis", font=ctk.CTkFont(size=13)).pack(expand=True)

    def _run_analysis(self):
        studies = self.app.project_data.get("extraction", {}).get("studies", [])
        if not studies:
            messagebox.showwarning("Warning", "No extraction data available. Add studies in Extraction tab first.")
            return

        try:
            # Prepare data for meta-analysis
            analysis_data = []
            for s in studies:
                # Extract binary outcome data (events/n)
                int_events = s.get("int_events", "")
                int_n = s.get("int_n", "")
                ctrl_events = s.get("ctrl_events", "")
                ctrl_n = s.get("ctrl_n", "")
                
                if int_events and int_n and ctrl_events and ctrl_n:
                    try:
                        analysis_data.append({
                            "study": s.get("study_id", "Unknown"),
                            "int_events": int(int_events),
                            "int_n": int(int_n),
                            "ctrl_events": int(ctrl_events),
                            "ctrl_n": int(ctrl_n),
                        })
                    except ValueError:
                        pass

            if not analysis_data:
                messagebox.showwarning("Warning", "No valid binary outcome data found. Ensure studies have int_events, int_n, ctrl_events, ctrl_n filled.")
                return

            # Perform meta-analysis using simple inverse variance method
            results = self._meta_analysis(analysis_data)
            
            # Display results
            self._display_results(results)
            self.app.project_data["meta"]["results"] = results
            self.app.save_project()
            
        except Exception as e:
            messagebox.showerror("Error", f"Meta-analysis failed:\n{e}")
            traceback.print_exc()

    def _meta_analysis(self, data):
        """Simple inverse variance meta-analysis for binary outcomes (OR)"""
        import math
        
        results = {
            "studies": [],
            "pooled": {},
            "heterogeneity": {},
        }
        
        # Calculate log OR and variance for each study
        weights = []
        log_ors = []
        
        for d in data:
            a = d["int_events"]
            b = d["int_n"] - d["int_events"]
            c = d["ctrl_events"]
            d_n = d["ctrl_n"] - d["ctrl_events"]
            
            # Add 0.5 continuity correction for zero cells
            if a == 0 or b == 0 or c == 0 or d_n == 0:
                a += 0.5
                b += 0.5
                c += 0.5
                d_n += 0.5
            
            or_val = (a * d_n) / (b * c)
            log_or = math.log(or_val)
            var = 1/a + 1/b + 1/c + 1/d_n
            se = math.sqrt(var)
            
            d["log_or"] = log_or
            d["var"] = var
            d["se"] = se
            d["or"] = or_val
            d["weight"] = 1/var
            
            results["studies"].append(d)
            weights.append(1/var)
            log_ors.append(log_or)
        
        # Fixed-effect pooled estimate
        sum_w = sum(weights)
        pooled_log_or = sum(w * l for w, l in zip(weights, log_ors)) / sum_w
        pooled_var = 1 / sum_w
        pooled_se = math.sqrt(pooled_var)
        pooled_or = math.exp(pooled_log_or)
        
        # Heterogeneity (Cochran's Q)
        q = sum(w * (l - pooled_log_or)**2 for w, l in zip(weights, log_ors))
        df = len(weights) - 1
        i2 = max(0, (q - df) / q * 100) if q > df else 0
        
        # Random-effects (DerSimonian-Laird)
        if df > 0 and q > df:
            tau2 = (q - df) / (sum_w - sum(w**2 for w in weights) / sum_w)
        else:
            tau2 = 0
        
        re_weights = [1 / (d["var"] + tau2) for d in data]
        sum_re_w = sum(re_weights)
        re_pooled_log_or = sum(w * l for w, l in zip(re_weights, log_ors)) / sum_re_w
        re_pooled_var = 1 / sum_re_w
        re_pooled_se = math.sqrt(re_pooled_var)
        re_pooled_or = math.exp(re_pooled_log_or)
        
        # 95% CI
        fe_lower = math.exp(pooled_log_or - 1.96 * pooled_se)
        fe_upper = math.exp(pooled_log_or + 1.96 * pooled_se)
        re_lower = math.exp(re_pooled_log_or - 1.96 * re_pooled_se)
        re_upper = math.exp(re_pooled_log_or + 1.96 * re_pooled_se)
        
        # Model choice
        model = self.model_var.get()
        if model == "Random-effects":
            final_or = re_pooled_or
            final_lower = re_lower
            final_upper = re_upper
            final_se = re_pooled_se
        else:
            final_or = pooled_or
            final_lower = fe_lower
            final_upper = fe_upper
            final_se = pooled_se
        
        results["pooled"] = {
            "or": final_or,
            "lower": final_lower,
            "upper": final_upper,
            "se": final_se,
            "model": model,
        }
        
        results["heterogeneity"] = {
            "q": q,
            "df": df,
            "i2": i2,
            "tau2": tau2,
        }
        
        return results

    def _display_results(self, results):
        self.results_text.delete("0.0", "end")
        
        out = "═══ META-ANALYSIS RESULTS ═══\n\n"
        out += f"Model: {results['pooled']['model']}\n"
        out += f"Effect Measure: {self.measure_var.get()}\n\n"
        
        out += "Individual Studies:\n"
        out += "─" * 80 + "\n"
        out += f"{'Study':<25} {'OR':>8} {'95% CI':>20} {'Weight':>10}\n"
        out += "─" * 80 + "\n"
        
        for s in results["studies"]:
            ci_lower = math.exp(s["log_or"] - 1.96 * s["se"])
            ci_upper = math.exp(s["log_or"] + 1.96 * s["se"])
            weight_pct = s["weight"] / sum(d["weight"] for d in results["studies"]) * 100
            out += f"{s['study']:<25} {s['or']:>8.3f} ({ci_lower:.3f}, {ci_upper:.3f}) {weight_pct:>8.1f}%\n"
        
        out += "─" * 80 + "\n\n"
        
        p = results["pooled"]
        out += f"POOLED ESTIMATE ({p['model']}):\n"
        out += f"  OR = {p['or']:.3f} (95% CI: {p['lower']:.3f} to {p['upper']:.3f})\n\n"
        
        h = results["heterogeneity"]
        out += "HETEROGENEITY:\n"
        out += f"  Cochran's Q = {h['q']:.2f} (df = {h['df']})\n"
        out += f"  I² = {h['i2']:.1f}%\n"
        out += f"  τ² = {h['tau2']:.4f}\n\n"
        
        # Interpretation
        if p["lower"] > 1 or p["upper"] < 1:
            out += "✓ Statistically significant (95% CI does not include 1)\n"
        else:
            out += "✗ Not statistically significant (95% CI includes 1)\n"
        
        if h["i2"] < 25:
            out += "✓ Low heterogeneity\n"
        elif h["i2"] < 50:
            out += "⚠ Moderate heterogeneity\n"
        else:
            out += "⚠ High heterogeneity\n"
        
        self.results_text.insert("0.0", out)
        
        # Also show in messagebox for quick view
        messagebox.showinfo("Analysis Complete", f"Pooled OR = {p['or']:.3f} (95% CI: {p['lower']:.3f}-{p['upper']:.3f})\nI² = {h['i2']:.1f}%")

    def _export(self):
        if not self.app.project_path:
            messagebox.showwarning("Warning", "No project open")
            return
        results = self.app.project_data.get("meta", {}).get("results", {})
        if not results:
            messagebox.showwarning("Warning", "No results to export")
            return
        path = self.app.project_path / "meta_analysis_results.json"
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(results, fh, indent=2)
        messagebox.showinfo("Exported", f"Results exported to:\n{path}")


class PrismaPage(ctk.CTkFrame):
    def __init__(self, master, app: PoolrApp):
        super().__init__(master)
        self.app = app
        self._build()

    def _build(self):
        top = ctk.CTkFrame(self)
        top.pack(fill="x", pady=(0, 12))

        ctk.CTkLabel(top, text="PRISMA 2020", font=ctk.CTkFont(size=20, weight="bold")).pack(side="left", padx=16, pady=12)

        btn_frame = ctk.CTkFrame(top, fg_color="transparent")
        btn_frame.pack(side="right", padx=12)
        ctk.CTkButton(btn_frame, text="📄 Generate Checklist", command=self._generate_checklist, height=32).pack(side="left", padx=4)
        ctk.CTkButton(btn_frame, text="📊 Generate Flow", command=self._generate_flow, height=32).pack(side="left", padx=4)
        ctk.CTkButton(btn_frame, text="📤 Export Report", command=self._export, height=32).pack(side="left", padx=4)

        # Tabs
        self.tab_view = ctk.CTkTabview(self)
        self.tab_view.pack(fill="both", expand=True, padx=16, pady=(0, 16))
        
        self.tab_checklist = self.tab_view.add("✅ Checklist")
        self.tab_flow = self.tab_view.add("📊 Flow Diagram")
        self.tab_report = self.tab_view.add("📄 Report")

        self._build_checklist_tab()
        self._build_flow_tab()
        self._build_report_tab()

    def _build_checklist_tab(self):
        scroll = ctk.CTkScrollableFrame(self.tab_checklist)
        scroll.pack(fill="both", expand=True)
        scroll.grid_columnconfigure(0, weight=1)

        self.checklist_items = {}
        prisma_items = [
            ("Title", "Identify the report as a systematic review, meta-analysis, or both."),
            ("Abstract", "Provide a structured summary including background, objectives, data sources, eligibility criteria, participants, interventions, appraisal methods, results, limitations, conclusions."),
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
            ("Study Selection", "Give numbers of studies screened, assessed for eligibility, included, with reasons for exclusions."),
            ("Study Characteristics", "Present characteristics for which data were extracted."),
            ("Risk of Bias Results", "Present data on risk of bias of each study."),
            ("Individual Study Results", "Present simple summary data and effect estimates with confidence intervals."),
            ("Synthesis Results", "Present results of each meta-analysis with confidence intervals and consistency measures."),
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
            
            ctk.CTkLabel(frame, text=desc, wraplength=600, justify="left", font=ctk.CTkFont(size=11)).grid(row=0, column=1, sticky="w", padx=12, pady=8)
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
        input_frame.grid_columnconfigure((1,3,5), weight=1)

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
            entry.grid(row=row, column=col+1, padx=8, pady=8)
            entry.insert(0, "0")
            self.flow_inputs[key] = entry

        ctk.CTkButton(input_frame, text="🔄 Generate Diagram", command=self._draw_flow, height=36).grid(row=4, column=0, columnspan=6, pady=12)

        # Canvas for flow diagram
        self.flow_canvas = tk.Canvas(flow_frame, bg="#2b2b2b", highlightthickness=0)
        self.flow_canvas.grid(row=1, column=0, sticky="nsew")
        flow_frame.grid_rowconfigure(1, weight=1)

    def _build_report_tab(self):
        self.report_text = ctk.CTkTextbox(self.tab_report, font=ctk.CTkFont(family="Consolas", size=11))
        self.report_text.pack(fill="both", expand=True, padx=16, pady=16)

    def _generate_checklist(self):
        # Auto-fill checklist based on project data
        data = self.app.project_data
        
        # Title - always check if project exists
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
        
        messagebox.showinfo("Checklist", "PRISMA checklist auto-filled based on project data. Review and adjust as needed.")

    def _draw_flow(self):
        try:
            vals = {k: int(v.get()) for k, v in self.flow_inputs.items()}
        except ValueError:
            messagebox.showerror("Error", "Please enter valid numbers in all fields")
            return

        self.flow_canvas.delete("all")
        w = self.flow_canvas.winfo_width() or 800
        h = self.flow_canvas.winfo_height() or 600
        
        # Colors
        box_color = "#3d3d3d"
        text_color = "#ffffff"
        arrow_color = "#aaaaaa"
        highlight = "#4CAF50"
        
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
            self.flow_canvas.create_rectangle(x_center, y, x_center + box_w, y + box_h, 
                                             fill=box_color, outline=highlight, width=2)
            self.flow_canvas.create_text(x_center + box_w//2, y + box_h//2, 
                                        text=f"{label}\nn = {count}", fill=text_color, font=("Segoe UI", 11), justify="center")
            
            # Arrow to next
            if i < len(steps) - 1:
                arrow_y = y + box_h
                self.flow_canvas.create_line(x_center + box_w//2, arrow_y, 
                                            x_center + box_w//2, arrow_y + gap,
                                            fill=arrow_color, width=2, arrow=tk.LAST)
                y = arrow_y + gap
        
        # Excluded boxes on the side
        side_x = x_center + box_w + 80
        if vals["excluded_ta"] > 0:
            y = y_start + box_h + gap
            self.flow_canvas.create_rectangle(side_x, y, side_x + 250, y + box_h,
                                             fill="#5d2d2d", outline="#ff6b6b", width=2)
            self.flow_canvas.create_text(side_x + 125, y + box_h//2,
                                        text=f"Excluded (title/abstract)\nn = {vals['excluded_ta']}", fill=text_color, font=("Segoe UI", 10), justify="center")
            # Arrow from step 2
            self.flow_canvas.create_line(x_center + box_w, y + box_h//2,
                                        side_x, y + box_h//2, fill=arrow_color, width=2, arrow=tk.LAST)

        if vals["excluded_ft"] > 0:
            y = y_start + 3*(box_h + gap)
            self.flow_canvas.create_rectangle(side_x, y, side_x + 250, y + box_h,
                                             fill="#5d2d2d", outline="#ff6b6b", width=2)
            self.flow_canvas.create_text(side_x + 125, y + box_h//2,
                                        text=f"Excluded (full text)\nn = {vals['excluded_ft']}", fill=text_color, font=("Segoe UI", 10), justify="center")
            self.flow_canvas.create_line(x_center + box_w, y + box_h//2,
                                        side_x, y + box_h//2, fill=arrow_color, width=2, arrow=tk.LAST)

    def _generate_flow(self):
        # Auto-populate from screening data
        data = self.app.project_data
        ta = data.get("screening", {}).get("title_abstract", [])
        ft = data.get("screening", {}).get("full_text", [])
        
        identified = len(ta)
        excluded_ta = sum(1 for r in ta if r.get("decision") is False)
        assessed = sum(1 for r in ft if r.get("decision") is not None)
        excluded_ft = sum(1 for r in ft if r.get("decision") is False)
        included = sum(1 for r in ft if r.get("decision") is True)
        
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
        self.flow_inputs["sought"].insert(0, str(assessed + sum(1 for r in ft if r.get("decision") is None)))
        self.flow_inputs["not_retrieved"].delete(0, "end")
        self.flow_inputs["not_retrieved"].insert(0, "0")
        
        self._draw_flow()
        messagebox.showinfo("Flow", "Flow diagram auto-populated from screening data")

    def _export(self):
        if not self.app.project_path:
            messagebox.showwarning("Warning", "No project open")
            return
        
        # Generate comprehensive PRISMA report
        report = {
            "checklist": {k: v.get() for k, v in self.checklist_items.items()},
            "flow": {k: v.get() for k, v in self.flow_inputs.items()},
            "generated": datetime.now().isoformat(),
        }
        
        path = self.app.project_path / "prisma_report.json"
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(report, fh, indent=2)
        
        # Also generate text report
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
        
        self.report_text.insert("0.0", text)
        
        messagebox.showinfo("Exported", f"PRISMA report exported to:\n{path}")


def main():
    app = PoolrApp()
    app.protocol("WM_DELETE_WINDOW", app.on_closing)
    app.mainloop()


if __name__ == "__main__":
    main()