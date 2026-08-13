import 'dart:async';
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_background_service/flutter_background_service.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'socket_service.dart';
import '../sensors/sensor_fusion.dart';

class BackgroundLocatorService {
  static Future<void> initializeService() async {
    final service = FlutterBackgroundService();

    const AndroidNotificationChannel channel = AndroidNotificationChannel(
      'bus_sensor_foreground',
      'Bus Sensor Service',
      description: 'Used for live bus tracking.',
      importance: Importance.low,
    );

    final FlutterLocalNotificationsPlugin flutterLocalNotificationsPlugin =
        FlutterLocalNotificationsPlugin();

    await flutterLocalNotificationsPlugin
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(channel);

    await service.configure(
      androidConfiguration: AndroidConfiguration(
        onStart: onStart,
        autoStart: false,
        isForegroundMode: true,
        notificationChannelId: 'bus_sensor_foreground',
        initialNotificationTitle: 'Bus Sensor',
        initialNotificationContent: 'Ready to track',
        foregroundServiceNotificationId: 888,
      ),
      iosConfiguration: IosConfiguration(
        autoStart: false,
        onForeground: onStart,
        onBackground: onIosBackground,
      ),
    );
  }

  @pragma('vm:entry-point')
  static Future<bool> onIosBackground(ServiceInstance service) async {
    return true;
  }
}

@pragma('vm:entry-point')
void onStart(ServiceInstance service) async {
  DartPluginRegistrant.ensureInitialized();

  if (service is AndroidServiceInstance) {
    service.setAsForegroundService();
    service.setForegroundNotificationInfo(
      title: "Bus Tracking Ready",
      content: "Waiting to start tracking...",
    );
  }

  final socketService = SocketService();
  final sensorFusion = SensorFusion();

  // ── Relay socket connection status to the main isolate ──────────────
  socketService.onConnectionChanged = (connected) {
    service.invoke('socketStatus', {'connected': connected});
  };

  // ── Signal main isolate that background isolate is fully booted ─────
  // This replaces the unreliable blind 2-second delay in SensorProvider.
  service.invoke('serviceReady', {});
  print('[BG] Background isolate ready.');

  // ── Forward telemetry payloads to the main isolate UI ────────────────
  // Set up ONCE here. The broadcast stream is independent of connect/disconnect
  // cycles, so this subscription persists across multiple startSensors calls.
  final telemetrySub = sensorFusion.stream.listen((payload) {
    socketService.emitTelemetry(payload);
    service.invoke('onTelemetryUpdate', payload.toJson());
  });

  // ── Start sensors handler ─────────────────────────────────────────────
  // Only starts when explicitly told to by the main isolate AFTER serviceReady
  // is acknowledged. Eliminates the race condition from the old auto-start.
  service.on('startSensors').listen((event) async {
    final routeId = (event != null && event['routeId'] != null)
        ? event['routeId'].toString()
        : '4';

    print('[BG] startSensors received for route: $routeId');

    // Cleanly stop any existing session before starting a new one
    sensorFusion.stop();
    socketService.disconnect();

    // Brief settle so async cancellations fully complete
    await Future.delayed(const Duration(milliseconds: 300));

    socketService.connect(routeId);
    await sensorFusion.start(routeId);

    if (service is AndroidServiceInstance) {
      service.setForegroundNotificationInfo(
        title: "Bus Tracking Active",
        content: "Sending live telemetry (Route $routeId)...",
      );
    }

    print('[BG] Sensors started on route $routeId.');
  });

  // ── Stop service handler ─────────────────────────────────────────────
  service.on('stopService').listen((event) async {
    await telemetrySub.cancel();
    sensorFusion.dispose(); // closes stream + cancels all sensor subscriptions
    socketService.disconnect();
    service.stopSelf();
    print('[BG] Service stopped by request.');
  });
}
