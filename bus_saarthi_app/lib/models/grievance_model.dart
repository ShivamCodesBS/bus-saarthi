/// Grievance model — mirrors the web Community.jsx complaint objects
/// returned by `GET /api/grievances`.
class Grievance {
  final String id;
  final String? loginId;
  final String? route;
  final String? busNumber;
  final String text;
  final String? type; // text | photo | video | audio
  final String? mediaUrl;
  final String? category;
  final String? realName;
  final bool isAnonymous;
  final String status; // pending | in_progress | resolved | reopened | closed
  final int upvotes;
  final DateTime? createdAt;
  final String? adminResponse;
  final int reopenCount;
  final int priority;
  final DateTime? resolvedAt;
  final DateTime? confirmedAt;
  final String? resolvedBy;
  final String? resolutionNote;
  final bool isMine;

  /// Local optimistic state for the upvote button (web `hasUpvotedLocally`).
  final bool hasUpvotedLocally;

  const Grievance({
    required this.id,
    this.loginId,
    this.route,
    this.busNumber,
    required this.text,
    this.type,
    this.mediaUrl,
    this.category,
    this.realName,
    this.isAnonymous = true,
    required this.status,
    this.upvotes = 0,
    this.createdAt,
    this.adminResponse,
    this.reopenCount = 0,
    this.priority = 0,
    this.resolvedAt,
    this.confirmedAt,
    this.resolvedBy,
    this.resolutionNote,
    this.isMine = false,
    this.hasUpvotedLocally = false,
  });

  factory Grievance.fromJson(Map<String, dynamic> json, String? userLoginId) {
    DateTime? parseDate(Object? v) =>
        v == null ? null : DateTime.tryParse(v.toString());
    final login = json['loginId']?.toString();
    return Grievance(
      id: (json['id'] ?? json['_id'] ?? '').toString(),
      loginId: login,
      route: json['route']?.toString(),
      busNumber: json['busNumber']?.toString(),
      text: (json['text'] ?? '').toString(),
      type: json['type']?.toString(),
      mediaUrl: json['mediaUrl']?.toString(),
      category: json['category']?.toString(),
      realName: json['realName']?.toString(),
      isAnonymous: json['isAnonymous'] != false,
      status: (json['status'] ?? 'pending').toString(),
      upvotes: int.tryParse('${json['upvotes'] ?? 0}') ?? 0,
      createdAt: parseDate(json['createdAt']),
      adminResponse: json['adminResponse']?.toString(),
      reopenCount: int.tryParse('${json['reopenCount'] ?? 0}') ?? 0,
      priority: int.tryParse('${json['priority'] ?? 0}') ?? 0,
      resolvedAt: parseDate(json['resolvedAt']),
      confirmedAt: parseDate(json['confirmedAt']),
      resolvedBy: json['resolvedBy']?.toString(),
      resolutionNote: json['resolutionNote']?.toString(),
      isMine: json['isMine'] == true ||
          (userLoginId != null && login != null && login == userLoginId),
    );
  }

  Grievance copyWith({
    String? status,
    int? upvotes,
    bool? hasUpvotedLocally,
    int? reopenCount,
    int? priority,
    DateTime? resolvedAt,
    DateTime? confirmedAt,
    String? adminResponse,
  }) {
    return Grievance(
      id: id,
      loginId: loginId,
      route: route,
      busNumber: busNumber,
      text: text,
      type: type,
      mediaUrl: mediaUrl,
      category: category,
      realName: realName,
      isAnonymous: isAnonymous,
      status: status ?? this.status,
      upvotes: upvotes ?? this.upvotes,
      createdAt: createdAt,
      adminResponse: adminResponse ?? this.adminResponse,
      reopenCount: reopenCount ?? this.reopenCount,
      priority: priority ?? this.priority,
      resolvedAt: resolvedAt ?? this.resolvedAt,
      confirmedAt: confirmedAt ?? this.confirmedAt,
      resolvedBy: resolvedBy,
      resolutionNote: resolutionNote,
      isMine: isMine,
      hasUpvotedLocally: hasUpvotedLocally ?? this.hasUpvotedLocally,
    );
  }
}

/// Visual treatment for each lifecycle state (web STATUS_META).
class StatusMeta {
  final String label;
  final int bg;
  final int color;

  const StatusMeta(this.label, this.bg, this.color);

  static const Map<String, StatusMeta> all = {
    'pending': StatusMeta('Pending', 0xFFFFF1F0, 0xFFCF1322),
    'in_progress': StatusMeta('In Progress', 0xFFFFF7E6, 0xFFD46B08),
    'resolved': StatusMeta('Awaiting Your Confirmation', 0xFFE6F4FF, 0xFF0958D9),
    'reopened': StatusMeta('Reopened — Not Resolved', 0xFFFFF1F0, 0xFFCF1322),
    'closed': StatusMeta('Closed — Confirmed', 0xFFE6FAE6, 0xFF28A745),
  };

  static StatusMeta of(String status) => all[status] ?? all['pending']!;
}

/// Bus-service categories (web CATEGORIES).
const List<String> grievanceCategories = [
  'AC Problem',
  'Late Arrival',
  'Rash Driving',
  'Overcrowding',
  'Cleanliness',
  'Driver Behavior',
  'Route Issue',
  'Other',
];
