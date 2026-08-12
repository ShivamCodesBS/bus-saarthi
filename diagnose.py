#!/usr/bin/env python3
"""
System Diagnostics Script
Verify installation and system requirements
"""

import sys
import importlib
import subprocess
import os
from datetime import datetime


class SystemDiagnostics:
    """Check system requirements and dependencies."""

    def __init__(self):
        """Initialize diagnostics."""
        self.results = []
        self.errors = []
        self.warnings = []

    def log(self, category: str, status: str, message: str):
        """Log diagnostic result."""
        symbol = "✓" if status == "OK" else "⚠" if status == "WARNING" else "✗"
        self.results.append((category, status, message, symbol))

    def print_header(self):
        """Print diagnostic header."""
        print("\n" + "="*70)
        print("   BUS MANAGEMENT - SYSTEM DIAGNOSTICS")
        print("="*70 + "\n")

    def print_results(self):
        """Print all results."""
        print("\n" + "-"*70)
        print("DIAGNOSTIC RESULTS")
        print("-"*70 + "\n")

        for category, status, message, symbol in self.results:
            print(f"  {symbol} [{status:<7}] {category:<25} {message}")

        print("\n" + "-"*70)

    def print_summary(self):
        """Print summary."""
        ok_count = sum(1 for _, s, _, _ in self.results if s == "OK")
        warning_count = sum(1 for _, s, _, _ in self.results if s == "WARNING")
        error_count = sum(1 for _, s, _, _ in self.results if s == "ERROR")

        print("\nSUMMARY:")
        print(f"  OK: {ok_count} | Warnings: {warning_count} | Errors: {error_count}")

        if error_count > 0:
            print("\n  ✗ Installation has errors - fix them before running application")
            return False
        elif warning_count > 0:
            print("\n  ⚠ Installation has warnings - may need attention")
            return True
        else:
            print("\n  ✓ Installation is OK - ready to use!")
            return True

    def check_python_version(self):
        """Check Python version."""
        version = sys.version_info
        required_version = (3, 8)

        if version >= required_version:
            self.log(
                "Python Version",
                "OK",
                f"{version.major}.{version.minor}.{version.micro}"
            )
        else:
            self.log(
                "Python Version",
                "ERROR",
                f"Need {required_version[0]}.{required_version[1]}+, got {version.major}.{version.minor}"
            )

    def check_modules(self):
        """Check Python module imports."""
        modules = {
            'cv2': 'OpenCV',
            'numpy': 'NumPy',
            'mediapipe': 'MediaPipe',
            'face_recognition': 'face_recognition',
            'sqlite3': 'SQLite3',
            'tkinter': 'Tkinter',
            'psutil': 'psutil'
        }

        for module_name, display_name in modules.items():
            try:
                mod = importlib.import_module(module_name)
                version = getattr(mod, '__version__', 'unknown')
                self.log(
                    f"Module: {display_name}",
                    "OK",
                    f"v{version}"
                )
            except ImportError:
                self.log(
                    f"Module: {display_name}",
                    "ERROR",
                    "Not installed - run: pip install -r requirements.txt"
                )

    def check_camera(self):
        """Check webcam availability."""
        try:
            import cv2
            cap = cv2.VideoCapture(0)
            if cap.isOpened():
                self.log("Webcam", "OK", "Camera 0 available")
                cap.release()
            else:
                self.log("Webcam", "WARNING", "Camera 0 not accessible")
        except Exception as e:
            self.log("Webcam", "ERROR", f"Error checking camera: {e}")

    def check_directories(self):
        """Check required directories."""
        directories = ["data", "logs", "modules", "ui"]

        for directory in directories:
            if os.path.isdir(directory):
                self.log(f"Directory: {directory}", "OK", "exists")
            else:
                self.log(f"Directory: {directory}", "ERROR", "missing")

    def check_files(self):
        """Check required files."""
        files = {
            "main.py": "Main entry point",
            "requirements.txt": "Dependencies",
            "config.py": "Configuration",
            "README.md": "Documentation",
            "modules/detection.py": "Detection module",
            "modules/recognition.py": "Recognition module",
            "modules/database.py": "Database module",
            "modules/registration.py": "Registration module",
            "modules/attendance.py": "Attendance module",
            "ui/main_ui.py": "GUI module"
        }

        for filepath, description in files.items():
            if os.path.isfile(filepath):
                size = os.path.getsize(filepath)
                self.log(f"File: {filepath}", "OK", f"{size} bytes")
            else:
                self.log(f"File: {filepath}", "ERROR", "missing")

    def check_system_resources(self):
        """Check system resources."""
        try:
            import psutil

            # CPU cores
            cpu_count = psutil.cpu_count()
            self.log("CPU Cores", "OK" if cpu_count >= 2 else "WARNING", str(cpu_count))

            # Memory
            memory = psutil.virtual_memory()
            memory_gb = memory.total / (1024**3)
            status = "OK" if memory_gb >= 2 else "WARNING"
            self.log("Total Memory", status, f"{memory_gb:.2f} GB")

            # Available memory
            available_gb = memory.available / (1024**3)
            status = "OK" if available_gb >= 0.5 else "WARNING"
            self.log("Available Memory", status, f"{available_gb:.2f} GB")

            # Disk space
            disk = psutil.disk_usage("/")
            disk_gb = disk.free / (1024**3)
            status = "OK" if disk_gb >= 1 else "WARNING"
            self.log("Free Disk Space", status, f"{disk_gb:.2f} GB")

        except Exception as e:
            self.log("System Resources", "WARNING", f"Cannot check: {e}")

    def check_database(self):
        """Check database initialization."""
        try:
            from modules.database import AttendanceDatabase
            db = AttendanceDatabase(db_path="data/attendance.db")
            stats = db.get_statistics()
            db.close()
            self.log("Database", "OK", f"{stats.get('total_students', 0)} students")
        except Exception as e:
            self.log("Database", "ERROR", f"Error: {e}")

    def check_linux_specific(self):
        """Check Linux-specific requirements."""
        import platform

        if platform.system() == "Linux":
            self.log("Operating System", "OK", platform.platform())

            # Check for display
            if os.environ.get('DISPLAY'):
                self.log("Display Server", "OK", "X11/Wayland available")
            else:
                self.log("Display Server", "WARNING", "No DISPLAY - GUI may not work")
        else:
            self.log("Operating System", "WARNING", f"{platform.system()} (tested on Linux)")

    def run_all_checks(self) -> bool:
        """Run all diagnostics."""
        self.print_header()

        print("Running diagnostics...\n")

        self.check_python_version()
        print("  [✓] Python version checked")

        self.check_modules()
        print("  [✓] Python modules checked")

        self.check_camera()
        print("  [✓] Webcam checked")

        self.check_directories()
        print("  [✓] Directories checked")

        self.check_files()
        print("  [✓] Files checked")

        self.check_system_resources()
        print("  [✓] System resources checked")

        self.check_database()
        print("  [✓] Database checked")

        self.check_linux_specific()
        print("  [✓] Linux-specific checks done")

        self.print_results()
        return self.print_summary()


def main():
    """Run diagnostics."""
    diagnostics = SystemDiagnostics()
    success = diagnostics.run_all_checks()

    print("\n" + "="*70)

    if success:
        print("\nTo start the application:")
        print("  python3 main.py              # GUI mode")
        print("  python3 main.py --cli        # CLI mode")
        print("  python3 main.py --register   # Registration mode")
        print("  python3 main.py --recognize  # Recognition mode")
    else:
        print("\nPlease fix the errors above before running the application.")
        print("\nTo install dependencies:")
        print("  pip install -r requirements.txt")
        print("\nFor system dependencies on Ubuntu/Debian:")
        print("  bash install_dependencies.sh")

    print("\n" + "="*70 + "\n")

    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())
