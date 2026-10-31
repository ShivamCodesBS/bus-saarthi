import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import '../../models/telemetry_model.dart';
import '../../core/theme.dart';

class DriverMapWidget extends StatefulWidget {
  final TelemetryData? telemetry;
  final bool isLive;
  final String routeId;
  final String? busNumber;
  final LatLng? routeCenter;
  final double? routeZoom;
  final List<LatLng>? routeStops;
  final List<Map<String, dynamic>>? stopDetails;
  final Function(int index, Map<String, dynamic> stop)? onStopTapped;

  const DriverMapWidget({
    Key? key,
    required this.telemetry,
    required this.isLive,
    required this.routeId,
    this.busNumber,
    this.routeCenter,
    this.routeZoom,
    this.routeStops,
    this.stopDetails,
    this.onStopTapped,
  }) : super(key: key);

  @override
  DriverMapWidgetState createState() => DriverMapWidgetState();
}

class DriverMapWidgetState extends State<DriverMapWidget> with TickerProviderStateMixin {
  final MapController _mapController = MapController();
  late AnimationController _pulseController;
  late Animation<double> _pulseAnimation;
  bool _autoFollow = true;

  // Default center (Invertis University area, Bareilly)
  static const LatLng _defaultCenter = LatLng(28.3180, 79.4670);
  static const double _defaultZoom = 14.5;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      duration: const Duration(milliseconds: 1500),
      vsync: this,
    )..repeat(reverse: true);
    _pulseAnimation = Tween<double>(begin: 0.7, end: 1.0).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );
  }

  @override
  void didUpdateWidget(DriverMapWidget oldWidget) {
    super.didUpdateWidget(oldWidget);
    // Auto-follow bus if enabled and position changed
    if (_autoFollow && widget.telemetry != null) {
      final oldPos = oldWidget.telemetry;
      if (oldPos == null ||
          oldPos.latitude != widget.telemetry!.latitude ||
          oldPos.longitude != widget.telemetry!.longitude) {
        _mapController.move(
          LatLng(widget.telemetry!.latitude, widget.telemetry!.longitude),
          _mapController.camera.zoom,
        );
      }
    }
  }

  @override
  void dispose() {
    _pulseController.dispose();
    super.dispose();
  }

  /// Public method to center map on bus with zoom
  void centerOnBus() {
    if (widget.telemetry != null) {
      setState(() => _autoFollow = true);
      _mapController.move(
        LatLng(widget.telemetry!.latitude, widget.telemetry!.longitude),
        16.0,
      );
    } else if (widget.routeStops != null && widget.routeStops!.isNotEmpty) {
      _mapController.move(widget.routeStops!.first, 15.0);
    }
  }

  LatLng get _busPosition {
    if (widget.telemetry != null) {
      return LatLng(widget.telemetry!.latitude, widget.telemetry!.longitude);
    }
    if (widget.routeStops != null && widget.routeStops!.isNotEmpty) {
      return widget.routeStops!.first;
    }
    return widget.routeCenter ?? _defaultCenter;
  }

  double get _currentZoom => widget.routeZoom ?? _defaultZoom;

  @override
  Widget build(BuildContext context) {
    final hasTelemetry = widget.telemetry != null;

    return Stack(
      children: [
        // Main Map
        FlutterMap(
          mapController: _mapController,
          options: MapOptions(
            initialCenter: _busPosition,
            initialZoom: _currentZoom,
            minZoom: 10,
            maxZoom: 19,
            interactionOptions: const InteractionOptions(
              flags: InteractiveFlag.all & ~InteractiveFlag.rotate,
            ),
            onPositionChanged: (pos, hasGesture) {
              if (hasGesture && _autoFollow) {
                // Driver moved map manually, disable auto-follow temporarily
                setState(() => _autoFollow = false);
              }
            },
          ),
          children: [
            // OpenStreetMap tiles
            TileLayer(
              urlTemplate: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
              subdomains: const ['a', 'b', 'c', 'd'],
              userAgentPackageName: 'com.bussaarthi.bus_saarthi_app',
              userAgentPackageName: 'com.invertis.bus_saarthi',
              maxZoom: 19,
            ),

            // Route Polyline
            if (widget.routeStops != null && widget.routeStops!.length > 1)
              PolylineLayer(
                polylines: [
                  // Outer casing / glow
                  Polyline(
                    points: widget.routeStops!,
                    strokeWidth: 7,
                    color: AppTheme.orange.withOpacity(0.35),
                  ),
                  // Inner solid route line
                  Polyline(
                    points: widget.routeStops!,
                    strokeWidth: 4,
                    color: AppTheme.orange,
                  ),
                ],
              ),

            // Stop Markers along the route
            if (widget.routeStops != null && widget.routeStops!.isNotEmpty)
              MarkerLayer(
                markers: widget.routeStops!.asMap().entries.map((entry) {
                  final index = entry.key;
                  final point = entry.value;
                  final stopData = (widget.stopDetails != null && index < widget.stopDetails!.length)
                      ? widget.stopDetails![index]
                      : null;
                  final stopName = stopData?['name']?.toString() ?? 'Stop ${index + 1}';
                  final isTerminal = index == 0 || index == widget.routeStops!.length - 1;

                  return Marker(
                    point: point,
                    width: 70,
                    height: 50,
                    alignment: Alignment.topCenter,
                    child: GestureDetector(
                      onTap: () {
                        if (stopData != null && widget.onStopTapped != null) {
                          widget.onStopTapped!(index, stopData);
                        } else {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text('Stop ${index + 1}: $stopName'),
                              duration: const Duration(seconds: 2),
                              behavior: SnackBarBehavior.floating,
                            ),
                          );
                        }
                      },
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                            decoration: BoxDecoration(
                              color: isTerminal ? AppTheme.black : Colors.white,
                              borderRadius: BorderRadius.circular(6),
                              border: Border.all(
                                color: isTerminal ? Colors.white : AppTheme.orange,
                                width: 1.2,
                              ),
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withOpacity(0.18),
                                  blurRadius: 4,
                                  offset: const Offset(0, 1),
                                ),
                              ],
                            ),
                            child: Text(
                              stopName,
                              style: TextStyle(
                                fontSize: 9,
                                fontWeight: FontWeight.w700,
                                color: isTerminal ? Colors.white : AppTheme.black,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Container(
                            width: 22,
                            height: 22,
                            decoration: BoxDecoration(
                              color: isTerminal ? AppTheme.orange : Colors.white,
                              shape: BoxShape.circle,
                              border: Border.all(
                                color: isTerminal ? Colors.white : AppTheme.orange,
                                width: 2,
                              ),
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withOpacity(0.2),
                                  blurRadius: 4,
                                ),
                              ],
                            ),
                            child: Center(
                              child: Text(
                                '${index + 1}',
                                style: TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w800,
                                  color: isTerminal ? Colors.white : AppTheme.orange,
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                }).toList(),
              ),

            // Live Bus Marker with Heading & Pulse
            if (hasTelemetry && widget.isLive)
              AnimatedBuilder(
                animation: _pulseAnimation,
                builder: (context, child) {
                  return MarkerLayer(
                    markers: [
                      Marker(
                        point: _busPosition,
                        width: 70,
                        height: 70,
                        alignment: Alignment.center,
                        child: _buildAnimatedBusMarker(),
                      ),
                    ],
                  );
                },
              )
            else if (hasTelemetry)
              MarkerLayer(
                markers: [
                  Marker(
                    point: _busPosition,
                    width: 60,
                    height: 60,
                    alignment: Alignment.center,
                    child: _buildStaticBusMarker(),
                  ),
                ],
              ),
          ],
        ),

        // Controls (Right side)
        Positioned(
          top: 100,
          right: 14,
          child: Column(
            children: [
              // Auto-follow toggle
              _MapControlButton(
                icon: _autoFollow ? Icons.lock : Icons.lock_open,
                active: _autoFollow,
                onTap: () {
                  setState(() => _autoFollow = !_autoFollow);
                  if (_autoFollow) centerOnBus();
                },
                tooltip: _autoFollow ? 'Auto-follow ON' : 'Auto-follow OFF',
              ),
              const SizedBox(height: 8),
              // Center on bus
              _MapControlButton(
                icon: Icons.my_location,
                onTap: centerOnBus,
                tooltip: 'Center on bus',
              ),
              const SizedBox(height: 8),
              // Zoom In
              _MapControlButton(
                icon: Icons.add,
                onTap: () => _mapController.move(
                  _mapController.camera.center,
                  _mapController.camera.zoom + 1,
                ),
                tooltip: 'Zoom in',
              ),
              const SizedBox(height: 8),
              // Zoom Out
              _MapControlButton(
                icon: Icons.remove,
                onTap: () => _mapController.move(
                  _mapController.camera.center,
                  _mapController.camera.zoom - 1,
                ),
                tooltip: 'Zoom out',
              ),
            ],
          ),
        ),

        // Live / Offline Status Pill (Top left under app bar)
        Positioned(
          top: 100,
          left: 14,
          child: _LiveIndicator(
            pulseAnimation: _pulseAnimation,
            isLive: widget.isLive,
          ),
        ),

        // No telemetry overlay
        if (!hasTelemetry)
          Positioned(
            bottom: 240,
            left: 20,
            right: 20,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.95),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppTheme.surfaceBorder),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.08),
                    blurRadius: 16,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Row(
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: AppTheme.orange.withOpacity(0.12),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.gps_fixed_rounded,
                      color: AppTheme.orange,
                      size: 20,
                    ),
                  ),
                  const SizedBox(width: 12),
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          'Acquiring Satellite Fix...',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: AppTheme.black,
                          ),
                        ),
                        Text(
                          'Start trip to broadcast phone location to server',
                          style: TextStyle(
                            fontSize: 11,
                            color: AppTheme.blackSoft,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildAnimatedBusMarker() {
    final rawHeading = widget.telemetry?.heading;
    final heading = rawHeading != null ? TelemetryData.normalizeHeading(rawHeading) : null;
    final busLabel = widget.busNumber != null && widget.busNumber!.isNotEmpty
        ? widget.busNumber!
        : 'BUS';

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        // Bus tag
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
          decoration: BoxDecoration(
            color: AppTheme.black,
            borderRadius: BorderRadius.circular(5),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.3),
                blurRadius: 4,
                offset: const Offset(0, 1),
              ),
            ],
          ),
          child: Text(
            busLabel,
            style: const TextStyle(
              fontSize: 8.5,
              fontWeight: FontWeight.w800,
              color: Colors.white,
              letterSpacing: 0.5,
            ),
          ),
        ),
        const SizedBox(height: 2),
        // Pulsing Marker with heading orientation
        Stack(
          alignment: Alignment.center,
          children: [
            // Pulse ring
            Container(
              width: 50 * _pulseAnimation.value,
              height: 50 * _pulseAnimation.value,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: AppTheme.orange.withOpacity(0.28 * (1.1 - _pulseAnimation.value)),
              ),
            ),
            // Outer halo
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: AppTheme.orange,
                shape: BoxShape.circle,
                border: Border.all(color: Colors.white, width: 2.5),
                boxShadow: [
                  BoxShadow(
                    color: AppTheme.orange.withOpacity(0.5),
                    blurRadius: 10,
                    spreadRadius: 2,
                  ),
                ],
              ),
              child: Center(
                child: heading != null
                    ? Transform.rotate(
                        angle: (heading * pi / 180),
                        child: const Icon(
                          Icons.navigation_rounded,
                          color: Colors.white,
                          size: 20,
                        ),
                      )
                    : const Icon(
                        Icons.directions_bus_rounded,
                        color: Colors.white,
                        size: 20,
                      ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildStaticBusMarker() {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 38,
          height: 38,
          decoration: BoxDecoration(
            color: Colors.grey.shade600,
            shape: BoxShape.circle,
            border: Border.all(color: Colors.white, width: 2.5),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.25),
                blurRadius: 6,
              ),
            ],
          ),
          child: const Center(
            child: Icon(
              Icons.directions_bus_rounded,
              color: Colors.white,
              size: 20,
            ),
          ),
        ),
      ],
    );
  }
}

