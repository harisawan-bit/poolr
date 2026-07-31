"""poolr — standalone GUI for systematic reviews and meta-analyses.

Platform: Windows / macOS / Linux
GUI: CustomTkinter
"""

__version__ = "0.3.3"

__all__ = ["main", "__version__"]


def main():
    """Launch the poolr GUI (console-script entry point)."""
    from poolr.main import main as _gui_main

    return _gui_main()
