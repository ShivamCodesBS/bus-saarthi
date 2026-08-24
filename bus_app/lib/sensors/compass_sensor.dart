import 'package:flutter_compass/flutter_compass.dart';
import 'dart:async';

class CompassSensor {
  Stream<CompassEvent>? get compassStream {
    return FlutterCompass.events;
  }
}
