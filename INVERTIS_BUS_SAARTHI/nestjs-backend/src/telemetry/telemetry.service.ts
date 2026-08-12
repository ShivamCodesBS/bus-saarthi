import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TelemetryBatchDto } from './dto/telemetry-batch.dto';
import { Telemetry } from './entities/telemetry.entity';
import { Attendance } from '../attendance/entities/attendance.entity';
import { Route } from '../routes/entities/route.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { getISTMidnightUTC } from '../common/utils/ist-date.util';
import { MoreThanOrEqual } from 'typeorm';

@Injectable()
export class TelemetryService {
  constructor(
    @InjectRepository(Telemetry) private telemetryRepository: Repository<Telemetry>,
    @InjectRepository(Attendance) private attendanceRepository: Repository<Attendance>,
    @InjectRepository(Route) private routeRepository: Repository<Route>,
    private eventEmitter: EventEmitter2,
  ) {}

  async addBatchToQueue(batchDto: TelemetryBatchDto) {
    const { route_id, data } = batchDto;

    // Process directly (no Redis queue needed for local dev)
    const entities = data.map(item =>
      this.telemetryRepository.create({
        routeId: route_id,
        latitude: item.lat,
        longitude: item.lng,
        gpsSpeedKnots: item.gps_speed_knots,
        mpuSpeedKmh: item.mpu_speed_kmh,
        headingDeg: item.heading_deg,
        timestamp: new Date(item.timestamp),
      }),
    );

    await this.telemetryRepository.save(entities);

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

  async getLatestStatus(routeId: string) {
    const todayStart = getISTMidnightUTC();
    const filled = await this.attendanceRepository.count({
      where: {
        routeId,
        timestamp: MoreThanOrEqual(todayStart),
      }
    });

    const total = 50; // default total bus capacity
    let status = 'Low';
    if (filled >= 50) status = 'Over Crowd';
    else if (filled > 25) status = 'Medium';

    return {
      status: 'success',
      data: {
        filled,
        total,
        status,
      }
    };
  }

  async getTelemetryHistory(routeId: string, dateStr: string) {
    const start = new Date(`${dateStr}T00:00:00+05:30`);
    const end = new Date(`${dateStr}T23:59:59+05:30`);

    const route = await this.routeRepository.findOne({ where: { routeId } });
    const speedLimit = route?.speedLimit || 60;

    const allData = await this.telemetryRepository.createQueryBuilder('t')
      .where('t.routeId = :routeId', { routeId })
      .andWhere('t.timestamp >= :start', { start })
      .andWhere('t.timestamp <= :end', { end })
      .orderBy('t.timestamp', 'ASC')
      .getMany();

    if (allData.length === 0) {
      return { routeId, date: dateStr, speedLimit, data: [], stats: { maxSpeed: 0, avgSpeed: 0, violations: 0 }, violationsData: [] };
    }

    let maxSpeed = 0;
    let sumSpeed = 0;
    const violationsData: any[] = [];
    const downsampledData: any[] = [];
    
    const DOWNSAMPLE_MS = 30 * 1000; // 30 seconds
    let lastPushedTime = 0;

    for (const point of allData) {
      const speed = point.mpuSpeedKmh || (point.gpsSpeedKnots * 1.852) || 0;
      
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
      data: downsampledData
    };
  }
}
