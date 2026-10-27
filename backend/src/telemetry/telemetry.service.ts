import { Injectable } from '@nestjs/common';
import { TelemetryBatchDto } from './dto/telemetry-batch.dto';
import { PrismaService } from '../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { getISTMidnightUTC } from '../common/utils/ist-date.util';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class TelemetryService {
  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
    @InjectQueue('telemetry') private telemetryQueue: Queue,
  ) {}

  async addBatchToQueue(batchDto: TelemetryBatchDto) {
    const { route_id, data } = batchDto;

    const todayStart = getISTMidnightUTC();
    const isCancelled = await this.prisma.mergeEvent.findFirst({
      where: {
        cancelledRouteId: String(route_id),
        status: 'active',
        createdAt: { gte: todayStart },
      },
    });

    if (isCancelled) {
      return { status: 'success', received: 0, note: 'Route is cancelled today due to merge' };
    }

    // Add to BullMQ queue with retry options
    await this.telemetryQueue.add('process-telemetry', { route_id, data }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: 100,
      removeOnFail: 50,
    });

    return { status: 'queued', received: data.length };
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
