import 'dart:convert';
import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';
import 'dart:math' as math;

class FaceTemplate {
  final int? id;
  final String loginId;
  final List<double> embedding;
  final String poseCategory;
  final double qualityScore;
  final bool isCentroid;

  FaceTemplate({
    this.id,
    required this.loginId,
    required this.embedding,
    required this.poseCategory,
    required this.qualityScore,
    required this.isCentroid,
  });

  Map<String, dynamic> toMap() {
    return {
      'login_id': loginId,
      'embedding': jsonEncode(embedding),
      'pose_category': poseCategory,
      'quality_score': qualityScore,
      'is_centroid': isCentroid ? 1 : 0,
      'created_at': DateTime.now().toIso8601String(),
    };
  }

  factory FaceTemplate.fromMap(Map<String, dynamic> map) {
    return FaceTemplate(
      id: map['id'],
      loginId: map['login_id'],
      embedding: List<double>.from(jsonDecode(map['embedding'])),
      poseCategory: map['pose_category'],
      qualityScore: map['quality_score'],
      isCentroid: map['is_centroid'] == 1,
    );
  }
}

class StudentProfile {
  final String loginId;
  final String name;
  final String feeStatus;
  final String? routeId;
  final double enrollmentQuality;
  final List<FaceTemplate> templates;

  StudentProfile({
    required this.loginId,
    required this.name,
    required this.feeStatus,
    this.routeId,
    required this.enrollmentQuality,
    required this.templates,
  });
}

class EmbeddingStore {
  static Database? _db;
  
  static final EmbeddingStore _instance = EmbeddingStore._internal();
  factory EmbeddingStore() => _instance;
  EmbeddingStore._internal();

