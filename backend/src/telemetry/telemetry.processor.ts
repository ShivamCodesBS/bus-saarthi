import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { getISTMidnightUTC } from '../common/utils/ist-date.util';

@Processor('telemetry', { concurrency: 5 })
export class TelemetryProcessor extends WorkerHost {
  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) { super(); }

  async process(job: Job) {
    const { route_id, data } = job.data;

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

    const entities = data.map((item: any) => ({
      routeId: route_id,
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
        route_id,
        ...latest,
      });
    }

    return { status: 'success', received: data.length };
  }
}
