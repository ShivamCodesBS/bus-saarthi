import 'package:audioplayers/audioplayers.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';

import '../core/theme.dart';

/// Port of the web MediaViewer: fullscreen black overlay with a zoomable
/// photo, a video player, or an audio player with play/pause.
class MediaViewer extends StatefulWidget {
  final String type; // photo | video | audio
  final String url;
  final VoidCallback onClose;

  const MediaViewer({
    super.key,
    required this.type,
    required this.url,
    required this.onClose,
  });

  @override
  State<MediaViewer> createState() => _MediaViewerState();
}

class _MediaViewerState extends State<MediaViewer> {
  VideoPlayerController? _video;
  AudioPlayer? _audio;
  bool _audioPlaying = false;
  Duration _audioPosition = Duration.zero;
  Duration _audioDuration = Duration.zero;

  @override
  void initState() {
    super.initState();
    if (widget.type == 'video') {
      final controller = VideoPlayerController.networkUrl(Uri.parse(widget.url));
      _video = controller;
      controller.initialize().then((_) {
        if (mounted) {
          setState(() {});
          controller.play();
        }
      }).catchError((_) {});
    } else if (widget.type == 'audio') {
      final player = AudioPlayer();
      _audio = player;
      player.onPlayerStateChanged.listen((state) {
        if (mounted) setState(() => _audioPlaying = state == PlayerState.playing);
      });
      player.onDurationChanged.listen((d) {
        if (mounted) setState(() => _audioDuration = d);
      });
      player.onPositionChanged.listen((p) {
        if (mounted) setState(() => _audioPosition = p);
      });
      player.play(UrlSource(widget.url)).catchError((_) {});
    }
  }

  @override
  void dispose() {
    _video?.dispose();
    _audio?.dispose();
    super.dispose();
  }

  String _two(int v) => v.toString().padLeft(2, '0');

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.black.withValues(alpha: 0.92),
      child: SafeArea(
        child: Stack(
          children: [
            // Content
            if (widget.type == 'photo')
              Center(
                child: InteractiveViewer(
                  maxScale: 5,
                  child: CachedNetworkImage(
                    imageUrl: widget.url,
                    fit: BoxFit.contain,
                    errorWidget: (_, __, ___) => const Padding(
                      padding: EdgeInsets.all(32),
                      child: Text('Could not load image',
                          style: TextStyle(color: Colors.white70)),
                    ),
                  ),
                ),
              )
            else if (widget.type == 'video')
              Center(
                child: _video!.value.isInitialized
                    ? AspectRatio(
                        aspectRatio: _video!.value.aspectRatio,
                        child: VideoPlayer(_video!),
                      )
                    : const CircularProgressIndicator(
                        valueColor: AlwaysStoppedAnimation(Colors.white),
                      ),
              )
            else
              Center(
                child: Padding(
                  padding: const EdgeInsets.all(32),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      // Play/pause
                      Material(
                        color: AppColors.secondaryOrange,
                        shape: const CircleBorder(),
                        child: InkWell(
                          customBorder: const CircleBorder(),
                          onTap: () {
                            final player = _audio;
                            if (player == null) return;
                            if (_audioPlaying) {
                              player.pause();
                            } else {
                              player.resume();
                            }
                          },
                          child: Padding(
                            padding: const EdgeInsets.all(22),
                            child: Icon(
                              _audioPlaying ? Icons.pause : Icons.play_arrow,
                              size: 30,
                              color: Colors.white,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 18),
                      Slider(
                        value: _audioPosition.inMilliseconds
                            .clamp(0, _audioDuration.inMilliseconds == 0
                                ? 1
                                : _audioDuration.inMilliseconds)
                            .toDouble(),
                        max: _audioDuration.inMilliseconds == 0
                            ? 1
                            : _audioDuration.inMilliseconds.toDouble(),
                        activeColor: Colors.white,
                        onChanged: (v) =>
                            _audio?.seek(Duration(milliseconds: v.toInt())),
                      ),
                      Text(
                        '${_two(_audioPosition.inMinutes)}:${_two(_audioPosition.inSeconds % 60)} / '
                        '${_two(_audioDuration.inMinutes)}:${_two(_audioDuration.inSeconds % 60)}',
                        style: const TextStyle(color: Colors.white70, fontSize: 13),
                      ),
                    ],
                  ),
                ),
              ),

            // Close button
            Positioned(
              top: 8,
              right: 8,
              child: IconButton(
                onPressed: widget.onClose,
                icon: const Icon(Icons.close, size: 26, color: Colors.white),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Push the fullscreen media viewer like the web `setMediaOpen`.
Future<void> showMedia(BuildContext context,
    {required String type, required String url}) {
  return Navigator.of(context, rootNavigator: true).push(PageRouteBuilder(
    opaque: false,
    barrierColor: Colors.black,
    pageBuilder: (_, __, ___) => MediaViewer(type: type, url: url, onClose: () => Navigator.of(context).pop()),
    transitionsBuilder: (_, anim, __, child) =>
        FadeTransition(opacity: anim, child: child),
  ));
}
