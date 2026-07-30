"""
Base page class for all pages
"""

import customtkinter as ctk


class BasePage(ctk.CTkFrame):
    def __init__(self, master, app):
        super().__init__(master)
        self.app = app
    
    def on_enter(self):
        """Called when page becomes active"""
        pass
    
    def on_leave(self):
        """Called when leaving page"""
        pass
    
    def refresh(self):
        """Refresh page data from project"""
        pass