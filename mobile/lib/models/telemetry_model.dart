class TelemetryData {
  final double latitude;
  final double longitude;
  final double speed;
  final double? heading;
  final String comfort;
  final DateTime timestamp;
  final DateTime receivedAt;
  final String routeId;

  TelemetryData({
    required this.latitude,
    required this.longitude,
    required this.speed,
    this.heading,
    required this.comfort,
    required this.timestamp,
    required this.receivedAt,
    required this.routeId,
  });

  factory TelemetryData.fromJson(Map<String, dynamic> json) {
    double? lat = json['location']?['lat']?.toDouble() ?? 
                  json['lat']?.toDouble() ?? 
                  json['latitude']?.toDouble();
    double? lng = json['location']?['lng']?.toDouble() ?? 
                  json['lng']?.toDouble() ?? 
                  json['longitude']?.toDouble();

    return TelemetryData(
      latitude: lat ?? 0.0,
      longitude: lng ?? 0.0,
      speed: (json['speed']?.toDouble() ?? 0.0),
      heading: json['heading']?.toDouble(),
      comfort: json['comfort']?.toString() ?? 'Smooth',
      timestamp: json['timestamp'] != null 
          ? DateTime.parse(json['timestamp'].toString()) 
          : DateTime.now(),
      receivedAt: DateTime.now(),
      routeId: json['route_id']?.toString() ?? '',
    );
  }

  Map<String, dynamic> toJson() => {
    'location': {'lat': latitude, 'lng': longitude},
    'speed': speed,
    'heading': heading,
    'comfort': comfort,
    'timestamp': timestamp.toIso8601String(),
    'route_id': routeId,
  };

  /// Normalize any heading degrees (e.g. negative azimuth from Android sensors)
  /// into the canonical [0.0, 360.0) range.
  static double normalizeHeading(double deg) {
    double h = deg % 360.0;
    if (h < 0) h += 360.0;
    return h;
  }

  /// Get cardinal direction from heading
  String get headingLabel {
    if (heading == null) return '—';
    final deg = normalizeHeading(heading!);
    if (deg >= 315 || deg < 45) return 'N';
    if (deg >= 45 && deg < 135) return 'E';
    if (deg >= 135 && deg < 225) return 'S';
    return 'W';
  }

  /// Get full heading label with arrow
  String get headingLabelFull {
    if (heading == null) return '—';
    final deg = normalizeHeading(heading!);
    if (deg >= 315 || deg < 45) return 'N ↑';
    if (deg >= 45 && deg < 135) return 'E →';
    if (deg >= 135 && deg < 225) return 'S ↓';
    return 'W ←';
  }
}