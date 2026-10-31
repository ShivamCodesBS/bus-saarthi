import 'dart:io';

import 'package:flutter_map_cache/flutter_map_cache.dart';
import 'package:http_cache_file_store/http_cache_file_store.dart';
import 'package:path_provider/path_provider.dart';

/// Service to manage map tile caching using flutter_map_cache
/// with a file system storage backend.
class MapCacheService {
  static Future<FileCacheStore>? _storeFuture;

  /// Initialize the cache store with fresh cache namespace to invalidate any blocked 403 tiles
  static Future<FileCacheStore> _initStore() async {
    final dir = await getTemporaryDirectory();
    final oldDir = Directory('${dir.path}${Platform.pathSeparator}MapTiles');
    if (await oldDir.exists()) {
      try {
        await oldDir.delete(recursive: true);
      } catch (_) {}
    }
    return FileCacheStore('${dir.path}${Platform.pathSeparator}MapTilesV2');
  }

  /// Get the cached tile provider for OpenStreetMap tiles
  static Future<CachedTileProvider> getTileProvider() async {
    _storeFuture ??= _initStore();
    final store = await _storeFuture!;
    return CachedTileProvider(
      store: store,
      maxStale: const Duration(days: 30),
      cachePolicy: CachePolicy.forceCache,
    );
  }
}