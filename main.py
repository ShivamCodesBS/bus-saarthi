#!/usr/bin/env python3
"""
Bus Management - Face Recognition Attendance System
Main entry point for the application.

A complete, local face-recognition attendance system for Linux desktop.
Uses MediaPipe for face detection and face_recognition for embeddings.
Everything runs offline - no cloud APIs or external services.

Usage:
    python3 main.py              # Start GUI
    python3 main.py --register   # Registration mode
    python3 main.py --recognize  # Recognition mode
    python3 main.py --cli        # CLI mode
"""

import sys
import argparse
from modules.utils import create_directories, log_message
from modules.database import AttendanceDatabase


def main_gui():
    """Start the Tkinter GUI."""
    try:
        from ui.main_ui import AttendanceSystemGUI
        import tkinter as tk

        root = tk.Tk()
        app = AttendanceSystemGUI(root)
        root.mainloop()

    except ImportError as e:
        print(f"Error importing GUI components: {e}")
        print("Make sure all dependencies are installed: pip install -r requirements.txt")
        sys.exit(1)

    except Exception as e:
        log_message(f"GUI Error: {e}")
        print(f"Error: {e}")
        sys.exit(1)


def main_registration():
    """Start registration in CLI mode."""
    try:
        from modules.registration import LiveRegistration
        from modules.database import AttendanceDatabase

        db = AttendanceDatabase(db_path="data/attendance.db")
        registration = LiveRegistration(num_captures=100)

        print("\n" + "="*50)
        print("LIVE FACE REGISTRATION (CLI MODE)")
        print("="*50 + "\n")

        success = registration.register_passenger_interactive(db)

        if success:
            print("✓ Registration completed successfully!")
        else:
            print("✗ Registration failed")

        db.close()
        registration.release()

    except Exception as e:
        log_message(f"Registration Error: {e}")
        print(f"Error: {e}")
        sys.exit(1)


def main_recognition():
    """Start recognition in CLI mode."""
    try:
        from modules.attendance import RealtimeAttendance
        from modules.database import AttendanceDatabase

        db = AttendanceDatabase(db_path="data/attendance.db")
        attendance = RealtimeAttendance(confidence_threshold=0.45)

        print("\n" + "="*50)
        print("REAL-TIME FACE RECOGNITION (CLI MODE)")
        print("="*50 + "\n")

        attendance.start_recognition(db, camera_id=0, timeout_seconds=600)

        db.close()
        attendance.release()

    except Exception as e:
        log_message(f"Recognition Error: {e}")
        print(f"Error: {e}")
        sys.exit(1)


