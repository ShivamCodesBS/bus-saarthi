import 'package:flutter/material.dart';
import 'app.dart';
import 'services/sync_service.dart';
import 'services/background_locator_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Initialize background offline sync
  SyncService.initializeWorkManager();
  
  // Ask for all permissions upfront before showing splash
  // Moved sequentially to DashboardScreen to avoid Android dialog deadlocks

  // Initialize foreground service for live tracking
  await BackgroundLocatorService.initializeService();

  runApp(const BusSensorApp());
}
