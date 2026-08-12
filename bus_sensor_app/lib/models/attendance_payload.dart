class AttendancePayload {
  final String type = 'attendance';
  final AttendanceData data;

  AttendancePayload({required this.data});

  Map<String, dynamic> toJson() => {
    'type': type,
    'data': data.toJson(),
  };
}

class AttendanceData {
  final String studentId;
  final String loginId;
  final String name;
  final String feeStatus;
  final double confidence;
  final String checkInTime;
  final String routeId;
  final String deviceId;

  AttendanceData({
    required this.studentId,
    required this.loginId,
    required this.name,
    required this.feeStatus,
    required this.confidence,
    required this.checkInTime,
    required this.routeId,
    this.deviceId = 'flutter_bus_cam',
  });

  factory AttendanceData.fromJson(Map<String, dynamic> json) {
    return AttendanceData(
      studentId: json['student_id'],
      loginId: json['login_id'],
      name: json['name'],
      feeStatus: json['fee_status'],
      confidence: json['confidence']?.toDouble() ?? 0.0,
      checkInTime: json['check_in_time'],
      routeId: json['route_id'],
      deviceId: json['device_id'] ?? 'flutter_bus_cam',
    );
  }

  Map<String, dynamic> toJson() => {
    'student_id': studentId,
    'login_id': loginId,
    'name': name,
    'fee_status': feeStatus,
    'confidence': confidence,
    'check_in_time': checkInTime,
    'route_id': routeId,
    'device_id': deviceId,
  };
}
