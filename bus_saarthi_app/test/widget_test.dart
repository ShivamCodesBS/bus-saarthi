import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:bus_saarthi_app/models/route_model.dart';

void main() {
  group('RouteInfo stop parsing', () {
    test('parses list stops', () {
      final route = RouteInfo.fromJson({
        'stops': [' Civil Lines ', 'DD Puram'],
      });
      expect(route.stopsList, ['Civil Lines', 'DD Puram']);
    });

    test('parses JSON-encoded array stops', () {
      final route = RouteInfo.fromJson({
        'stops': '["Civil Lines", "DD Puram"]',
      });
      expect(route.stopsList, ['Civil Lines', 'DD Puram']);
    });

    test('parses legacy comma-separated stops and ignores blanks', () {
      final route = RouteInfo.fromJson({'stops': ' Civil Lines, , DD Puram, '});
      expect(route.stopsList, ['Civil Lines', 'DD Puram']);
    });
  });

  testWidgets('Basic smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text('Bus Saarthi App Test'),
                Text('Test Framework OK'),
              ],
            ),
          ),
        ),
      ),
    );

    expect(find.text('Bus Saarthi App Test'), findsOneWidget);
    expect(find.text('Test Framework OK'), findsOneWidget);
  });
}
