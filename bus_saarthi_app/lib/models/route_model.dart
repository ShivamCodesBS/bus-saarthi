import 'dart:convert';

/// Route + driver info — mirrors `GET /api/routes/:routeId` response.
class RouteInfo {
  final String? routeId;
  final String? routeName;
  final String? busNumber;
  final Object?
  stops; // list, JSON array, or legacy comma-separated stop names.
  final String? city;
  final String? destination;
  final DriverInfo? driver;

  const RouteInfo({
    this.routeId,
    this.routeName,
    this.busNumber,
    this.stops,
    this.city,
    this.destination,
    this.driver,
  });

  factory RouteInfo.fromJson(Map<String, dynamic> json) {
    final driverJson = json['driver'];
    return RouteInfo(
      routeId: (json['routeId'] ?? json['route_id'] ?? json['id'])?.toString(),
      routeName: (json['routeName'] ?? json['route_name'])?.toString(),
      busNumber: (json['busNumber'] ?? json['bus_number'])?.toString(),
      stops: json['stops'],
      city: json['city']?.toString(),
      destination:
          (json['destination'] ??
                  json['destinationName'] ??
                  json['destination_name'])
              ?.toString(),
      driver: driverJson is Map
          ? DriverInfo.fromJson(Map<String, dynamic>.from(driverJson))
          : null,
    );
  }

  List<String> get stopsList {
    final value = stops;
    if (value is List) return _cleanStops(value);
    if (value is! String) return const [];

    final raw = value.trim();
    if (raw.isEmpty) return const [];
    if (raw.startsWith('[')) {
      try {
        final decoded = jsonDecode(raw);
        if (decoded is List) return _cleanStops(decoded);
      } on FormatException {
        // Older records may contain arbitrary legacy strings; parse them below.
      }
    }
    return _cleanStops(raw.split(','));
  }

  static List<String> _cleanStops(Iterable values) => values
      .map((stop) => stop?.toString().trim() ?? '')
      .where((stop) => stop.isNotEmpty)
      .toList();
}

class DriverInfo {
  final String? name;
  final String? phone;

  const DriverInfo({this.name, this.phone});

  factory DriverInfo.fromJson(Map<String, dynamic> json) => DriverInfo(
    name: (json['name'] ?? json['driver_name'])?.toString(),
    phone: (json['phone'] ?? json['phone_number'])?.toString(),
  );
}
