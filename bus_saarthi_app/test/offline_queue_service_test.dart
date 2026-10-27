import 'dart:async';
import 'dart:convert';

import 'package:bus_saarthi_app/services/offline_queue_service.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('OfflineQueueService', () {
    late SharedPreferences prefs;

    setUp(() async {
      SharedPreferences.setMockInitialValues({});
      prefs = await SharedPreferences.getInstance();
    });

    OfflineQueueService createService(
      Future<bool> Function(OfflineAction action) process,
    ) => OfflineQueueService(
      dio: Dio(),
      token: 'token',
      preferencesProvider: () async => prefs,
      actionProcessor: process,
    );

    OfflineAction action(String id) =>
        OfflineAction(id: id, type: OfflineActionType.confirmFix, targetId: id);

    test(
      'isolates malformed records and continues processing valid actions',
      () async {
        await prefs.setString(
          'offline_queue',
          jsonEncode([
            {
              'id': 'bad',
              'type': 'missing',
              'targetId': 'bad',
              'timestamp': 'x',
            },
            action('good').toJson(),
          ]),
        );
        final processed = <String>[];
        final service = createService((item) async {
          processed.add(item.id);
          return true;
        });

        await service.processQueue();

        expect(processed, ['good']);
        expect(await service.getQueue(), isEmpty);
        expect(jsonDecode(prefs.getString('offline_queue')!), isEmpty);
      },
    );

    test(
      'persists failures as retryable and continues to later actions',
      () async {
        final processed = <String>[];
        await prefs.setString(
          'offline_queue',
          jsonEncode([action('failed').toJson(), action('succeeded').toJson()]),
        );
        var fail = true;
        final service = createService((item) async {
          processed.add(item.id);
          if (item.id == 'failed' && fail) throw StateError('temporary');
          return true;
        });

        await service.processQueue();
        expect(processed, ['failed', 'succeeded']);
        expect((await service.getQueue()).map((item) => item.id), ['failed']);
        expect((await service.getQueue()).single.data?['attempts'], 1);

        fail = false;
        await service.processQueue();
        expect(await service.getQueue(), isEmpty);
      },
    );

    test(
      'serializes enqueue behind processing without losing new items',
      () async {
        final started = Completer<void>();
        final release = Completer<void>();
        final service = createService((_) async {
          started.complete();
          await release.future;
          return true;
        });
        await service.enqueue(action('existing'));

        final processing = service.processQueue();
        await started.future;
        final enqueue = service.enqueue(action('added-during-process'));
        release.complete();
        await Future.wait([processing, enqueue]);

        expect((await service.getQueue()).map((item) => item.id), [
          'added-during-process',
        ]);
      },
    );

    test(
      'coalesces toggles to latest desired state and keeps retry identity',
      () async {
        final service = createService((_) async => false);
        final first = OfflineAction(
          id: 'first',
          type: OfflineActionType.upvote,
          targetId: 'grievance',
          data: {'desiredVote': true},
        );
        final second = OfflineAction(
          id: 'second',
          type: OfflineActionType.upvote,
          targetId: 'grievance',
          data: {'desiredVote': false},
        );
        await service.enqueueUpvoteToggle(first);
        await service.enqueueUpvoteToggle(second);

        var queued = await service.getQueue();
        expect(queued, hasLength(1));
        expect(queued.single.id, 'first');
        expect(queued.single.data?['desiredVote'], false);

        await service.processQueue();
        queued = await service.getQueue();
        expect(queued.single.data?['attempts'], 3);
      },
    );
  });
}
