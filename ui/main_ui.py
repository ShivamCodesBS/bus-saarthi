"""
Tkinter GUI Module
Clean desktop interface for the attendance system.
"""

import tkinter as tk
from tkinter import ttk, messagebox, scrolledtext
import os
import threading
from modules.registration import LiveRegistration
from modules.attendance import RealtimeAttendance
from modules.database import AttendanceDatabase
from modules.utils import log_message, get_database_size


class AttendanceSystemGUI:
    """
    Main GUI for the face recognition attendance system.
    Built with Tkinter for cross-platform compatibility.
    """

    def __init__(self, root: tk.Tk):
        """
        Initialize GUI.

        Args:
            root: Tkinter root window
        """
        self.root = root
        self.root.title("Bus Management - Face Recognition Attendance System")
        self.root.geometry("800x700")
        self.root.resizable(True, True)

        # Initialize components
        self.db = AttendanceDatabase(db_path="data/attendance.db")
        self.registration = None
        self.attendance = None

        # Create GUI
        self.create_menu()
        self.create_main_frame()

        # Log startup
        log_message("Application started")

    def create_menu(self):
        """Create menu bar."""
        menubar = tk.Menu(self.root)
        self.root.config(menu=menubar)

        # File menu
        file_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="File", menu=file_menu)
        file_menu.add_command(label="System Info", command=self.show_system_info)
        file_menu.add_separator()
        file_menu.add_command(label="Exit", command=self.root.quit)

        # Help menu
        help_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="Help", menu=help_menu)
        help_menu.add_command(label="About", command=self.show_about)
        help_menu.add_command(label="Documentation", command=self.show_documentation)

    def create_main_frame(self):
        """Create main frame with tabs."""
        # Create notebook (tab widget)
        self.notebook = ttk.Notebook(self.root)
        self.notebook.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)

        # Create tabs
        self.create_dashboard_tab()
        self.create_registration_tab()
        self.create_recognition_tab()
        self.create_attendance_tab()
        self.create_admin_tab()

    def create_dashboard_tab(self):
        """Create dashboard tab."""
        tab = ttk.Frame(self.notebook)
        self.notebook.add(tab, text="Dashboard")

        # Title
        title_label = ttk.Label(
            tab,
            text="Face Recognition Attendance System",
            font=("Arial", 16, "bold")
        )
        title_label.pack(pady=20)

        # Statistics frame
        stats_frame = ttk.LabelFrame(tab, text="System Statistics", padding=15)
        stats_frame.pack(fill=tk.BOTH, expand=True, padx=20, pady=20)

        # Refresh stats button
        refresh_btn = ttk.Button(
            stats_frame,
            text="Refresh Statistics",
            command=self.refresh_statistics
        )
        refresh_btn.pack(pady=10)

        # Stats display
        self.stats_text = scrolledtext.ScrolledText(
            stats_frame,
            height=12,
            width=60,
            state=tk.DISABLED
        )
        self.stats_text.pack(fill=tk.BOTH, expand=True)

        # Initial stats
        self.refresh_statistics()

    def refresh_statistics(self):
        """Refresh and display statistics."""
        stats = self.db.get_statistics()

        stats_text = f"""
╔════════════════════════════════════════════╗
║         SYSTEM STATISTICS                  ║
╠════════════════════════════════════════════╣
║                                            ║
║  Total Registered Passengers:     {stats.get('total_passengers', 0):>10}    ║
║  Total Face Encodings Stored:   {stats.get('total_embeddings', 0):>10}    ║
║  Total Attendance Records:      {stats.get('total_attendance', 0):>10}    ║
║  Today's Attendance:            {stats.get('today_attendance', 0):>10}    ║
║                                            ║
║  Database Size: {get_database_size():>27}        ║
║                                            ║
╚════════════════════════════════════════════╝
        """

        self.stats_text.config(state=tk.NORMAL)
        self.stats_text.delete(1.0, tk.END)
        self.stats_text.insert(1.0, stats_text)
        self.stats_text.config(state=tk.DISABLED)

    def create_registration_tab(self):
        """Create registration tab."""
        tab = ttk.Frame(self.notebook)
        self.notebook.add(tab, text="Register Passenger")

        # Title
        title_label = ttk.Label(
            tab,
            text="Live Face Registration",
            font=("Arial", 14, "bold")
        )
        title_label.pack(pady=20)

        # Form frame
        form_frame = ttk.LabelFrame(tab, text="Passenger Information", padding=15)
        form_frame.pack(fill=tk.BOTH, expand=True, padx=20, pady=10)

        # Name
        ttk.Label(form_frame, text="Name:").grid(row=0, column=0, sticky=tk.W, pady=5)
        self.reg_name = ttk.Entry(form_frame, width=30)
        self.reg_name.grid(row=0, column=1, sticky=tk.EW, pady=5)

        # Passenger ID
        ttk.Label(form_frame, text="Passenger ID:").grid(row=1, column=0, sticky=tk.W, pady=5)
        self.reg_passenger_id = ttk.Entry(form_frame, width=30)
        self.reg_passenger_id.grid(row=1, column=1, sticky=tk.EW, pady=5)

        # Fee Status
        ttk.Label(form_frame, text="Fee Status:").grid(row=2, column=0, sticky=tk.W, pady=5)
        self.reg_fee_status = ttk.Combobox(
            form_frame,
            values=["unpaid", "paid"],
            state="readonly",
            width=27
        )
        self.reg_fee_status.set("unpaid")
        self.reg_fee_status.grid(row=2, column=1, sticky=tk.EW, pady=5)

        # Phone
        ttk.Label(form_frame, text="Phone (optional):").grid(row=3, column=0, sticky=tk.W, pady=5)
        self.reg_phone = ttk.Entry(form_frame, width=30)
        self.reg_phone.grid(row=3, column=1, sticky=tk.EW, pady=5)

        # Configure columns
        form_frame.columnconfigure(1, weight=1)

        # Register button
        register_btn = ttk.Button(
            tab,
            text="Start Registration",
            command=self.start_registration,
            width=20
        )
        register_btn.pack(pady=20)

        # Info label
        info_label = ttk.Label(
            tab,
            text="Note: A webcam will open to capture multiple face images.\n"
                 "Move your head around for better angle coverage.",
            font=("Arial", 9),
            foreground="gray"
        )
        info_label.pack()

    def start_registration(self):
        """Start registration process."""
        name = self.reg_name.get().strip()
        passenger_id = self.reg_passenger_id.get().strip()
        fee_status = self.reg_fee_status.get()
        phone = self.reg_phone.get().strip()

        # Validation
        if not name:
            messagebox.showerror("Error", "Name cannot be empty")
            return

        if not passenger_id:
            messagebox.showerror("Error", "Passenger ID cannot be empty")
            return

        # Run registration in thread to avoid GUI freeze
        def run_registration():
            try:
                # Capture 100 frames to ensure we have extremely robust, high-quality data
                self.registration = LiveRegistration(num_captures=100)

                face_images, success = self.registration.capture_faces()

                if not success:
                    messagebox.showerror("Error", "Failed to capture faces")
                    return

                encoding_scores = self.registration.generate_encodings(face_images)

                if not encoding_scores:
                    messagebox.showerror("Error", "Failed to generate face encodings")
                    return

                best_encodings = self.registration.select_best_encodings(encoding_scores)
                avg_encoding = self.registration.average_encoding(best_encodings)

                # Register in database
                from modules.recognition import encode_embedding

                self.db.register_passenger(passenger_id, name, fee_status, phone, "")

                num_stored = 0
                for encoding, quality in encoding_scores:
                    embedding_str = encode_embedding(encoding)
                    if self.db.store_embedding(passenger_id, embedding_str, quality):
                        num_stored += 1
                        
                        # Add to sync queue
                        self.db.add_to_sync_queue(
                            data_type='encoding',
                            payload={
                                'passenger_id': passenger_id,
                                'embedding': embedding_str,
                                'quality_score': quality
                            }
                        )

                avg_embedding_str = encode_embedding(avg_encoding)
                if self.db.store_embedding(passenger_id, avg_embedding_str, 1.0):
                    self.db.add_to_sync_queue(
                        data_type='encoding',
                        payload={
                            'passenger_id': passenger_id,
                            'embedding': avg_embedding_str,
                            'quality_score': 1.0
                        }
                    )

                messagebox.showinfo(
                    "Success",
                    f"Passenger registered successfully!\n"
                    f"Name: {name}\n"
                    f"Passenger ID: {passenger_id}\n"
                    f"Encodings stored: {num_stored + 1}"
                )

                log_message(f"Passenger registered: {name} ({passenger_id})")

                # Clear form
                self.reg_name.delete(0, tk.END)
                self.reg_passenger_id.delete(0, tk.END)
                self.reg_phone.delete(0, tk.END)

                # Refresh stats
                self.refresh_statistics()

            except Exception as e:
                messagebox.showerror("Error", f"Registration failed: {e}")
                log_message(f"Registration error: {e}")

        # Run on main thread to prevent OpenCV crashes on macOS
        run_registration()

    def create_recognition_tab(self):
        """Create real-time recognition tab."""
        tab = ttk.Frame(self.notebook)
        self.notebook.add(tab, text="Recognition")

        # Title
        title_label = ttk.Label(
            tab,
            text="Real-time Face Recognition",
            font=("Arial", 14, "bold")
        )
        title_label.pack(pady=20)

        # Settings frame
        settings_frame = ttk.LabelFrame(tab, text="Settings", padding=15)
        settings_frame.pack(fill=tk.X, padx=20, pady=10)

        # Confidence threshold
        ttk.Label(settings_frame, text="Confidence Threshold:").pack(side=tk.LEFT, padx=5)
        self.rec_threshold = tk.Scale(
            settings_frame,
            from_=0.3,
            to=1.0,
            resolution=0.05,
            orient=tk.HORIZONTAL,
            length=200
        )
        self.rec_threshold.set(0.45)
        self.rec_threshold.pack(side=tk.LEFT, padx=5)

        # Start button
        start_btn = ttk.Button(
            tab,
            text="Start Recognition",
            command=self.start_recognition,
            width=20
        )
        start_btn.pack(pady=20)

        # Info label
        info_label = ttk.Label(
            tab,
            text="A webcam window will open. Press 'q' to exit.\n"
                 "Green box = Paid fee (Access granted)\n"
                 "Red box = Unpaid fee (Fees pending)\n"
                 "Blue box = Unknown face",
            font=("Arial", 9),
            foreground="gray"
        )
        info_label.pack()

    def start_recognition(self):
        """Start recognition process."""
        def run_recognition():
            try:
                threshold = self.rec_threshold.get()
                self.attendance = RealtimeAttendance(confidence_threshold=threshold)
                messagebox.showinfo(
                    "Starting",
                    "Recognition will start. A webcam window will open.\n"
                    "Press 'q' in the webcam window to exit."
                )
                self.attendance.start_recognition(self.db, camera_id=0, timeout_seconds=600)
                log_message("Recognition session ended")
                self.refresh_statistics()

            except Exception as e:
                messagebox.showerror("Error", f"Recognition failed: {e}")
                log_message(f"Recognition error: {e}")

        # Run on main thread to prevent OpenCV crashes on macOS
        run_recognition()

    def create_attendance_tab(self):
        """Create attendance viewing tab."""
        tab = ttk.Frame(self.notebook)
        self.notebook.add(tab, text="View Attendance")

        # Title
        title_label = ttk.Label(
            tab,
            text="Attendance Records",
            font=("Arial", 14, "bold")
        )
        title_label.pack(pady=20)

        # Filter frame
        filter_frame = ttk.Frame(tab)
        filter_frame.pack(fill=tk.X, padx=20, pady=10)

        ttk.Label(filter_frame, text="Passenger ID (optional):").pack(side=tk.LEFT, padx=5)
        self.att_filter_id = ttk.Entry(filter_frame, width=20)
        self.att_filter_id.pack(side=tk.LEFT, padx=5)

        refresh_btn = ttk.Button(
            filter_frame,
            text="Refresh",
            command=self.refresh_attendance
        )
        refresh_btn.pack(side=tk.LEFT, padx=5)

        export_btn = ttk.Button(
            filter_frame,
            text="Export to CSV",
            command=self.export_attendance
        )
        export_btn.pack(side=tk.LEFT, padx=5)

        # Table frame with scrollbar
        table_frame = ttk.Frame(tab)
        table_frame.pack(fill=tk.BOTH, expand=True, padx=20, pady=10)

        # Scrollbar
        scrollbar = ttk.Scrollbar(table_frame)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)

        # Text widget
        self.att_text = scrolledtext.ScrolledText(
            table_frame,
            height=15,
            width=90,
            state=tk.DISABLED,
            yscrollcommand=scrollbar.set
        )
        self.att_text.pack(fill=tk.BOTH, expand=True)
        scrollbar.config(command=self.att_text.yview)

        # Initial load
        self.refresh_attendance()

    def refresh_attendance(self):
        """Refresh attendance display."""
        passenger_id = self.att_filter_id.get().strip() or None

        records = self.db.get_attendance_records(passenger_id=passenger_id, limit=100)

        display_text = f"{'ID':<12} {'Name':<20} {'Check-in':<20} {'Fee Status':<12} {'Confidence':<12}\n"
        display_text += "-" * 76 + "\n"

        for record in records:
            passenger_id_str = str(record.get('passenger_id', 'N/A'))[:12]
            name = str(record.get('name', 'N/A'))[:20]
            check_in = str(record.get('check_in_time', 'N/A'))[:20]
            fee_status = str(record.get('fee_status', 'N/A')).upper()[:12]
            confidence = f"{record.get('confidence', 0):.2f}"[:12]

            display_text += f"{passenger_id_str:<12} {name:<20} {check_in:<20} {fee_status:<12} {confidence:<12}\n"

        self.att_text.config(state=tk.NORMAL)
        self.att_text.delete(1.0, tk.END)
        self.att_text.insert(1.0, display_text)
        self.att_text.config(state=tk.DISABLED)

    def export_attendance(self):
        """Export attendance to CSV."""
        try:
            output_file = "attendance_export.csv"
            self.db.export_attendance_csv(output_file)
            messagebox.showinfo("Success", f"Attendance exported to {output_file}")
            log_message(f"Attendance exported to {output_file}")
        except Exception as e:
            messagebox.showerror("Error", f"Export failed: {e}")

    def create_admin_tab(self):
        """Create admin/management tab."""
        tab = ttk.Frame(self.notebook)
        self.notebook.add(tab, text="Admin")

        # Title
        title_label = ttk.Label(
            tab,
            text="Admin Management",
            font=("Arial", 14, "bold")
        )
        title_label.pack(pady=20)

        # Passengers management frame
        passengers_frame = ttk.LabelFrame(tab, text="Passengers Management", padding=15)
        passengers_frame.pack(fill=tk.BOTH, expand=True, padx=20, pady=10)

        # View all passengers
        view_btn = ttk.Button(
            passengers_frame,
            text="View All Registered Passengers",
            command=self.view_all_passengers
        )
        view_btn.pack(pady=10)

        # Passengers display
        self.admin_text = scrolledtext.ScrolledText(
            passengers_frame,
            height=10,
            width=70,
            state=tk.DISABLED
        )
        self.admin_text.pack(fill=tk.BOTH, expand=True, pady=10)

        # Manage passenger frame
        manage_frame = ttk.LabelFrame(tab, text="Manage Passenger", padding=15)
        manage_frame.pack(fill=tk.X, padx=20, pady=10)

        ttk.Label(manage_frame, text="Passenger ID:").pack(side=tk.LEFT, padx=5)
        self.mng_passenger_id = ttk.Entry(manage_frame, width=15)
        self.mng_passenger_id.pack(side=tk.LEFT, padx=5)

        edit_btn = ttk.Button(
            manage_frame,
            text="Edit Details",
            command=self.open_edit_passenger_dialog
        )
        edit_btn.pack(side=tk.LEFT, padx=5)

        delete_btn = ttk.Button(
            manage_frame,
            text="Delete Passenger",
            command=self.delete_passenger_gui
        )
        delete_btn.pack(side=tk.LEFT, padx=5)

        # Danger Zone frame
        danger_frame = ttk.LabelFrame(tab, text="Danger Zone", padding=15)
        danger_frame.pack(fill=tk.X, padx=20, pady=10)

        wipe_btn = ttk.Button(
            danger_frame,
            text="Wipe Entire Database (Delete All Data)",
            command=self.wipe_database_gui
        )
        wipe_btn.pack(pady=5)

        # Initial load
        self.view_all_passengers()

    def delete_passenger_gui(self):
        """Handle deleting a passenger from the GUI."""
        passenger_id = self.mng_passenger_id.get().strip()
        if not passenger_id:
            messagebox.showerror("Error", "Please enter a passenger ID to delete")
            return

        confirm = messagebox.askyesno(
            "Confirm Deletion",
            f"Are you sure you want to delete passenger '{passenger_id}' and all their face data?"
        )
        if confirm:
            if self.db.delete_passenger(passenger_id):
                messagebox.showinfo("Success", f"Passenger {passenger_id} has been deleted.")
                log_message(f"Deleted passenger {passenger_id}")
                self.mng_passenger_id.delete(0, tk.END)
                self.view_all_passengers()
                self.refresh_statistics()
            else:
                messagebox.showerror("Error", f"Failed to delete passenger {passenger_id}. They may not exist.")

    def wipe_database_gui(self):
        """Handle wiping the entire database from the GUI."""
        confirm1 = messagebox.askyesno(
            "WARNING: Destructive Action",
            "Are you absolutely sure you want to delete ALL passengers, faces, and attendance records?\n\nThis cannot be undone."
        )
        if confirm1:
            confirm2 = messagebox.askyesno(
                "Final Confirmation",
                "Are you REALLY sure? Click Yes to wipe the entire database."
            )
            if confirm2:
                if self.db.delete_all_data():
                    messagebox.showinfo("Success", "Entire database has been wiped successfully.")
                    log_message("Wiped entire database")
                    self.view_all_passengers()
                    self.refresh_statistics()
                else:
                    messagebox.showerror("Error", "Failed to wipe database.")

    def open_edit_passenger_dialog(self):
        """Open a dialog to edit passenger details."""
        passenger_id = self.mng_passenger_id.get().strip()
        if not passenger_id:
            messagebox.showerror("Error", "Please enter a passenger ID to edit")
            return

        passenger = self.db.get_passenger(passenger_id)
        if not passenger:
            messagebox.showerror("Error", f"Passenger {passenger_id} not found.")
            return

        # Create Toplevel window
        edit_win = tk.Toplevel(self.root)
        edit_win.title(f"Edit Passenger - {passenger_id}")
        edit_win.geometry("350x300")
        edit_win.transient(self.root)
        edit_win.grab_set()

        form_frame = ttk.Frame(edit_win, padding=20)
        form_frame.pack(fill=tk.BOTH, expand=True)

        # Name
        ttk.Label(form_frame, text="Name:").grid(row=0, column=0, sticky=tk.W, pady=5)
        name_entry = ttk.Entry(form_frame, width=25)
        name_entry.insert(0, passenger.get("name", ""))
        name_entry.grid(row=0, column=1, sticky=tk.EW, pady=5)

        # Fee Status
        ttk.Label(form_frame, text="Fee Status:").grid(row=1, column=0, sticky=tk.W, pady=5)
        fee_cb = ttk.Combobox(form_frame, values=["paid", "unpaid"], state="readonly", width=23)
        fee_cb.set(passenger.get("fee_status", "unpaid").lower())
        fee_cb.grid(row=1, column=1, sticky=tk.EW, pady=5)

        # Phone
        ttk.Label(form_frame, text="Phone:").grid(row=2, column=0, sticky=tk.W, pady=5)
        phone_entry = ttk.Entry(form_frame, width=25)
        phone_entry.insert(0, passenger.get("phone", "") or "")
        phone_entry.grid(row=2, column=1, sticky=tk.EW, pady=5)

        # Email
        ttk.Label(form_frame, text="Email:").grid(row=3, column=0, sticky=tk.W, pady=5)
        email_entry = ttk.Entry(form_frame, width=25)
        email_entry.insert(0, passenger.get("email", "") or "")
        email_entry.grid(row=3, column=1, sticky=tk.EW, pady=5)

        def save_details():
            new_name = name_entry.get().strip()
            new_fee = fee_cb.get().strip()
            new_phone = phone_entry.get().strip()
            new_email = email_entry.get().strip()

            if not new_name:
                messagebox.showerror("Error", "Name cannot be empty", parent=edit_win)
                return

            if self.db.update_passenger_details(passenger_id, new_name, new_fee, new_phone, new_email):
                messagebox.showinfo("Success", "Passenger details updated.", parent=edit_win)
                log_message(f"Updated details for passenger {passenger_id}")
                self.view_all_passengers()
                edit_win.destroy()
            else:
                messagebox.showerror("Error", "Failed to update details.", parent=edit_win)

        save_btn = ttk.Button(form_frame, text="Save Changes", command=save_details)
        save_btn.grid(row=4, column=0, columnspan=2, pady=20)

    def view_all_passengers(self):
        """Display all registered passengers."""
        passengers = self.db.get_all_passengers()

        display_text = f"{'ID':<15} {'Name':<25} {'Fee Status':<15} {'Registered':<20}\n"
        display_text += "-" * 75 + "\n"

        for passenger in passengers:
            passenger_id = str(passenger.get('passenger_id', 'N/A'))[:15]
            name = str(passenger.get('name', 'N/A'))[:25]
            fee_status = str(passenger.get('fee_status', 'N/A')).upper()[:15]
            reg_date = str(passenger.get('registration_date', 'N/A'))[:20]

            display_text += f"{passenger_id:<15} {name:<25} {fee_status:<15} {reg_date:<20}\n"

        self.admin_text.config(state=tk.NORMAL)
        self.admin_text.delete(1.0, tk.END)
        self.admin_text.insert(1.0, display_text)
        self.admin_text.config(state=tk.DISABLED)

    def show_system_info(self):
        """Show system information."""
        from modules.utils import get_system_info

        info = get_system_info()

        message = f"""
System Information:

OS: {info['os']}
Python Version: {info['python_version']}
CPU Cores: {info['cpu_count']}
Total Memory: {info['total_memory_gb']:.2f} GB
Available Memory: {info['available_memory_gb']:.2f} GB
CPU Usage: {info['cpu_percent']}%

Database Size: {get_database_size()}
Database Path: data/attendance.db
        """

        messagebox.showinfo("System Information", message)

    def show_about(self):
        """Show about dialog."""
        messagebox.showinfo(
            "About",
            "Bus Management - Face Recognition Attendance System\n"
            "Version 1.0.0\n\n"
            "A local, offline face recognition system for attendance tracking.\n\n"
            "Technologies:\n"
            "- MediaPipe (Face Detection)\n"
            "- face_recognition (Face Embeddings)\n"
            "- OpenCV (Video Processing)\n"
            "- SQLite (Database)\n"
            "- Tkinter (GUI)"
        )

    def show_documentation(self):
        """Show documentation."""
        doc = """
FACE RECOGNITION ATTENDANCE SYSTEM - QUICK START

1. REGISTER PASSENGER
   - Go to 'Register Passenger' tab
   - Enter passenger name, ID, and fee status
   - Click 'Start Registration'
   - Webcam will open - capture face images
   - Move head around for different angles

2. RECOGNITION
   - Go to 'Recognition' tab
   - Set confidence threshold (0.45 recommended)
   - Click 'Start Recognition'
   - Webcam will show live recognition
   - Green box: Paid fee (Access Granted)
   - Red box: Unpaid fee (Fees Pending)
   - Blue box: Unknown face

3. VIEW ATTENDANCE
   - Go to 'View Attendance' tab
   - Optionally filter by passenger ID
   - Click 'Refresh' to update
   - Click 'Export to CSV' to save

4. ADMIN
   - Go to 'Admin' tab
   - View all registered passengers
   - Check registration dates and fee status

SYSTEM REQUIREMENTS
- Linux desktop or Raspberry Pi 4
- Webcam
- Python 3.8+
- All dependencies installed (see README)

NOTES
- System runs completely offline
- No cloud APIs used
- All data stored locally
- Attendance data never leaves your device
        """

        messagebox.showinfo("Documentation", doc)


def main():
    """Main entry point for GUI."""
    root = tk.Tk()
    gui = AttendanceSystemGUI(root)
    root.mainloop()


if __name__ == "__main__":
    main()
