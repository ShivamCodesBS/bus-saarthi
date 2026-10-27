import { Injectable, Logger } from '@nestjs/common';
import { TelemetryBatchDto } from './dto/telemetry-batch.dto';
import { PrismaService } from '../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { getISTMidnightUTC } from '../common/utils/ist-date.util';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

// How long the readiness probe and the enqueue itself may take before the
// Redis path is abandoned for a direct database write.
const QUEUE_PROBE_TIMEOUT_MS = 1500;
const QUEUE_ADD_TIMEOUT_MS = 3000;
// While Redis is down, re-probe at most once a minute (probes that never
// settle are cheap, but there is no reason to run one per telemetry batch).
const QUEUE_PROBE_RETRY_MS = 60_000;

/** Reject with `message` if `promise` does not settle within `ms`. */
function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(message)), ms),
    ),
  ]);
}

@Injectable()
export class TelemetryService {
  private logger = new Logger('TelemetryService');

  /** null = not probed yet, true = queue usable, false = persist directly. */
  private queueReady: boolean | null = null;
  private lastQueueProbeAt = 0;

  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
    @InjectQueue('telemetry') private telemetryQueue: Queue,
  ) {}

  /**
   * Enqueue a telemetry batch for durable processing (retries + backoff).
   *
   * Redis is optional in this deployment (Render boots without one), and a
   * BullMQ `add` against an unreachable Redis never settles — it waits for
   * the connection forever, hanging every telemetry write. So readiness is
   * probed with a short timeout and cached: while Redis is down the batch is
   * persisted directly, and the queue is re-probed periodically so it picks
   * Redis back up automatically when it appears. Both paths run the same
   * logic (see processBatch).
   */
  async addBatchToQueue(batchDto: TelemetryBatchDto) {
    const { route_id, data } = batchDto;

    if (await this.isQueueReady()) {
      try {
        await withTimeout(
          this.telemetryQueue.add('process-telemetry', { route_id, data }, {
            attempts: 3,
            backoff: { type: 'exponential', delay: 1000 },
            removeOnComplete: 100,
            removeOnFail: 50,
          }),
          QUEUE_ADD_TIMEOUT_MS,
          'queue add timed out',
        );
        return { status: 'queued', received: data.length };
      } catch (err) {
        // Redis died between the probe and the add — stop trusting the
        // queue until the next probe succeeds.
        this.queueReady = false;
        this.lastQueueProbeAt = Date.now();
        this.logger.warn(
          `Telemetry queue write failed (${err?.message}) — persisting directly`,
        );
      }
    }
    return this.processBatch(String(route_id), data);
  }

  /**
   * Bounded, cached check that the BullMQ backend is actually reachable.
   * `waitUntilReady` never settles while Redis is down, so the probe must
   * carry its own timeout; caching keeps the steady-state cost at zero.
   */
  private async isQueueReady(): Promise<boolean> {
    if (this.queueReady === true) return true;

    const now = Date.now();
    if (
      this.queueReady === false &&
      now - this.lastQueueProbeAt < QUEUE_PROBE_RETRY_MS
    ) {
      return false;
    }
    this.lastQueueProbeAt = now;

    try {
      await withTimeout(
        this.telemetryQueue.waitUntilReady(),
        QUEUE_PROBE_TIMEOUT_MS,
        'Redis probe timed out',
      );
      this.queueReady = true;
      this.logger.log('Telemetry queue (Redis) is available — using BullMQ');
    } catch {
      if (this.queueReady !== true) {
        this.queueReady = false;
        this.logger.warn(
          'Redis unreachable — telemetry will be persisted directly',
        );
      }
    }
    return this.queueReady === true;
  }

  /**
   * Merge-check, persist and broadcast one telemetry batch. The single
   * source of truth shared by the BullMQ worker (TelemetryProcessor) and
   * the no-Redis fallback above.
   */
  async processBatch(routeId: string, data: any[]) {
    const todayStart = getISTMidnightUTC();
    const isCancelled = await this.prisma.mergeEvent.findFirst({
      where: {
        cancelledRouteId: String(routeId),
        status: 'active',
        createdAt: { gte: todayStart },
      },
    });

    if (isCancelled) {
      return { status: 'success', received: 0, note: 'Route is cancelled today due to merge' };
    }

    const entities = data.map((item: any) => ({
      routeId: String(routeId),
      latitude: item.lat,
      longitude: item.lng,
      gpsSpeedKnots: item.gps_speed_knots,
      mpuSpeedKmh: item.mpu_speed_kmh,
      headingDeg: item.heading_deg,
      timestamp: new Date(item.timestamp),
    }));

    if (entities.length > 0) {
      await this.prisma.telemetry.createMany({ data: entities });
    }

    // Broadcast live location to Gateway
    if (data.length > 0) {
      const latest = data[data.length - 1];
      this.eventEmitter.emit('telemetry.live', {
        route_id: String(routeId),
        ...latest,
      });
    }

    return { status: 'success', received: data.length };
  }

  async getLatestStatus(routeId: string) {
    const todayStart = getISTMidnightUTC();
    
    // Get capacity from route or bus
    const route = await this.prisma.route.findUnique({
      where: { routeId },
      select: { 
        seatingCapacity: true,
        bus: { select: { seatingCapacity: true } }
      }
    });
    
    // Priority: Route.seatingCapacity > Bus.seatingCapacity > default 50
    const total = route?.seatingCapacity ?? route?.bus?.seatingCapacity ?? 50;

    const filled = await this.prisma.attendance.count({
      where: {
        routeId,
        timestamp: { gte: todayStart },
      },
    });

    let status = 'Low';
    if (filled >= total) status = 'Over Crowd';
    else if (filled > total / 2) status = 'Medium';

    return {
      status: 'success',
      data: {
        filled,
        total,
        status,
      },
    };
  }

  /**
   * The most recent GPS fix stored for a route. This is what the map shows
   * when the bus is offline — the last place it was actually seen, instead
   * of a hardcoded default pin.
   */
  async getLastTelemetry(routeId: string) {
    const row = await this.prisma.telemetry.findFirst({
      where: {
        routeId: String(routeId),
        latitude: { not: null },
        longitude: { not: null },
      },
      orderBy: { timestamp: 'desc' },
    });

    if (!row) {
      return { status: 'success', data: null };
    }

    return {
      status: 'success',
      data: {
        route_id: String(row.routeId),
        lat: row.latitude,
        lng: row.longitude,
        speed: row.mpuSpeedKmh ?? (row.gpsSpeedKnots ?? 0) * 1.852,
        heading: row.headingDeg ?? 0,
        timestamp: row.timestamp,
      },
    };
  }

  async getTelemetryHistory(routeId: string, dateStr: string) {
    const start = new Date(`${dateStr}T00:00:00+05:30`);
    const end = new Date(`${dateStr}T23:59:59+05:30`);

    const route = await this.prisma.route.findUnique({ where: { routeId } });
    const speedLimit = route?.speedLimit || 60;

    const allData = await this.prisma.telemetry.findMany({
      where: {
        routeId,
        timestamp: { gte: start, lte: end },
      },
      orderBy: { timestamp: 'asc' },
    });

    if (allData.length === 0) {
      return {
        routeId,
        date: dateStr,
        speedLimit,
        data: [],
        stats: { maxSpeed: 0, avgSpeed: 0, violations: 0 },
        violationsData: [],
      };
    }

    let maxSpeed = 0;
    let sumSpeed = 0;
    const violationsData: any[] = [];
    const downsampledData: any[] = [];

    const DOWNSAMPLE_MS = 30 * 1000; // 30 seconds
    let lastPushedTime = 0;

    for (const point of allData) {
      const speed =
        point.mpuSpeedKmh ||
        (point.gpsSpeedKnots && point.gpsSpeedKnots * 1.852) ||
        0;

      if (speed > maxSpeed) maxSpeed = speed;
      sumSpeed += speed;

      const isViolation = speed > speedLimit;
      if (isViolation) {
        violationsData.push({ ...point, speed: Math.round(speed) });
      }

      const pointTime = point.timestamp.getTime();
      if (isViolation || pointTime - lastPushedTime >= DOWNSAMPLE_MS) {
        downsampledData.push({
          timestamp: point.timestamp,
          speed: Math.round(speed),
          lat: point.latitude,
          lng: point.longitude,
        });
        lastPushedTime = pointTime;
      }
    }

    return {
      routeId,
      date: dateStr,
      speedLimit,
      stats: {
        maxSpeed: Math.round(maxSpeed),
        avgSpeed: Math.round(sumSpeed / allData.length),
        violations: violationsData.length,
      },
      violationsData,
      data: downsampledData,
    };
  }
}
