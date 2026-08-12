#!/usr/bin/env python3
"""
Database Migration and Backup Utilities
Backup and restore database, manage versions
"""

import sqlite3
import os
import shutil
import json
from datetime import datetime


class DatabaseBackup:
    """Manage database backups and migrations."""

    def __init__(self, db_path: str = "data/attendance.db"):
        """Initialize backup manager."""
        self.db_path = db_path
        self.backup_dir = "data/backups"
        os.makedirs(self.backup_dir, exist_ok=True)

    def create_backup(self, tag: str = "") -> str:
        """
        Create database backup.

        Args:
            tag: Optional backup tag/description

        Returns:
            Backup file path
        """
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_name = f"attendance_{timestamp}"

        if tag:
            backup_name = f"{backup_name}_{tag}"

        backup_name += ".db"
        backup_path = os.path.join(self.backup_dir, backup_name)

        try:
            shutil.copy2(self.db_path, backup_path)
            print(f"✓ Backup created: {backup_path}")
            return backup_path

        except Exception as e:
            print(f"✗ Backup failed: {e}")
            return None

    def restore_backup(self, backup_path: str) -> bool:
        """
        Restore database from backup.

        Args:
            backup_path: Path to backup file

        Returns:
            True if successful
        """
        try:
            # Create backup of current before restoring
            current_backup = self.create_backup("before_restore")

            shutil.copy2(backup_path, self.db_path)
            print(f"✓ Database restored from: {backup_path}")
            print(f"✓ Previous database backed up to: {current_backup}")
            return True

        except Exception as e:
            print(f"✗ Restore failed: {e}")
            return False

    def list_backups(self) -> list:
        """
        List all available backups.

        Returns:
            List of backup file paths
        """
        backups = []

        try:
            for file in sorted(os.listdir(self.backup_dir)):
                if file.endswith('.db'):
                    backups.append(os.path.join(self.backup_dir, file))

            return sorted(backups, reverse=True)  # Newest first

        except Exception as e:
            print(f"✗ Error listing backups: {e}")
            return []

    def export_to_json(self, output_path: str = "attendance_export.json") -> bool:
        """
        Export database to JSON format.

        Args:
            output_path: Output JSON file path

        Returns:
            True if successful
        """
        try:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()

            data = {
                'backup_date': datetime.now().isoformat(),
                'students': [],
                'attendance': []
            }

            # Export students
            cursor.execute("SELECT * FROM students")
            for row in cursor.fetchall():
                data['students'].append(dict(row))

            # Export attendance
            cursor.execute("SELECT * FROM attendance ORDER BY check_in_time DESC")
            for row in cursor.fetchall():
                data['attendance'].append(dict(row))

            # Write JSON
            with open(output_path, 'w') as f:
                json.dump(data, f, indent=2, default=str)

            print(f"✓ Database exported to: {output_path}")
            return True

        except Exception as e:
            print(f"✗ Export failed: {e}")
            return False

        finally:
            conn.close()

    def get_database_stats(self) -> dict:
        """
        Get database statistics.

        Returns:
            Dictionary with stats
        """
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            stats = {
                'file_size_mb': os.path.getsize(self.db_path) / (1024 * 1024),
                'last_modified': datetime.fromtimestamp(
                    os.path.getmtime(self.db_path)
                ).isoformat(),
                'total_students': 0,
                'total_embeddings': 0,
                'total_attendance': 0,
            }

            cursor.execute("SELECT COUNT(*) FROM students")
            stats['total_students'] = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM embeddings")
            stats['total_embeddings'] = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM attendance")
            stats['total_attendance'] = cursor.fetchone()[0]

            return stats

        except Exception as e:
            print(f"✗ Error getting stats: {e}")
            return {}

        finally:
            conn.close()


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Database backup utilities")
    parser.add_argument("--backup", action="store_true", help="Create backup")
    parser.add_argument("--list", action="store_true", help="List backups")
    parser.add_argument("--restore", type=str, help="Restore from backup file")
    parser.add_argument("--export", type=str, help="Export to JSON file")
    parser.add_argument("--stats", action="store_true", help="Show database stats")

    args = parser.parse_args()

    backup_util = DatabaseBackup()

    if args.backup:
        backup_util.create_backup()

    elif args.list:
        backups = backup_util.list_backups()
        print(f"\nFound {len(backups)} backups:")
        for i, backup in enumerate(backups):
            print(f"  {i+1}. {backup}")

    elif args.restore:
        if os.path.exists(args.restore):
            backup_util.restore_backup(args.restore)
        else:
            print(f"Backup file not found: {args.restore}")

    elif args.export:
        backup_util.export_to_json(args.export)

    elif args.stats:
        stats = backup_util.get_database_stats()
        print("\nDatabase Statistics:")
        for key, value in stats.items():
            print(f"  {key}: {value}")

    else:
        parser.print_help()
