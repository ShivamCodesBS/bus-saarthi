/// Session user, mirroring the JSON the backend `POST /api/login` returns
/// (snake_case keys, same as the web app stores in `bus_saarthi_user`).
class UserModel {
  final String id; // resolved loginId — mirrors web's `user.id`
  final String loginId;
  final String name;
  final String role;
  final String? routeId;
  final String? feeStatus;
  final String? profilePic;
  final String? designation;
  final String? email;
  final String? phone;
  final String? subject;
  final String? gradeClass;
  final String? token;

  const UserModel({
    required this.id,
    required this.loginId,
    required this.name,
    required this.role,
    this.routeId,
    this.feeStatus,
    this.profilePic,
    this.designation,
    this.email,
    this.phone,
    this.subject,
    this.gradeClass,
    this.token,
  });

  factory UserModel.fromJson(Map<String, dynamic> json, {String? fallbackId}) {
    final String loginId = (json['loginId'] ?? json['login_id'] ?? fallbackId ?? '').toString();
    return UserModel(
      id: loginId,
      loginId: loginId,
      name: (json['name'] ?? '').toString(),
      role: (json['role'] ?? '').toString(),
      routeId: json['route_id']?.toString(),
      feeStatus: json['fee_status']?.toString(),
      profilePic: json['profile_pic']?.toString(),
      designation: json['designation']?.toString(),
      email: json['email']?.toString(),
      phone: json['phone']?.toString(),
      subject: json['subject']?.toString(),
      gradeClass: json['grade_class']?.toString(),
      token: json['token']?.toString(),
    );
  }

  UserModel copyWith({
    String? id,
    String? loginId,
    String? name,
    String? role,
    String? routeId,
    String? feeStatus,
    String? profilePic,
    String? designation,
    String? email,
    String? phone,
    String? subject,
    String? gradeClass,
    String? token,
  }) {
    return UserModel(
      id: id ?? this.id,
      loginId: loginId ?? this.loginId,
      name: name ?? this.name,
      role: role ?? this.role,
      routeId: routeId ?? this.routeId,
      feeStatus: feeStatus ?? this.feeStatus,
      profilePic: profilePic ?? this.profilePic,
      designation: designation ?? this.designation,
      email: email ?? this.email,
      phone: phone ?? this.phone,
      subject: subject ?? this.subject,
      gradeClass: gradeClass ?? this.gradeClass,
      token: token ?? this.token,
    );
  }

  Map<String, dynamic> toJson() => {
        'login_id': loginId,
        'name': name,
        'role': role,
        'route_id': routeId,
        'fee_status': feeStatus,
        'profile_pic': profilePic,
        'designation': designation,
        'email': email,
        'phone': phone,
        'subject': subject,
        'grade_class': gradeClass,
        'token': token,
      };
}