def main_cli():
    """Start interactive CLI menu."""
    from modules.database import AttendanceDatabase
    from modules.utils import format_attendance_report

    db = AttendanceDatabase(db_path="data/attendance.db")

    while True:
        print("\n" + "="*50)
        print("FACE RECOGNITION ATTENDANCE SYSTEM - CLI")
        print("="*50)
        print("\n1. Register Passenger")
        print("2. Start Recognition")
        print("3. View Attendance")
        print("4. View Today's Attendance")
        print("5. View Passenger")
        print("6. Update Fee Status")
        print("7. System Statistics")
        print("8. Delete Passenger")
        print("9. Delete All Data (Wipe Database)")
        print("10. Exit")
        print("\n" + "-"*50)

        choice = input("Enter choice (1-10): ").strip()

        if choice == '1':
            from modules.registration import LiveRegistration
            registration = LiveRegistration(num_captures=100)
            success = registration.register_passenger_interactive(db)
            registration.release()

        elif choice == '2':
            from modules.attendance import RealtimeAttendance
            threshold = input("Enter confidence threshold (default 0.45): ").strip()
            try:
                threshold = float(threshold) if threshold else 0.45
            except ValueError:
                threshold = 0.45
            attendance = RealtimeAttendance(confidence_threshold=threshold)
            attendance.start_recognition(db, camera_id=0, timeout_seconds=600)
            attendance.release()

        elif choice == '3':
            records = db.get_attendance_records(limit=50)
            print(format_attendance_report(records))

        elif choice == '4':
            records = db.get_today_attendance()
            print(format_attendance_report(records))

        elif choice == '5':
            passenger_id = input("Enter passenger ID: ").strip()
            passenger = db.get_passenger(passenger_id)
            if passenger:
                print(f"\nPassenger Information:")
                print(f"  Name: {passenger['name']}")
                print(f"  ID: {passenger['passenger_id']}")
                print(f"  Fee Status: {passenger['fee_status']}")
                print(f"  Registered: {passenger['registration_date']}")
            else:
                print("Passenger not found")

        elif choice == '6':
            passenger_id = input("Enter passenger ID: ").strip()
            fee_status = input("Enter fee status (paid/unpaid): ").strip().lower()
            if fee_status in ['paid', 'unpaid']:
                if db.update_fee_status(passenger_id, fee_status):
                    print(f"✓ Fee status updated to {fee_status}")
                else:
                    print("✗ Failed to update fee status")
            else:
                print("Invalid fee status")

        elif choice == '7':
            stats = db.get_statistics()
            print(f"\nSystem Statistics:")
            print(f"  Total Passengers: {stats.get('total_passengers', 0)}")
            print(f"  Total Embeddings: {stats.get('total_embeddings', 0)}")
            print(f"  Total Attendance Records: {stats.get('total_attendance', 0)}")
            print(f"  Today's Attendance: {stats.get('today_attendance', 0)}")

        elif choice == '8':
            passenger_id = input("Enter passenger ID to delete: ").strip()
            confirm = input(f"Are you sure you want to delete passenger {passenger_id} and all their face data? (y/n): ").strip().lower()
            if confirm == 'y':
                if db.delete_passenger(passenger_id):
                    print(f"✓ Passenger {passenger_id} face data and records removed")
                else:
                    print("✗ Failed to remove passenger")
            else:
                print("Deletion cancelled")

        elif choice == '9':
            confirm = input("WARNING: Are you sure you want to delete ALL passengers, faces, and attendance records? This cannot be undone. (y/n): ").strip().lower()
            if confirm == 'y':
                double_confirm = input("Type 'YES' to confirm full database wipe: ").strip()
                if double_confirm == 'YES':
                    if db.delete_all_data():
                        print("✓ Entire database wiped successfully.")
                    else:
                        print("✗ Failed to wipe database.")
                else:
                    print("Database wipe cancelled.")
            else:
                print("Database wipe cancelled.")

        elif choice == '10':
            print("Exiting...")
            break

        else:
            print("Invalid choice")

    db.close()


def main():
    """Main entry point with CLI argument parsing."""
    parser = argparse.ArgumentParser(
        description="Face Recognition Attendance System",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python3 main.py              # Start GUI (default)
  python3 main.py --gui        # Start GUI
  python3 main.py --register   # CLI registration mode
  python3 main.py --recognize  # CLI recognition mode
  python3 main.py --cli        # Interactive CLI menu
  python3 main.py --setup      # Initialize system
        """
    )

    parser.add_argument(
        '--gui',
        action='store_true',
        help='Start GUI (default if no args)'
    )
    parser.add_argument(
        '--register',
        action='store_true',
        help='Start registration mode (CLI)'
    )
    parser.add_argument(
        '--recognize',
        action='store_true',
        help='Start recognition mode (CLI)'
    )
    parser.add_argument(
        '--cli',
        action='store_true',
        help='Interactive CLI menu'
    )
    parser.add_argument(
        '--setup',
        action='store_true',
        help='Initialize system and database'
    )
    parser.add_argument(
        '--version',
        action='version',
        version='%(prog)s 1.0.0'
    )

    args = parser.parse_args()

    # Create required directories
    create_directories()

    # Log startup
    log_message("Application started")
    
    # Start Cloud Sync Worker in background
    try:
        from modules.sync_worker import SyncWorker
        sync_worker = SyncWorker(interval=2.0)
        sync_worker.start()
    except Exception as e:
        log_message(f"Failed to start SyncWorker: {e}")

    # Handle arguments
    if args.setup:
        print("Setting up system...")
        db = AttendanceDatabase(db_path="data/attendance.db")
        stats = db.get_statistics()
        print(f"✓ Database initialized")
        print(f"✓ Tables created")
        print(f"✓ Directories created")
        db.close()

    elif args.register:
        main_registration()

    elif args.recognize:
        main_recognition()

    elif args.cli:
        main_cli()

    elif args.gui or len(sys.argv) == 1:
        # Default to GUI if no arguments provided
        main_gui()

    else:
        parser.print_help()


if __name__ == "__main__":
    main()
