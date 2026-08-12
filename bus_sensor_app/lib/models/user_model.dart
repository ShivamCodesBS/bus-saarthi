class UserModel {
  final String loginId;
  final String name;
  final String role;
  final String? routeId;
  final String? profilePic;

  UserModel({
    required this.loginId,
    required this.name,
    required this.role,
    this.routeId,
    this.profilePic,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      loginId: json['login_id'] ?? '',
      name: json['name'] ?? '',
      role: json['role'] ?? '',
      routeId: json['route_id'],
      profilePic: json['profile_pic'],
    );
  }
}
