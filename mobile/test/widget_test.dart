// Widget test for the Bus Saarthi sensor app.

import 'package:flutter_test/flutter_test.dart';

import 'package:bus_sensor_app/app.dart';

void main() {
  testWidgets('the app boots to the splash screen', (WidgetTester tester) async {
    await tester.pumpWidget(const BusSensorApp());

    // The splash screen shows the brand while the session is checked.
    expect(find.text('INVERTIS BUS SAARTHI'), findsOneWidget);

    // The splash screen waits before deciding where to go. Drain that
    // timer so the test does not end with a pending timer.
    await tester.pump(const Duration(seconds: 3));
  });
}
