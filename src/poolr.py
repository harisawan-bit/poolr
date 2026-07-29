"""
poolr — standalone GUI for systematic reviews and meta-analyses.
Platform: Windows / macOS / Linux
GUI: CustomTkinter
"""

import customtkinter as ctk
import tkinter as tk
from tkinter import filedialog, messagebox
import json
import os
from pathlib import Path

ctk.set_appearance_mode("dark")
ctk.set_default_color_theme("dark-blue")


class PoolrApp(ctk.CTk):
    def __init__(self):
        super().__init__()

        self.title("poolr — Systematic Review & Meta-Analysis")
        self.geometry("1200x800")
        self.minsize(1000, 700)

        self.project_path = None
        self.project_data = {
            "pico": {},
            "search_strategies": {},
            "screening": {},
            "extraction": {},
            "rob": {},
            "meta": {},
        }

        self.grid_columnconfigure(1, weight=1)
        self.grid_rowconfigure(0, weight=1)

        self._build_sidebar()
        self._build_main_area()

        self._pages = {}
        self._select_page("dashboard")

    def _build_sidebar(self):
        self.sidebar = ctk.CTkFrame(self, width=220, corner_radius=0)
        self.sidebar.grid(row=0, column=0, sticky="nsew")
        self.sidebar.grid_rowconfigure(6, weight=1)

        ctk.CTkLabel(self.sidebar, text="poolr", font=ctk.CTkFont(size=22, weight="bold")).grid(
            row=0, column=0, padx=20, pady=(20, 5)
        )
        ctk.CTkLabel(self.sidebar, text="SRMA Studio", font=ctk.CTkFont(size=12)).grid(
            row=1, column=0, padx=20, pady=(0, 20)
        )

        self.nav_buttons = {}
        pages = [
            ("Dashboard", "dashboard"),
            ("Protocol / PICO", "protocol"),
            ("Search", "search"),
            ("Screening", "screening"),
            ("Extraction", "extraction"),
            ("Risk of Bias", "rob"),
            ("Meta-Analysis", "meta"),
            ("PRISMA", "prisma"),
        ]
        for idx, (label, key) in enumerate(pages, start=2):
            btn = ctk.CTkButton(self.sidebar, text=label, anchor="w", height=36)
            btn.grid(row=idx, column=0, padx=16, pady=4, sticky="ew")
            self.nav_buttons[key] = btn

        self.project_btn = ctk.CTkButton(self.sidebar, text="Open Project", command=self._open_project)
        self.project_btn.grid(row=8, column=0, padx=16, pady=(0, 12), sticky="ew")

        self.status_label = ctk.CTkLabel(self.sidebar, text="No project loaded")
        self.status_label.grid(row=9, column=0, padx=20, pady=(0, 20))

    def _build_main_area(self):
        self.main_area = ctk.CTkFrame(self, corner_radius=10)
        self.main_area.grid(row=0, column=1, sticky="nsew", padx=16, pady=16)
        self.main_area.grid_rowconfigure(1, weight=1)
        self.main_area.grid_columnconfigure(0, weight=1)

        self.title_label = ctk.CTkLabel(self.main_area, text="Dashboard", font=ctk.CTkFont(size=26, weight="bold"))
        self.title_label.grid(row=0, column=0, padx=20, pady=(20, 10), sticky="w")

        self.page_container = ctk.CTkFrame(self.main_area, fg_color="transparent")
        self.page_container.grid(row=1, column=0, sticky="nsew", padx=20, pady=(10, 20))

    def _select_page(self, key):
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
        self.title_label.configure(text=self.nav_buttons[key].cget("text") if key != "dashboard" else "Dashboard")

        for k, btn in self.nav_buttons.items():
            btn.configure(fg_color=("gray75", "gray25") if k == key else "transparent")

    def _open_project(self):
        path = filedialog.askdirectory(title="Open poolr project folder")
        if path:
            self.project_path = Path(path)
            pool_json = self.project_path / "poolr.json"
            if pool_json.exists():
                with open(pool_json, "r", encoding="utf-8") as fh:
                    self.project_data = json.load(fh)
            else:
                self.project_data = {
                    "pico": {},
                    "search_strategies": {},
                    "screening": {},
                    "extraction": {},
                    "rob": {},
                    "meta": {},
                }
            self.status_label.configure(text=f"Project: {self.project_path.name}")

    def save_project(self):
        if not self.project_path:
            return
        out = self.project_path / "poolr.json"
        with open(out, "w", encoding="utf-8") as fh:
            json.dump(self.project_data, fh, indent=2)


