import 'dart:convert';
import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart' as p;

/// Local SQLite store for face embeddings.
///
/// Each enrolled passenger has a 192-dim ArcFace embedding stored as
/// a JSON-encoded list of doubles. This allows fully offline face
/// recognition without any server round-trips.
class EmbeddingStore {
  static const String _dbName = 'face_embeddings.db';
  static const String _tableName = 'embeddings';

  Database? _db;

  /// Open (or create) the embeddings database.
  Future<void> initialize() async {
    final dbPath = await getDatabasesPath();
    final path = p.join(dbPath, _dbName);

    _db = await openDatabase(
      path,
      version: 1,
      onCreate: (db, version) async {
        await db.execute('''
          CREATE TABLE $_tableName (
            login_id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            fee_status TEXT NOT NULL DEFAULT 'unpaid',
            route_id TEXT,
            embedding TEXT NOT NULL,
            enrolled_at TEXT NOT NULL
          )
        ''');
        print('[EmbeddingStore] Database created');
      },
    );
    print('[EmbeddingStore] Database opened with ${await count()} enrolled faces');
  }

  /// Store a face embedding for a passenger.
  /// Overwrites any existing embedding for the same loginId.
  Future<void> upsert({
    required String loginId,
    required String name,
    required String feeStatus,
    String? routeId,
    required List<double> embedding,
  }) async {
    await _db!.insert(
      _tableName,
      {
        'login_id': loginId,
        'name': name,
        'fee_status': feeStatus,
        'route_id': routeId,
        'embedding': jsonEncode(embedding),
        'enrolled_at': DateTime.now().toIso8601String(),
      },
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  /// Get all stored embeddings for matching.
  /// Returns a list of maps with login_id, name, fee_status, route_id, and embedding.
  Future<List<StoredFace>> getAll() async {
    final rows = await _db!.query(_tableName);
    return rows.map((row) {
      final embeddingJson = row['embedding'] as String;
      final embedding = (jsonDecode(embeddingJson) as List)
          .map((e) => (e as num).toDouble())
          .toList();

      return StoredFace(
        loginId: row['login_id'] as String,
        name: row['name'] as String,
        feeStatus: row['fee_status'] as String,
        routeId: row['route_id'] as String?,
        embedding: embedding,
      );
    }).toList();
  }

  /// Delete a face embedding.
  Future<void> delete(String loginId) async {
    await _db!.delete(_tableName, where: 'login_id = ?', whereArgs: [loginId]);
  }

  /// Delete all embeddings (full reset).
  Future<void> deleteAll() async {
    await _db!.delete(_tableName);
  }

  /// Count enrolled faces.
  Future<int> count() async {
    final result = await _db!.rawQuery('SELECT COUNT(*) as cnt FROM $_tableName');
    return Sqflite.firstIntValue(result) ?? 0;
  }

  /// Check if a specific passenger is enrolled.
  Future<bool> isEnrolled(String loginId) async {
    final result = await _db!.query(
      _tableName,
      where: 'login_id = ?',
      whereArgs: [loginId],
      limit: 1,
    );
    return result.isNotEmpty;
  }

  void dispose() {
    _db?.close();
    _db = null;
  }
}

/// A face stored in the local embedding database.
class StoredFace {
  final String loginId;
  final String name;
  final String feeStatus;
  final String? routeId;
  final List<double> embedding;

  const StoredFace({
    required this.loginId,
    required this.name,
    required this.feeStatus,
    this.routeId,
    required this.embedding,
  });
}
