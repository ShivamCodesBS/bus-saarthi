import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:latlong2/latlong.dart';
import 'package:bus_sensor_app/screens/widgets/driver_map_widget.dart';
import 'package:bus_sensor_app/models/telemetry_model.dart';

void main() {
  group('DriverMapWidget Tests', () {
    testWidgets('renders map and controls without crashing when telemetry is null',
        (WidgetTester tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: DriverMapWidget(
              telemetry: null,
              isLive: false,
              routeId: '4',
            ),
          ),
        ),
      );

      // Verify overlay message when acquiring GPS
      expect(find.text('Acquiring Satellite Fix...'), findsOneWidget);
      expect(find.text('CONNECTING'), findsOneWidget);

      // Verify map control buttons exist
      expect(find.byIcon(Icons.my_location), findsOneWidget);
      expect(find.byIcon(Icons.add), findsOneWidget);
      expect(find.byIcon(Icons.remove), findsOneWidget);
    });

    testWidgets('renders live telemetry marker and broadcasting badge when active',
        (WidgetTester tester) async {
      final sampleTelemetry = TelemetryData(
        latitude: 28.3180,
        longitude: 79.4670,
        speed: 35.0,
        heading: 90.0,
        comfort: 'Smooth',
        timestamp: DateTime.now(),
        receivedAt: DateTime.now(),
        routeId: '4',
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: DriverMapWidget(
              telemetry: sampleTelemetry,
              isLive: true,
              routeId: '4',
              busNumber: 'Bus 4',
            ),
          ),
        ),
      );

      // Live status indicator shows BROADCASTING
      expect(find.text('BROADCASTING'), findsOneWidget);
      // Bus tag is visible on map
      expect(find.text('Bus 4'), findsOneWidget);
    });

    testWidgets('renders route stops markers properly', (WidgetTester tester) async {
      final stops = [
        const LatLng(28.3180, 79.4670),
        const LatLng(28.3250, 79.4750),
        const LatLng(28.3300, 79.4800),
      ];

      final stopDetails = [
        {'name': 'Invertis Gate 1'},
        {'name': 'Satellite Stand'},
        {'name': 'City Station'},
      ];

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: DriverMapWidget(
              telemetry: null,
              isLive: false,
              routeId: '4',
              routeStops: stops,
              stopDetails: stopDetails,
            ),
          ),
        ),
      );

      // Verify numbered stop badges exist
      expect(find.text('1'), findsOneWidget);
      expect(find.text('2'), findsOneWidget);
      expect(find.text('3'), findsOneWidget);

      // Verify stop names are visible
      expect(find.text('Invertis Gate 1'), findsOneWidget);
      expect(find.text('Satellite Stand'), findsOneWidget);
      expect(find.text('City Station'), findsOneWidget);
    });
  });
}
