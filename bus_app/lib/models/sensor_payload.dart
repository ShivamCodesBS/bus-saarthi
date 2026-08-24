class SensorPayload {
  final double? latitude;
  final double? longitude;
  final double? gpsSpeedKnots;
  final double? accelX;
  final double? accelY;
  final double? accelZ;
  final double? headingDeg;
  final double mpuSpeedKmh;
  final String routeId;
  final String timestamp;

  SensorPayload({
    this.latitude,
    this.longitude,
    this.gpsSpeedKnots,
    this.accelX,
    this.accelY,
    this.accelZ,
    this.headingDeg,
    required this.mpuSpeedKmh,
    required this.routeId,
    required this.timestamp,
  });

  Map<String, dynamic> toJson() => {
    'latitude': latitude,
    'longitude': longitude,
    'gps_speed_knots': gpsSpeedKnots,
    'accel_x': accelX,
    'accel_y': accelY,
    'accel_z': accelZ,
    'heading_deg': headingDeg,
    'mpu_speed_kmh': mpuSpeedKmh,
    'route_id': routeId,
    'timestamp': timestamp,
  };

  factory SensorPayload.fromJson(Map<String, dynamic> json) {
    return SensorPayload(
      latitude: (json['latitude'] as num?)?.toDouble(),
      longitude: (json['longitude'] as num?)?.toDouble(),
      gpsSpeedKnots: (json['gps_speed_knots'] as num?)?.toDouble(),
      accelX: (json['accel_x'] as num?)?.toDouble(),
      accelY: (json['accel_y'] as num?)?.toDouble(),
      accelZ: (json['accel_z'] as num?)?.toDouble(),
      headingDeg: (json['heading_deg'] as num?)?.toDouble(),
      mpuSpeedKmh: (json['mpu_speed_kmh'] as num?)?.toDouble() ?? 0.0,
      routeId: json['route_id'] as String? ?? '4',
      timestamp: json['timestamp'] as String? ?? DateTime.now().toUtc().toIso8601String(),
    );
  }
}
