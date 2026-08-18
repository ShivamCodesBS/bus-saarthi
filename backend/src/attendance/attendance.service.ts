import { Injectable, BadRequestException } from '@nestjs/common';
import { SyncAttendanceDto } from './dto/sync-attendance.dto';
import { PrismaService } from '../prisma/prisma.service';
import { getISTMidnightUTC } from '../common/utils/ist-date.util';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class AttendanceService {
  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

  async syncAttendance(syncDto: SyncAttendanceDto) {
    const { route_id, records } = syncDto;

    if (!records || records.length === 0) {
      throw new BadRequestException('No records to sync');
    }

    const todayStart = getISTMidnightUTC();
    const results = { synced: 0, skipped: 0, errors: 0 };

    for (const record of records) {
      try {
        // Prevent duplicate check
        const existing = await this.prisma.attendance.findFirst({
          where: {
            passengerId: record.passenger_id,
            timestamp: {
              gte: todayStart,
            },
          },
        });

        if (existing) {
          results.skipped++;
          continue;
        }

        const passenger = await this.prisma.user.findUnique({
          where: { loginId: record.passenger_id },
        });
        if (!passenger) {
          results.errors++;
          continue;
        }

        // Route eligibility check:
        // 1. Direct match: student is assigned to this bus route
        // 2. Merged route: student's assigned route was merged into this bus route today
        let isEligible = !passenger.routeId || String(passenger.routeId) === String(route_id);
        let originalRouteId: string | null = null;
        let mergeEventId: string | null = null;

        if (!isEligible && passenger.routeId) {
          const activeMerge = await this.prisma.mergeEvent.findFirst({
            where: {
              cancelledRouteId: String(passenger.routeId),
              targetRouteId: String(route_id),
              status: 'active',
              createdAt: { gte: todayStart },
            },
          });

          if (activeMerge) {
            isEligible = true;
            originalRouteId = String(passenger.routeId);
            mergeEventId = activeMerge.id;
          }
        }

        if (!isEligible) {
          console.warn(
            `Student ${passenger.loginId} (assigned: ${passenger.routeId}) is not eligible on route ${route_id}`,
          );
          results.errors++;
          continue;
        }

        await this.prisma.attendance.create({
          data: {
            passengerId: passenger.loginId,
            routeId: route_id,
            originalRouteId,
            mergeEventId,
            name: passenger.name,
            feeStatus: passenger.feeStatus,
            confidence: record.confidence || undefined,
            timestamp: record.timestamp
              ? new Date(record.timestamp)
              : new Date(),
          },
        });

        results.synced++;

        // Emit event for real-time gateway (to be handled in Gateway module)
        this.eventEmitter.emit('attendance.marked', {
          passenger_id: passenger.loginId,
          name: passenger.name,
          route_id: route_id,
          original_route_id: originalRouteId,
          is_merged: !!originalRouteId,
          fee_status: passenger.feeStatus,
        });
      } catch (err) {
        console.error(
          `Error syncing attendance for ${record.passenger_id}:`,
          err,
        );
        results.errors++;
      }
    }

    return {
      status: 'success',
      ...results,
    };
  }

  async getAllAttendanceToday() {
    const todayStart = getISTMidnightUTC();
    return this.prisma.attendance.findMany({
      where: {
        timestamp: { gte: todayStart },
      },
      orderBy: { timestamp: 'desc' },
    });
  }

  async getAttendanceForRoute(routeId: string) {
    const todayStart = getISTMidnightUTC();
    return this.prisma.attendance.findMany({
      where: {
        routeId,
        timestamp: { gte: todayStart },
      },
      orderBy: { timestamp: 'desc' },
    });
  }

  async getAttendanceForUser(loginId: string) {
    return this.prisma.attendance.findMany({
      where: {
        passengerId: loginId,
      },
      orderBy: { timestamp: 'desc' },
      take: 30,
    });
  }
}
