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

  static String _formatTime(dynamic ts) {
    if (ts == null) return 'Recent';
    final d = DateTime.tryParse(ts.toString())?.toLocal();
    if (d == null) return 'Recent';
    final now = DateTime.now();
    if (d.day == now.day && d.month == now.month && d.year == now.year) {
      final h = d.hour.toString().padLeft(2, '0');
      final m = d.minute.toString().padLeft(2, '0');
      return '$h:$m';
    }
    return '${d.day}/${d.month}/${d.year}';
  }

  factory NotificationItem.fromNoticeJson(Map<String, dynamic> json) {
    final ts = json['timestamp'] ?? json['created_at'] ?? json['createdAt'];
    return NotificationItem(
      id: 'notice-${json['id'] ?? json['_id'] ?? json['title'] ?? 'x'}',
      type: (json['type'] ?? 'info').toString(),
      title: (json['title'] ?? 'Admin Notice').toString(),
      message: (json['body'] ?? json['message'] ?? '').toString(),
      time: _formatTime(ts),
    );
  }

  factory NotificationItem.fromBroadcastJson(Map<String, dynamic> json) {
    final ts = json['timestamp'] ?? json['created_at'] ?? json['createdAt'];
    return NotificationItem(
      id: 'broadcast-${json['id'] ?? json['_id'] ?? 'x'}',
      type: 'broadcast',
      title: (json['title'] ?? 'Notice').toString(),
      message: (json['message'] ?? json['body'] ?? '').toString(),
      time: _formatTime(ts),
    );
  }

  factory NotificationItem.broadcast(Map<String, dynamic> data) =>
      NotificationItem(
        id: 'broadcast-${data['id'] ?? 'active'}',
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