class _MapControlButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;
  final String tooltip;
  final bool active;

  const _MapControlButton({
    required this.icon,
    required this.onTap,
    required this.tooltip,
    this.active = false,
  });

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: Material(
        color: active ? AppTheme.orange : Colors.white,
        elevation: 3,
        borderRadius: BorderRadius.circular(12),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(12),
          child: SizedBox(
            width: 40,
            height: 40,
            child: Icon(
              icon,
              size: 20,
              color: active ? Colors.white : AppTheme.black,
            ),
          ),
        ),
      ),
    );
  }
}

class _LiveIndicator extends StatelessWidget {
  final Animation<double> pulseAnimation;
  final bool isLive;

  const _LiveIndicator({
    required this.pulseAnimation,
    required this.isLive,
  });

  @override
  Widget build(BuildContext context) {
    final color = isLive ? AppTheme.success : Colors.orange;

    return AnimatedBuilder(
      animation: pulseAnimation,
      builder: (context, child) {
        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(20),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.1),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 8,
                height: 8,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: isLive ? color.withOpacity(pulseAnimation.value) : color,
                  boxShadow: isLive
                      ? [
                          BoxShadow(
                            color: color.withOpacity(pulseAnimation.value * 0.5),
                            blurRadius: 6,
                            spreadRadius: 1,
                          ),
                        ]
                      : null,
                ),
              ),
              const SizedBox(width: 6),
              Text(
                isLive ? 'BROADCASTING' : 'CONNECTING',
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w800,
                  color: color,
                  letterSpacing: 1.0,
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
