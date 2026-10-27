import 'dart:io';

import 'package:flutter_map_cache/flutter_map_cache.dart';
import 'package:http_cache_file_store/http_cache_file_store.dart';
import 'package:path_provider/path_provider.dart';

/// Service to manage map tile caching using flutter_map_cache
/// with a file system storage backend.
class MapCacheService {
  static Future<FileCacheStore>? _storeFuture;

  /// Initialize the cache store
  static Future<FileCacheStore> _initStore() async {
    final dir = await getTemporaryDirectory();
    return FileCacheStore('${dir.path}${Platform.pathSeparator}MapTiles');
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