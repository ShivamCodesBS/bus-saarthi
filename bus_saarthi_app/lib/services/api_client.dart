import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

import '../core/constants.dart';
import '../core/theme.dart';
import '../models/user_model.dart';

/// Small authenticated dio wrapper mirroring the web's
/// `axios.get(..., authHeaders)` pattern.
class ApiClient {
  ApiClient._();
  static final Dio dio = Dio(BaseOptions(
    baseUrl: AppConstants.restApiUrl,
    connectTimeout: const Duration(seconds: 20),
    receiveTimeout: const Duration(seconds: 30),
  ));

  /// Standard auth headers for the current user.
  static Map<String, String> authHeaders(UserModel? user) => {
        if (user?.token != null) 'Authorization': 'Bearer ${user!.token}',
      };

  /// Human-friendly error text, like the web's `friendlyError` helper.
  static String friendlyError(Object error, String fallback) {
    if (error is DioException) {
      final data = error.response?.data;
      if (data is Map) {
        final msg = data['message'] ?? data['detail'];
        if (msg != null) return msg.toString();
      }
      if (error.type == DioExceptionType.connectionError ||
          error.type == DioExceptionType.connectionTimeout) {
        return 'Cannot reach the server. Check your internet connection.';
      }
    }
    return fallback;
  }

  /// In-app toast, styled like the web's react-hot-toast.
  static void toast(BuildContext context, String message,
      {ToastKind kind = ToastKind.info, Duration duration = const Duration(seconds: 3)}) {
    final overlay = Overlay.of(context, rootOverlay: true);
    late final OverlayEntry entry;
    entry = OverlayEntry(
      builder: (_) => _ToastView(
        message: message,
        kind: kind,
        onDismiss: () => entry.remove(),
      ),
    );
    overlay.insert(entry);
    Future.delayed(duration, () {
      if (entry.mounted) entry.remove();
    });
  }
}

enum ToastKind { info, success, error, broadcast, wakeAlarm }

class _ToastView extends StatelessWidget {
  final String message;
  final ToastKind kind;
  final VoidCallback onDismiss;

  const _ToastView({required this.message, required this.kind, required this.onDismiss});

  @override
  Widget build(BuildContext context) {
    Color bg;
    switch (kind) {
      case ToastKind.success:
        bg = const Color(0xFF16A34A);
        break;
      case ToastKind.error:
        bg = const Color(0xFFDC2626);
        break;
      case ToastKind.broadcast:
        bg = const Color(0xFFDC2626);
        break;
      case ToastKind.wakeAlarm:
        bg = const Color(0xFF1D4ED8);
        break;
      case ToastKind.info:
        bg = const Color(0xFF1F2937);
    }
    return Positioned(
      top: MediaQuery.of(context).padding.top + 12,
      left: 16,
      right: 16,
      child: Material(
        color: Colors.transparent,
        child: GestureDetector(
          onTap: onDismiss,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: bg,
              borderRadius: BorderRadius.circular(14),
              boxShadow: AppShadows.large,
            ),
            child: Text(
              message,
              style: TextStyle(
                color: Colors.white,
                fontWeight: kind == ToastKind.broadcast || kind == ToastKind.wakeAlarm
                    ? FontWeight.w700
                    : FontWeight.w500,
                fontSize: 14,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
