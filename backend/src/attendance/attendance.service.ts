import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { SyncAttendanceDto } from './dto/sync-attendance.dto';
import { PrismaService } from '../prisma/prisma.service';
import { getISTMidnightUTC } from '../common/utils/ist-date.util';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
    private notificationsService: NotificationsService,
  ) {}

  async syncAttendance(syncDto: SyncAttendanceDto) {
    let route_id = syncDto.route_id;
    let records = syncDto.records;

    // Support nested payload: { type: 'attendance', data: { ... } }
    if (syncDto.data && typeof syncDto.data === 'object') {
      route_id = route_id || syncDto.data.route_id;
      records = [syncDto.data];
    }
    // Support flat single record: { route_id: '4', passenger_id: '...', ... }
    else if (!records || records.length === 0) {
      if (syncDto.passenger_id || syncDto.login_id || syncDto.student_id) {
        records = [syncDto as any];
      }
    }

    if (!records || records.length === 0) {
      throw new BadRequestException('No records to sync');
    }

    if (!route_id) {
      route_id = records[0]?.route_id || (records[0] as any)?.routeId || '4';
    }

    const todayStart = getISTMidnightUTC();
    const results = { synced: 0, skipped: 0, errors: 0 };

    for (const record of records) {
      const passengerId =
        record.passenger_id ||
        (record as any).login_id ||
        (record as any).student_id;

      if (!passengerId) {
        results.errors++;
        continue;
      }

      try {
        // Prevent duplicate check for today
        const existing = await this.prisma.attendance.findFirst({
          where: {
            passengerId: passengerId,
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
          where: { loginId: passengerId },
        });
        if (!passenger) {
          this.logger.warn(`Passenger not found in database: ${passengerId}`);
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
          this.logger.warn(
            `Student ${passenger.loginId} (assigned: ${passenger.routeId}) is not eligible on route ${route_id}`,
          );
          results.errors++;
          continue;
        }

        const rawTimestamp =
          record.timestamp ||
          (record as any).check_in_time ||
          (record as any).checkInTime;

        const timestamp = rawTimestamp ? new Date(rawTimestamp) : new Date();
        const confidence =
          record.confidence ?? (record as any).match_score ?? undefined;

        await this.prisma.attendance.create({
          data: {
            passengerId: passenger.loginId,
            routeId: String(route_id),
            originalRouteId,
            mergeEventId,
            name: passenger.name,
            feeStatus: passenger.feeStatus,
            confidence: confidence,
            timestamp: timestamp,
          },
        });

        results.synced++;

        const attendancePayload = {
          passenger_id: passenger.loginId,
          name: passenger.name,
          route_id: String(route_id),
          original_route_id: originalRouteId,
          is_merged: !!originalRouteId,
          fee_status: passenger.feeStatus,
          timestamp: timestamp.toISOString(),
        };

        // Emit event for real-time gateway (Admin & Route subscribers)
        this.eventEmitter.emit('attendance.marked', attendancePayload);

        // Notify linked parents asynchronously
        this.notifyParentsOfBoarding(passenger, String(route_id), timestamp).catch(
          (err) => this.logger.error(`Failed to notify parent: ${err.message}`),
        );
      } catch (err) {
        this.logger.error(
          `Error syncing attendance for ${passengerId}:`,
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

  private async notifyParentsOfBoarding(
    student: { loginId: string; name: string },
    routeId: string,
    timestamp: Date,
  ) {
    try {
      const links = await this.prisma.parentChildLink.findMany({
        where: { childLoginId: student.loginId },
      });

      const formattedTime = timestamp.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });

      for (const link of links) {
        await this.notificationsService.sendPushNotification(link.parentLoginId, {
          title: '🚌 Bus Boarded!',
          body: `${student.name} has boarded Bus (Route ${routeId}) at ${formattedTime}.`,
          icon: '/icons/bus-192x192.png',
          badge: '/icons/bus-72x72.png',
          tag: `boarding-${student.loginId}`,
        });
      }
    } catch (e) {
      this.logger.error('Error notifying parent of boarding:', e);
    }
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
        routeId: String(routeId),
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