  Future<Database> get database async {
    if (_db != null) return _db!;
    _db = await _initDB('faces_v2.db');
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
      CREATE TABLE students (
        login_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        fee_status TEXT NOT NULL DEFAULT 'unpaid',
        route_id TEXT,
        enrolled_at TEXT NOT NULL,
        enrollment_quality REAL NOT NULL DEFAULT 0.0,
        template_count INTEGER NOT NULL DEFAULT 0
      )
    ''');

    await db.execute('''
      CREATE TABLE templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        login_id TEXT NOT NULL,
        embedding TEXT NOT NULL,
        pose_category TEXT NOT NULL DEFAULT 'frontal',
        quality_score REAL NOT NULL,
        is_centroid INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        FOREIGN KEY (login_id) REFERENCES students(login_id) ON DELETE CASCADE
      )
    ''');

    await db.execute('CREATE INDEX idx_templates_login_id ON templates(login_id)');
  }

  Future<void> upsertStudent(
    String loginId, 
    String name, 
    String feeStatus, 
    String? routeId, 
    double enrollmentQuality
  ) async {
    final db = await database;
    await db.insert('students', {
      'login_id': loginId,
      'name': name,
      'fee_status': feeStatus,
      'route_id': routeId,
      'enrolled_at': DateTime.now().toIso8601String(),
      'enrollment_quality': enrollmentQuality,
    }, conflictAlgorithm: ConflictAlgorithm.replace);
  }

  Future<void> addTemplate(FaceTemplate template) async {
    final db = await database;
    await db.insert('templates', template.toMap());
    
    // Update template count
    await db.rawUpdate(
      'UPDATE students SET template_count = (SELECT COUNT(*) FROM templates WHERE login_id = ?) WHERE login_id = ?',
      [template.loginId, template.loginId]
    );
  }

  /// Clusters raw templates by pose, removes outliers, and saves 1 robust centroid per pose.
  Future<void> clusterAndSaveTemplates(String loginId, List<FaceTemplate> rawTemplates) async {
    if (rawTemplates.isEmpty) return;

    final Map<String, List<FaceTemplate>> grouped = {};
    for (var t in rawTemplates) {
      if (!grouped.containsKey(t.poseCategory)) {
        grouped[t.poseCategory] = [];
      }
      grouped[t.poseCategory]!.add(t);
    }

    final List<FaceTemplate> centroids = [];

    for (var entry in grouped.entries) {
      final pose = entry.key;
      var templates = entry.value;

      if (templates.length == 1) {
        centroids.add(FaceTemplate(
          loginId: loginId,
          embedding: templates.first.embedding,
          poseCategory: pose,
          qualityScore: templates.first.qualityScore,
          isCentroid: true,
        ));
        continue;
      }

      // Compute initial mean
      final dim = templates.first.embedding.length;
      List<double> mean = List.filled(dim, 0.0);
      for (var t in templates) {
        for (int i = 0; i < dim; i++) {
          mean[i] += t.embedding[i];
        }
      }
      for (int i = 0; i < dim; i++) mean[i] /= templates.length;

      // Find and remove the furthest outlier if we have > 2 templates
      if (templates.length > 2) {
        double maxDist = -1;
        int outlierIdx = -1;
        for (int i = 0; i < templates.length; i++) {
          double dist = 0;
          for (int j = 0; j < dim; j++) {
            final diff = templates[i].embedding[j] - mean[j];
            dist += diff * diff;
          }
          if (dist > maxDist) {
            maxDist = dist;
            outlierIdx = i;
          }
        }
        templates.removeAt(outlierIdx);
        
        // Recompute mean without outlier
        mean = List.filled(dim, 0.0);
        for (var t in templates) {
          for (int i = 0; i < dim; i++) {
            mean[i] += t.embedding[i];
          }
        }
        for (int i = 0; i < dim; i++) mean[i] /= templates.length;
      }

      // L2 Normalize the final centroid
      double norm = 0;
      for (int i = 0; i < dim; i++) {
        norm += mean[i] * mean[i];
      }
      norm = math.sqrt(norm);
      if (norm > 0) {
        for (int i = 0; i < dim; i++) mean[i] /= norm;
      }

      final avgQuality = templates.map((e) => e.qualityScore).reduce((a, b) => a + b) / templates.length;

      centroids.add(FaceTemplate(
        loginId: loginId,
        embedding: mean,
        poseCategory: pose,
        qualityScore: avgQuality,
        isCentroid: true,
      ));
    }

    // Save centroids
    for (var c in centroids) {
      await addTemplate(c);
    }
  }

  Future<List<StudentProfile>> getAllStudentProfiles() async {
    final db = await database;
    final studentsData = await db.query('students');
    final templatesData = await db.query('templates');

    // Group templates by login_id
    final Map<String, List<FaceTemplate>> templatesMap = {};
    for (var tRow in templatesData) {
      final template = FaceTemplate.fromMap(tRow);
      if (!templatesMap.containsKey(template.loginId)) {
        templatesMap[template.loginId] = [];
      }
      templatesMap[template.loginId]!.add(template);
    }

    // Build profiles
    final List<StudentProfile> profiles = [];
    for (var sRow in studentsData) {
      final loginId = sRow['login_id'] as String;
      profiles.add(StudentProfile(
        loginId: loginId,
        name: sRow['name'] as String,
        feeStatus: sRow['fee_status'] as String,
        routeId: sRow['route_id'] as String?,
        enrollmentQuality: (sRow['enrollment_quality'] as num).toDouble(),
        templates: templatesMap[loginId] ?? [],
      ));
    }
    
    return profiles;
  }

  Future<void> deleteStudentAndTemplates(String loginId) async {
    final db = await database;
    // Foreign key constraint with ON DELETE CASCADE will delete templates automatically
    // but sqflite needs PRAGMA foreign_keys = ON; enabled which is not default.
    // Better to delete explicitly.
    await db.delete('templates', where: 'login_id = ?', whereArgs: [loginId]);
    await db.delete('students', where: 'login_id = ?', whereArgs: [loginId]);
  }
  
  Future<void> clearAll() async {
    final db = await database;
    await db.delete('templates');
    await db.delete('students');
  }
}
