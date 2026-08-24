class AttendanceRecord {
  final String passengerId;
  final String? name;
  final String? feeStatus;
  final double? confidence;
  final String? timestamp;

  AttendanceRecord({
    required this.passengerId,
    this.name,
    this.feeStatus,
    this.confidence,
    this.timestamp,
  });

  factory AttendanceRecord.fromJson(Map<String, dynamic> json) {
    return AttendanceRecord(
      passengerId: json['passenger_id'],
      name: json['name'],
      feeStatus: json['fee_status'],
      confidence: json['confidence']?.toDouble(),
      timestamp: json['timestamp'],
    );
  }

  Map<String, dynamic> toJson() => {
    'passenger_id': passengerId,
    if (name != null) 'name': name,
    if (feeStatus != null) 'fee_status': feeStatus,
    if (confidence != null) 'confidence': confidence,
    if (timestamp != null) 'timestamp': timestamp,
  };
}

class SyncAttendancePayload {
  final String routeId;
  final List<AttendanceRecord> records;

  SyncAttendancePayload({
    required this.routeId,
    required this.records,
  });

  factory SyncAttendancePayload.fromJson(Map<String, dynamic> json) {
    return SyncAttendancePayload(
      routeId: json['route_id'],
      records: (json['records'] as List)
          .map((e) => AttendanceRecord.fromJson(e))
          .toList(),
    );
  }

  Map<String, dynamic> toJson() => {
    'route_id': routeId,
    'records': records.map((e) => e.toJson()).toList(),
  };
}
