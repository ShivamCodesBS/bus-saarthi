import 'package:bus_saarthi_app/models/notification_item.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('NotificationItem.fromNoticeJson', () {
    test('maps backend inbox body and created_at fields', () {
      final item = NotificationItem.fromNoticeJson({
        'id': 'notice-1',
        'title': 'Complaint update',
        'body': 'Your complaint was resolved.',
        'type': 'grievance',
        'created_at': '2026-10-26T08:30:00.000Z',
      });

      expect(item.id, 'notice-notice-1');
      expect(item.title, 'Complaint update');
      expect(item.message, 'Your complaint was resolved.');
      expect(item.type, 'grievance');
      expect(item.time, '26/10/2026');
    });
  });
}
