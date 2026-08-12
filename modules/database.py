"""
Database Module - SQLite Operations
Handles all database operations for passengers, embeddings, and attendance.
"""

import sqlite3
import os
from datetime import datetime
from typing import List, Tuple, Optional, Dict
import json


class AttendanceDatabase:
    """
    SQLite database management for attendance system.
    Tables: passengers, embeddings, attendance
    """

    def __init__(self, db_path: str = "data/attendance.db"):
        """
        Initialize database connection.

        Args:
            db_path: Path to SQLite database file
        """
        self.db_path = db_path

        # Create data directory if it doesn't exist
        os.makedirs(os.path.dirname(db_path) or ".", exist_ok=True)

        self.conn = None
        self.cursor = None
        self.connect()
        self.migrate_schema_if_needed()
        self.create_tables()

    def connect(self):
        """Establish database connection."""
        try:
            self.conn = sqlite3.connect(self.db_path)
            self.conn.row_factory = sqlite3.Row  # Enable column access by name
            self.cursor = self.conn.cursor()
            print(f"Database connected: {self.db_path}")
        except sqlite3.Error as e:
            print(f"Database connection error: {e}")
            raise

    def migrate_schema_if_needed(self):
        """Migrate from old student terminology to new passenger terminology"""
        try:
            self.cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='students'")
            if self.cursor.fetchone():
                print("Migrating schema from 'students' to 'passengers'...")
                self.cursor.execute("ALTER TABLE students RENAME TO passengers")
                try:
                    self.cursor.execute("ALTER TABLE passengers RENAME COLUMN student_id TO passenger_id")
                except Exception as e:
                    print(f"Warning: could not rename column in passengers: {e}")
                try:
                    self.cursor.execute("ALTER TABLE embeddings RENAME COLUMN student_id TO passenger_id")
                except Exception as e:
                    print(f"Warning: could not rename column in embeddings: {e}")
                try:
                    self.cursor.execute("ALTER TABLE attendance RENAME COLUMN student_id TO passenger_id")
                except Exception as e:
                    print(f"Warning: could not rename column in attendance: {e}")
                self.conn.commit()
                print("Schema migration complete.")
        except Exception as e:
            print(f"Migration error: {e}")
            self.conn.rollback()

    def create_tables(self):
        """Create required tables if they don't exist."""
        try:
            # Passengers table
            self.cursor.execute("""
                CREATE TABLE IF NOT EXISTS passengers (
                    passenger_id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    fee_status TEXT DEFAULT 'unpaid',
                    registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    phone TEXT,
                    email TEXT
                )
            """)

            # Embeddings table (can have multiple embeddings per passenger)
            self.cursor.execute("""
                CREATE TABLE IF NOT EXISTS embeddings (
                    embedding_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    passenger_id TEXT NOT NULL,
                    embedding TEXT NOT NULL,
                    capture_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    quality_score REAL DEFAULT 0.0,
                    FOREIGN KEY (passenger_id) REFERENCES passengers(passenger_id) ON DELETE CASCADE
                )
            """)

            # Attendance table
            self.cursor.execute("""
                CREATE TABLE IF NOT EXISTS attendance (
                    attendance_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    passenger_id TEXT NOT NULL,
                    name TEXT,
                    check_in_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    fee_status TEXT,
                    confidence REAL DEFAULT 0.0,
                    device_id TEXT DEFAULT 'desktop',
                    FOREIGN KEY (passenger_id) REFERENCES passengers(passenger_id) ON DELETE CASCADE
                )
            """)

            # Create indexes for faster queries
            self.cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_attendance_passenger 
                ON attendance(passenger_id)
            """)
            self.cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_attendance_date 
                ON attendance(check_in_time)
            """)
            self.cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_embeddings_passenger 
                ON embeddings(passenger_id)
            """)

            # Sync Queue table for offline-first cloud upload
            self.cursor.execute("""
                CREATE TABLE IF NOT EXISTS sync_queue (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    data_type TEXT NOT NULL,
                    payload TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            self.conn.commit()
            print("Database tables created/verified")

        except sqlite3.Error as e:
            print(f"Error creating tables: {e}")
            raise

    # ==================== PASSENGER OPERATIONS ====================

    def register_passenger(
        self,
        passenger_id: str,
        name: str,
        fee_status: str = "unpaid",
        phone: str = "",
        email: str = ""
    ) -> bool:
        """
        Register a new passenger.

        Args:
            passenger_id: Unique passenger identifier
            name: Passenger name
            fee_status: 'paid' or 'unpaid'
            phone: Optional phone number
            email: Optional email

        Returns:
            True if successful, False otherwise
        """
        try:
            self.cursor.execute("""
                INSERT OR REPLACE INTO passengers 
                (passenger_id, name, fee_status, phone, email)
                VALUES (?, ?, ?, ?, ?)
            """, (passenger_id, name, fee_status, phone, email))

            self.conn.commit()
            print(f"Passenger registered: {name} ({passenger_id})")
            return True

        except sqlite3.Error as e:
            print(f"Error registering passenger: {e}")
            return False

    def get_passenger(self, passenger_id: str) -> Optional[Dict]:
        """
        Retrieve passenger details.

        Args:
            passenger_id: Passenger ID

        Returns:
            Passenger dictionary or None
        """
        try:
            self.cursor.execute(
                "SELECT * FROM passengers WHERE passenger_id = ?",
                (passenger_id,)
            )
            row = self.cursor.fetchone()
            return dict(row) if row else None

        except sqlite3.Error as e:
            print(f"Error retrieving passenger: {e}")
            return None

    def update_fee_status(self, passenger_id: str, fee_status: str) -> bool:
        """
        Update passenger fee status.

        Args:
            passenger_id: Passenger ID
            fee_status: 'paid' or 'unpaid'

        Returns:
            True if successful
        """
        try:
            self.cursor.execute(
                "UPDATE passengers SET fee_status = ? WHERE passenger_id = ?",
                (fee_status, passenger_id)
            )
            self.conn.commit()
            return True

        except sqlite3.Error as e:
            print(f"Error updating fee status: {e}")
            return False

    def update_passenger_details(
        self,
        passenger_id: str,
        name: str,
        fee_status: str,
        phone: str,
        email: str
    ) -> bool:
        """
        Update all editable passenger details.

        Args:
            passenger_id: Passenger ID
            name: New name
            fee_status: 'paid' or 'unpaid'
            phone: New phone number
            email: New email

        Returns:
            True if successful
        """
        try:
            self.cursor.execute(
                """
                UPDATE passengers 
                SET name = ?, fee_status = ?, phone = ?, email = ?
                WHERE passenger_id = ?
                """,
                (name, fee_status, phone, email, passenger_id)
            )
            self.conn.commit()
            return self.cursor.rowcount > 0

        except sqlite3.Error as e:
            print(f"Error updating passenger details: {e}")
            return False

    def get_all_passengers(self) -> List[Dict]:
        """
        Retrieve all registered passengers.

        Returns:
            List of passenger dictionaries
        """
        try:
            self.cursor.execute("SELECT * FROM passengers")
            rows = self.cursor.fetchall()
            return [dict(row) for row in rows]

        except sqlite3.Error as e:
            print(f"Error retrieving passengers: {e}")
            return []

    def delete_passenger(self, passenger_id: str) -> bool:
        """
        Delete a passenger and all their associated data (embeddings, attendance).

        Args:
            passenger_id: Passenger ID

        Returns:
            True if successful
        """
        try:
            # First delete from attendance and embeddings explicitly
            # in case foreign key cascades are disabled in sqlite
            self.cursor.execute("DELETE FROM attendance WHERE passenger_id = ?", (passenger_id,))
            self.cursor.execute("DELETE FROM embeddings WHERE passenger_id = ?", (passenger_id,))
            
            # Delete the passenger
            self.cursor.execute("DELETE FROM passengers WHERE passenger_id = ?", (passenger_id,))
            
            # Check if a passenger was actually deleted
            if self.cursor.rowcount > 0:
                self.conn.commit()
                print(f"Passenger {passenger_id} and associated data deleted.")
                return True
            else:
                print(f"Passenger {passenger_id} not found.")
                return False

        except sqlite3.Error as e:
            print(f"Error deleting passenger: {e}")
            return False

    def delete_all_data(self) -> bool:
        """
        Delete all passengers, embeddings, and attendance records from the database.

        Returns:
            True if successful
        """
        try:
            self.cursor.execute("DELETE FROM attendance")
            self.cursor.execute("DELETE FROM embeddings")
            self.cursor.execute("DELETE FROM passengers")
            self.conn.commit()
            print("All data has been successfully wiped from the database.")
            return True
        except sqlite3.Error as e:
            print(f"Error deleting all data: {e}")
            return False

    # ==================== EMBEDDING OPERATIONS ====================

    def store_embedding(
        self,
        passenger_id: str,
        embedding_str: str,
        quality_score: float = 0.0
    ) -> bool:
        """
        Store face embedding for a passenger.

        Args:
            passenger_id: Passenger ID
            embedding_str: Encoded embedding string
            quality_score: Quality metric (0-1)

        Returns:
            True if successful
        """
        try:
            self.cursor.execute("""
                INSERT INTO embeddings 
                (passenger_id, embedding, quality_score)
                VALUES (?, ?, ?)
            """, (passenger_id, embedding_str, quality_score))

            self.conn.commit()
            return True

        except sqlite3.Error as e:
            print(f"Error storing embedding: {e}")
            return False

    def get_embeddings(self, passenger_id: str) -> List[str]:
        """
        Retrieve all embeddings for a passenger.

        Args:
            passenger_id: Passenger ID

        Returns:
            List of embedding strings
        """
        try:
            self.cursor.execute(
                "SELECT embedding FROM embeddings WHERE passenger_id = ? ORDER BY quality_score DESC",
                (passenger_id,)
            )
            rows = self.cursor.fetchall()
            return [row[0] for row in rows]

        except sqlite3.Error as e:
            print(f"Error retrieving embeddings: {e}")
            return []

    def get_all_embeddings(self) -> List[Tuple[str, str]]:
        """
        Retrieve all stored embeddings with passenger IDs.

        Returns:
            List of (passenger_id, embedding_str) tuples
        """
        try:
            self.cursor.execute("""
                SELECT passenger_id, embedding FROM embeddings
                ORDER BY passenger_id, quality_score DESC
            """)
            rows = self.cursor.fetchall()
            return [(row[0], row[1]) for row in rows]

        except sqlite3.Error as e:
            print(f"Error retrieving embeddings: {e}")
            return []

    # ==================== ATTENDANCE OPERATIONS ====================

    def log_attendance(
        self,
        passenger_id: str,
        name: str,
        fee_status: str,
        confidence: float = 0.0,
        device_id: str = "desktop"
    ) -> bool:
        """
        Log attendance record.

        Args:
            passenger_id: Passenger ID
            name: Passenger name
            fee_status: Fee status
            confidence: Match confidence (0-1)
            device_id: Device identifier

        Returns:
            True if successful
        """
        try:
            self.cursor.execute("""
                INSERT INTO attendance 
                (passenger_id, name, fee_status, confidence, device_id)
                VALUES (?, ?, ?, ?, ?)
            """, (passenger_id, name, fee_status, confidence, device_id))

            self.conn.commit()
            return True

        except sqlite3.Error as e:
            print(f"Error logging attendance: {e}")
            return False

    def check_duplicate_attendance(
        self,
        passenger_id: str,
        time_window_minutes: int = 5
    ) -> bool:
        """
        Check if passenger has already checked in recently.

        Args:
            passenger_id: Passenger ID
            time_window_minutes: Time window to check (default 5 minutes)

        Returns:
            True if already checked in, False otherwise
        """
        try:
            self.cursor.execute("""
                SELECT attendance_id FROM attendance
                WHERE passenger_id = ?
                AND datetime(check_in_time) > datetime('now', ?)
                ORDER BY check_in_time DESC
                LIMIT 1
            """, (passenger_id, f"-{time_window_minutes} minutes"))

            result = self.cursor.fetchone()
            return result is not None

        except sqlite3.Error as e:
            print(f"Error checking duplicate: {e}")
            return False

    def get_attendance_records(
        self,
        passenger_id: Optional[str] = None,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        limit: int = 100
    ) -> List[Dict]:
        """
        Retrieve attendance records with optional filters.

        Args:
            passenger_id: Optional passenger ID filter
            date_from: Optional start date (YYYY-MM-DD)
            date_to: Optional end date (YYYY-MM-DD)
            limit: Maximum records to return

        Returns:
            List of attendance records
        """
        try:
            query = "SELECT * FROM attendance WHERE 1=1"
            params = []

            if passenger_id:
                query += " AND passenger_id = ?"
                params.append(passenger_id)

            if date_from:
                query += " AND DATE(check_in_time) >= ?"
                params.append(date_from)

            if date_to:
                query += " AND DATE(check_in_time) <= ?"
                params.append(date_to)

            query += " ORDER BY check_in_time DESC LIMIT ?"
            params.append(limit)

            self.cursor.execute(query, params)
            rows = self.cursor.fetchall()
            return [dict(row) for row in rows]

        except sqlite3.Error as e:
            print(f"Error retrieving attendance: {e}")
            return []

    def get_today_attendance(self) -> List[Dict]:
        """
        Get attendance records for today.

        Returns:
            List of attendance records
        """
        try:
            self.cursor.execute("""
                SELECT passenger_id, name, fee_status, COUNT(*) as count, 
                       MIN(check_in_time) as check_in_time,
                       MAX(check_in_time) as last_check_in
                FROM attendance
                WHERE DATE(check_in_time) = DATE('now')
                GROUP BY passenger_id
                ORDER BY check_in_time DESC
            """)
            rows = self.cursor.fetchall()
            return [dict(row) for row in rows]

        except sqlite3.Error as e:
            print(f"Error retrieving today's attendance: {e}")
            return []

    def get_statistics(self) -> Dict:
        """
        Get database statistics.

        Returns:
            Dictionary with stats
        """
        try:
            stats = {}

            self.cursor.execute("SELECT COUNT(*) FROM passengers")
            stats['total_passengers'] = self.cursor.fetchone()[0]

            self.cursor.execute("SELECT COUNT(*) FROM embeddings")
            stats['total_embeddings'] = self.cursor.fetchone()[0]

            self.cursor.execute("SELECT COUNT(*) FROM attendance")
            stats['total_attendance'] = self.cursor.fetchone()[0]

            self.cursor.execute("""
                SELECT COUNT(*) FROM attendance 
                WHERE DATE(check_in_time) = DATE('now')
            """)
            stats['today_attendance'] = self.cursor.fetchone()[0]

            return stats

        except sqlite3.Error as e:
            print(f"Error retrieving statistics: {e}")
            return {}

    # ==================== UTILITY OPERATIONS ====================

    def export_attendance_csv(self, output_path: str = "attendance_export.csv") -> bool:
        """
        Export attendance records to CSV.

        Args:
            output_path: Path to save CSV file

        Returns:
            True if successful
        """
        try:
            import csv
            from datetime import datetime

            records = self.get_attendance_records(limit=10000)

            with open(output_path, 'w', newline='') as f:
                writer = csv.DictWriter(f, fieldnames=['passenger_id', 'name', 'check_in_time', 'fee_status', 'confidence'])
                writer.writeheader()
                writer.writerows(records)

            print(f"Attendance exported to {output_path}")
            return True

        except Exception as e:
            print(f"Error exporting attendance: {e}")
            return False

    def close(self):
        """Close database connection."""
        if self.conn:
            self.conn.close()
            print("Database connection closed")

    def __del__(self):
        """Destructor to ensure connection is closed."""
        self.close()

    # ==================== SYNC QUEUE OPERATIONS ====================

    def add_to_sync_queue(self, data_type: str, payload: dict) -> bool:
        """
        Add an item to the sync queue.

        Args:
            data_type: Type of data ('encoding', 'attendance', 'sensor')
            payload: Dictionary containing the data payload

        Returns:
            True if successful
        """
        try:
            payload_str = json.dumps(payload)
            self.cursor.execute("""
                INSERT INTO sync_queue (data_type, payload)
                VALUES (?, ?)
            """, (data_type, payload_str))
            self.conn.commit()
            return True
        except sqlite3.Error as e:
            print(f"Error adding to sync queue: {e}")
            return False

    def get_pending_sync_items(self, limit: int = 50) -> List[Dict]:
        """
        Get pending items from the sync queue.

        Args:
            limit: Maximum items to retrieve

        Returns:
            List of dictionaries with id, data_type, payload, and created_at
        """
        try:
            self.cursor.execute(
                "SELECT * FROM sync_queue ORDER BY created_at ASC LIMIT ?",
                (limit,)
            )
            rows = self.cursor.fetchall()
            items = []
            for row in rows:
                item = dict(row)
                try:
                    item['payload'] = json.loads(item['payload'])
                except Exception:
                    pass # Keep as string if not JSON
                items.append(item)
            return items
        except sqlite3.Error as e:
            print(f"Error retrieving sync queue items: {e}")
            return []

    def delete_sync_item(self, item_id: int) -> bool:
        """
        Delete an item from the sync queue.

        Args:
            item_id: ID of the item to delete

        Returns:
            True if successful
        """
        try:
            self.cursor.execute(
                "DELETE FROM sync_queue WHERE id = ?",
                (item_id,)
            )
            self.conn.commit()
            return True
        except sqlite3.Error as e:
            print(f"Error deleting sync queue item: {e}")
            return False