class DashboardPage(ctk.CTkFrame):
    def __init__(self, master, app: PoolrApp):
        super().__init__(master)
        self.app = app
        self._build()

    def _build(self):
        ctk.CTkLabel(self, text="Systematic review pipeline", font=ctk.CTkFont(size=18)).pack(anchor="w")
        ctk.CTkLabel(self, text="Use the sidebar to move through each SRMA phase.").pack(anchor="w", pady=(6, 0))
        ctk.CTkLabel(self, text="All data is saved into poolr.json inside the open project folder.").pack(anchor="w", pady=(6, 0))


class ProtocolPage(ctk.CTkFrame):
    def __init__(self, master, app: PoolrApp):
        super().__init__(master)
        self.app = app
        self._build()

    def _build(self):
        self.entries = {}
        for label, key in [("Population", "population"), ("Intervention", "intervention"), ("Comparator", "comparator"), ("Outcomes", "outcomes")]:
            ctk.CTkLabel(self, text=label).pack(anchor="w", pady=(10, 2))
            entry = ctk.CTkEntry(self)
            entry.pack(fill="x")
            self.entries[key] = entry

        ctk.CTkButton(self, text="Save PICO", command=self._save).pack(pady=20)

    def _save(self):
        self.app.project_data["pico"] = {k: v.get() for k, v in self.entries.items()}
        self.app.save_project()
        messagebox.showinfo("Saved", "PICO saved to poolr.json")


class SearchPage(ctk.CTkFrame):
    def __init__(self, master, app):
        super().__init__(master)
        self.app = app
        self._build()

    def _build(self):
        ctk.CTkLabel(self, text="Search strategy builder").pack(anchor="w")
        self.text = ctk.CTkTextbox(self, height=400)
        self.text.pack(fill="both", expand=True, pady=10)
        ctk.CTkButton(self, text="Save strategy", command=self._save).pack()

    def _save(self):
        self.app.project_data["search_strategies"]["generated"] = self.text.get("0.0", "end")
        self.app.save_project()
        messagebox.showinfo("Saved", "Search strategy saved.")


class ScreeningPage(ctk.CTkFrame):
    def __init__(self, master, app):
        super().__init__(master)
        self.app = app
        self._build()

    def _build(self):
        ctk.CTkLabel(self, text="Screening workspace").pack(anchor="w")
        ctk.CTkButton(self, text="Load screened records", command=self._load).pack(pady=10)

    def _load(self):
        path = filedialog.askopenfilename(title="Select screened CSV")
        if path:
            self.app.project_data["screening"]["file"] = str(path)
            self.app.save_project()
            messagebox.showinfo("Loaded", f"Screening file loaded:\n{path}")


class ExtractionPage(ctk.CTkFrame):
    def __init__(self, master, app):
        super().__init__(master)
        self.app = app
        self._build()

    def _build(self):
        ctk.CTkLabel(self, text="Data extraction").pack(anchor="w")
        ctk.CTkButton(self, text="Import extraction CSV", command=self._import).pack(pady=10)

    def _import(self):
        path = filedialog.askopenfilename(title="Select extraction CSV", filetypes=[("CSV", "*.csv")])
        if path:
            self.app.project_data["extraction"]["file"] = str(path)
            self.app.save_project()
            messagebox.showinfo("Imported", f"Extraction data loaded:\n{path}")


class RoBPage(ctk.CTkFrame):
    def __init__(self, master, app):
        super().__init__(master)
        self.app = app
        self._build()

    def _build(self):
        ctk.CTkLabel(self, text="Risk of Bias").pack(anchor="w")
        ctk.CTkOptionMenu(self, values=["RoB 2", "NOS", "PROBAST"]).pack(pady=10)


class MetaPage(ctk.CTkFrame):
    def __init__(self, master, app):
        super().__init__(master)
        self.app = app
        self._build()

    def _build(self):
        ctk.CTkLabel(self, text="Meta-analysis").pack(anchor="w")
        ctk.CTkOptionMenu(self, values=["Random-effects", "Fixed-effect"]).pack(pady=10)
        ctk.CTkButton(self, text="Run analysis", command=self._run).pack(pady=10)

    def _run(self):
        messagebox.showinfo("Meta", "Run real meta-analysis logic here.")


class PrismaPage(ctk.CTkFrame):
    def __init__(self, master, app):
        super().__init__(master)
        self.app = app
        self._build()

    def _build(self):
        ctk.CTkLabel(self, text="PRISMA output").pack(anchor="w")
        ctk.CTkButton(self, text="Export PRISMA summary", command=self._export).pack(pady=10)

    def _export(self):
        messagebox.showinfo("PRISMA", "Export PRISMA checklist/flow here.")


def main():
    app = PoolrApp()
    app.mainloop()


if __name__ == "__main__":
    main()
