import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/api_service.dart';

class UserModel {
  final String id;
  final String loginId;
  final String name;
  final String role;
  final String token;
  final String? email;
  final String? profilePic;
  final String? routeId;
  final String? routeName;
  final String? busNumber;
  final String? phone;

  UserModel({
    required this.id,
    required this.loginId,
    required this.name,
    required this.role,
    required this.token,
    this.email,
    this.profilePic,
    this.routeId,
    this.routeName,
    this.busNumber,
    this.phone,
  });

  factory UserModel.fromJson(Map<String, dynamic> json, String token) {
    return UserModel(
      id: json['loginId']?.toString() ?? json['login_id']?.toString() ?? '',
      loginId: json['loginId']?.toString() ?? json['login_id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      role: json['role']?.toString() ?? 'passenger',
      token: token,
      email: json['email']?.toString(),
      profilePic: json['profile_pic']?.toString(),
      routeId: json['routeId']?.toString() ?? json['route_id']?.toString(),
      routeName: json['routeName']?.toString() ?? json['route_name']?.toString(),
      busNumber: json['busNumber']?.toString() ?? json['bus_number']?.toString(),
      phone: json['phone']?.toString(),
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'loginId': loginId,
    'name': name,
    'role': role,
    'token': token,
    'email': email,
    'profile_pic': profilePic,
    'routeId': routeId,
    'routeName': routeName,
    'busNumber': busNumber,
    'phone': phone,
  };
}

class AuthProvider with ChangeNotifier {
  final SharedPreferences _prefs;
  late final ApiService apiService;

  UserModel? _user;
  bool _loading = true;

  UserModel? get user => _user;
  bool get loading => _loading;
  bool get isAuthenticated => _user != null;

  AuthProvider(this._prefs) {
    apiService = ApiService(_prefs);
    _loadStoredUser();
  }

  void _loadStoredUser() {
    final storedUser = _prefs.getString('bus_saarthi_user');
    if (storedUser != null) {
      try {
        final json = jsonDecode(storedUser) as Map<String, dynamic>;
        _user = UserModel(
          id: json['id'] ?? '',
          loginId: json['loginId'] ?? '',
          name: json['name'] ?? '',
          role: json['role'] ?? 'passenger',
          token: json['token'] ?? '',
          email: json['email'],
          profilePic: json['profile_pic'],
          routeId: json['routeId'],
          routeName: json['routeName'],
          busNumber: json['busNumber'],
          phone: json['phone'],
        );
      } catch (_) {}
    }
    _loading = false;
    notifyListeners();
  }

  Future<Map<String, dynamic>> login(String loginId, String password) async {
    try {
      final response = await apiService.login(loginId, password);
      if (response.statusCode == 200) {
        final data = response.data;
        if (data['status'] == 'success') {
          final userJson = data['user'] as Map<String, dynamic>;
          final token = data['token'] as String;
          _user = UserModel.fromJson(userJson, token);
          await _prefs.setString('bus_saarthi_user', jsonEncode(_user!.toJson()));
          notifyListeners();
          return {'success': true, 'role': _user!.role};
        }
      }
      return {'success': false, 'message': 'Login failed'};
    } catch (e) {
      final errMsg = e.toString();
      if (errMsg.contains('429')) {
        return {'success': false, 'message': 'Too many attempts. Try again later.', 'locked': true};
      }
      return {'success': false, 'message': 'Invalid Credentials or Server Down'};
    }
  }

  Future<void> logout() async {
    _user = null;
    await _prefs.remove('bus_saarthi_user');
    notifyListeners();
  }

  void updateProfilePic(String url) {
    if (_user != null) {
      _user = UserModel(
        id: _user!.id, loginId: _user!.loginId, name: _user!.name,
        role: _user!.role, token: _user!.token, email: _user!.email,
        profilePic: url, routeId: _user!.routeId, routeName: _user!.routeName,
        busNumber: _user!.busNumber, phone: _user!.phone,
      );
      _prefs.setString('bus_saarthi_user', jsonEncode(_user!.toJson()));
      notifyListeners();
    }
  }
}
