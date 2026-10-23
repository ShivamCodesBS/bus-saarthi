import 'package:flutter_test/flutter_test.dart';
import 'package:bus_sensor_app/models/telemetry_model.dart';

void main() {
  group('TelemetryData Model Tests', () {
    test('parses nested location format correctly', () {
      final json = {
        'location': {'lat': 28.3180, 'lng': 79.4670},
        'speed': 45.2,
        'heading': 90.0,
        'comfort': 'Smooth',
        'timestamp': '2026-10-23T10:00:00.000Z',
        'route_id': '4',
      };

      final data = TelemetryData.fromJson(json);

      expect(data.latitude, 28.3180);
      expect(data.longitude, 79.4670);
      expect(data.speed, 45.2);
      expect(data.heading, 90.0);
      expect(data.comfort, 'Smooth');
      expect(data.routeId, '4');
      expect(data.headingLabel, 'E');
      expect(data.headingLabelFull, 'E →');
    });

    test('parses flat latitude/longitude format correctly', () {
      final json = {
        'latitude': 28.5000,
        'longitude': 79.2000,
        'speed': 62.0,
        'heading': 0.0,
        'comfort': 'Moderate',
        'route_id': '5',
      };

      final data = TelemetryData.fromJson(json);

      expect(data.latitude, 28.5000);
      expect(data.longitude, 79.2000);
      expect(data.speed, 62.0);
      expect(data.heading, 0.0);
      expect(data.headingLabel, 'N');
      expect(data.headingLabelFull, 'N ↑');
    });

    test('parses lat/lng abbreviation format correctly', () {
      final json = {
        'lat': 28.1234,
        'lng': 79.5678,
        'speed': 30.0,
        'heading': 180.0,
        'route_id': '12',
      };

      final data = TelemetryData.fromJson(json);

      expect(data.latitude, 28.1234);
      expect(data.longitude, 79.5678);
      expect(data.headingLabel, 'S');
      expect(data.headingLabelFull, 'S ↓');
    });

    test('handles missing / null fields gracefully', () {
      final json = <String, dynamic>{};

      final data = TelemetryData.fromJson(json);

      expect(data.latitude, 0.0);
      expect(data.longitude, 0.0);
      expect(data.speed, 0.0);
      expect(data.heading, isNull);
      expect(data.comfort, 'Smooth');
      expect(data.routeId, '');
      expect(data.headingLabel, '—');
      expect(data.headingLabelFull, '—');
    });

    test('heading labels cover all four quadrants correctly', () {
      final north = TelemetryData(
        latitude: 0, longitude: 0, speed: 0, heading: 350, comfort: '',
        timestamp: DateTime.now(), receivedAt: DateTime.now(), routeId: '1',
      );
      final east = TelemetryData(
        latitude: 0, longitude: 0, speed: 0, heading: 90, comfort: '',
        timestamp: DateTime.now(), receivedAt: DateTime.now(), routeId: '1',
      );
      final south = TelemetryData(
        latitude: 0, longitude: 0, speed: 0, heading: 180, comfort: '',
        timestamp: DateTime.now(), receivedAt: DateTime.now(), routeId: '1',
      );
      final west = TelemetryData(
        latitude: 0, longitude: 0, speed: 0, heading: 270, comfort: '',
        timestamp: DateTime.now(), receivedAt: DateTime.now(), routeId: '1',
      );

      expect(north.headingLabel, 'N');
      expect(east.headingLabel, 'E');
      expect(south.headingLabel, 'S');
      expect(west.headingLabel, 'W');
    });

    test('toJson serializes correctly', () {
      final data = TelemetryData(
        latitude: 28.3180,
        longitude: 79.4670,
        speed: 50.0,
        heading: 45.0,
        comfort: 'Smooth',
        timestamp: DateTime.utc(2026, 10, 23, 12, 0, 0),
        receivedAt: DateTime.now(),
        routeId: '4',
      );

      final json = data.toJson();

      expect(json['location']['lat'], 28.3180);
      expect(json['location']['lng'], 79.4670);
      expect(json['speed'], 50.0);
      expect(json['heading'], 45.0);
      expect(json['comfort'], 'Smooth');
      expect(json['route_id'], '4');
    });
  });
}
