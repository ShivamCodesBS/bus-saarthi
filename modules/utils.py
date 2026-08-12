"""
Utility Functions Module
Helper functions for the attendance system.
"""

import cv2
import numpy as np
import os
from datetime import datetime
from typing import Tuple, Optional


def get_camera_index(preferred_index: int = 0) -> Optional[int]:
    """
    Find available camera index.

    Args:
        preferred_index: Preferred camera index (usually 0 for default)

    Returns:
        Camera index or None if no camera found
    """
    for i in range(10):
        cap = cv2.VideoCapture(i)
        if cap.isOpened():
            cap.release()
            if i == preferred_index:
                return i
        if i == preferred_index:
            continue

    # Return first available
    for i in range(10):
        cap = cv2.VideoCapture(i)
        if cap.isOpened():
            cap.release()
            return i

    return None


def create_directories():
    """Create required directories if they don't exist."""
    directories = [
        "data",
        "logs",
        "data/passengers",
        "data/temp"
    ]

    for directory in directories:
        os.makedirs(directory, exist_ok=True)


def get_timestamp() -> str:
    """
    Get current timestamp in standard format.

    Returns:
        Timestamp string (YYYY-MM-DD HH:MM:SS)
    """
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def get_date() -> str:
    """
    Get current date in standard format.

    Returns:
        Date string (YYYY-MM-DD)
    """
    return datetime.now().strftime("%Y-%m-%d")


def log_message(message: str, log_file: str = "logs/system.log"):
    """
    Log message to file and console.

    Args:
        message: Message to log
        log_file: Log file path
    """
    timestamp = get_timestamp()
    log_entry = f"[{timestamp}] {message}"

    # Print to console
    print(log_entry)

    # Write to file
    try:
        os.makedirs(os.path.dirname(log_file) or ".", exist_ok=True)
        with open(log_file, 'a') as f:
            f.write(log_entry + "\n")
    except Exception as e:
        print(f"Error writing to log file: {e}")


def get_system_info() -> dict:
    """
    Get system information for logging.

    Returns:
        Dictionary with system info
    """
    import platform
    import psutil

    info = {
        'timestamp': get_timestamp(),
        'os': platform.system(),
        'python_version': platform.python_version(),
        'cpu_count': psutil.cpu_count(),
        'total_memory_gb': psutil.virtual_memory().total / (1024**3),
        'available_memory_gb': psutil.virtual_memory().available / (1024**3),
        'cpu_percent': psutil.cpu_percent(interval=1),
    }

    return info


def format_attendance_report(attendance_records: list) -> str:
    """
    Format attendance records for display.

    Args:
        attendance_records: List of attendance dictionaries

    Returns:
        Formatted string
    """
    report = "\n" + "="*70 + "\n"
    report += "ATTENDANCE REPORT\n"
    report += "="*70 + "\n"
    report += f"{'Passenger ID':<12} {'Name':<20} {'Check-in':<20} {'Fee Status':<12}\n"
    report += "-"*70 + "\n"

    for record in attendance_records:
        passenger_id = record.get('passenger_id', 'N/A')
        name = record.get('name', 'N/A')
        check_in = record.get('check_in_time', 'N/A')
        fee_status = record.get('fee_status', 'N/A').upper()

        report += f"{passenger_id:<12} {name:<20} {str(check_in):<20} {fee_status:<12}\n"

    report += "="*70 + "\n"

    return report


def validate_passenger_id(passenger_id: str) -> bool:
    """
    Validate passenger ID format.

    Args:
        passenger_id: Passenger ID to validate

    Returns:
        True if valid
    """
    if not passenger_id:
        return False
    if len(passenger_id) < 3 or len(passenger_id) > 20:
        return False
    return True


def validate_name(name: str) -> bool:
    """
    Validate passenger name.

    Args:
        name: Name to validate

    Returns:
        True if valid
    """
    if not name:
        return False
    if len(name) < 2 or len(name) > 100:
        return False
    return True


def bytes_to_human_readable(bytes_val: int) -> str:
    """
    Convert bytes to human-readable format.

    Args:
        bytes_val: Number of bytes

    Returns:
        Human-readable string
    """
    for unit in ['B', 'KB', 'MB', 'GB']:
        if bytes_val < 1024:
            return f"{bytes_val:.2f} {unit}"
        bytes_val /= 1024
    return f"{bytes_val:.2f} TB"


def get_database_size(db_path: str = "data/attendance.db") -> str:
    """
    Get database file size.

    Args:
        db_path: Database file path

    Returns:
        Size in human-readable format
    """
    if os.path.exists(db_path):
        size = os.path.getsize(db_path)
        return bytes_to_human_readable(size)
    return "0 B"
