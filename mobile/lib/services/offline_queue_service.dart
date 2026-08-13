import 'dart:convert';
import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';
import '../models/attendance_payload.dart';

class OfflineQueueService {
  static Database? _db;

  Future<Database> get database async {
    if (_db != null) return _db!;
    _db = await _initDB('offline_queue.db');
    return _db!;
  }

  Future<Database> _initDB(String filePath) async {
    final dbPath = await getDatabasesPath();
    final path = join(dbPath, filePath);

    return await openDatabase(
      path,
      version: 1,
      onCreate: _createDB,
    );
  }

  Future _createDB(Database db, int version) async {
    await db.execute('''
      CREATE TABLE attendance_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        payload TEXT NOT NULL,
        timestamp TEXT NOT NULL
      )
    ''');
  }

  Future<void> enqueueAttendance(AttendancePayload payload) async {
    final db = await database;
    await db.insert('attendance_queue', {
      'payload': jsonEncode(payload.toJson()),
      'timestamp': DateTime.now().toIso8601String(),
    });
  }

  Future<List<Map<String, dynamic>>> getQueue() async {
    final db = await database;
    return await db.query('attendance_queue', orderBy: 'id ASC');
  }

  Future<void> deleteItem(int id) async {
    final db = await database;
    await db.delete(
      'attendance_queue',
      where: 'id = ?',
      whereArgs: [id],
    );
  }
}
