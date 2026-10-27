/// One row in the home notification dropdown. The web builds these from
/// three sources: the active broadcast, the active SOS, and fetched
/// notices — this model mirrors that composite shape.
class NotificationItem {
  final String id;
  final String type; // 'broadcast' | 'sos' | 'info'
  final String title;
  final String message;
  final String time;

  const NotificationItem({
    required this.id,
    required this.type,
    required this.title,
    required this.message,
    required this.time,
  });

  factory NotificationItem.fromNoticeJson(Map<String, dynamic> json) {
    final ts = json['timestamp'] ?? json['created_at'];
    String time = 'Recent';
    if (ts != null) {
      final d = DateTime.tryParse(ts.toString());
      if (d != null) time = '${d.day}/${d.month}/${d.year}';
    }
    return NotificationItem(
      id: 'notice-${json['id'] ?? json['_id'] ?? json['title'] ?? 'x'}',
      type: (json['type'] ?? 'info').toString(),
      title: (json['title'] ?? 'Admin Notice').toString(),
      message: (json['body'] ?? json['message'] ?? '').toString(),
      time: time,
    );
  }

  factory NotificationItem.broadcast(Map<String, dynamic> data) =>
      NotificationItem(
        id: 'broadcast-active',
        type: 'broadcast',
        title: (data['title'] ?? 'Broadcast').toString(),
        message: (data['message'] ?? '').toString(),
        time: 'Now',
      );

  factory NotificationItem.sosActive() => const NotificationItem(
    id: 'sos-active',
    type: 'sos',
    title: 'SOS Active',
    message: 'Your SOS signal is being transmitted.',
    time: 'Now',
  );
}
