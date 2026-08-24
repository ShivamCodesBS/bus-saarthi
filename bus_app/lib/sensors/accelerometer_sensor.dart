import 'package:sensors_plus/sensors_plus.dart';
import 'dart:async';

class AccelerometerSensor {
  Stream<UserAccelerometerEvent> get accelerometerStream {
    return userAccelerometerEventStream();
  }
}
