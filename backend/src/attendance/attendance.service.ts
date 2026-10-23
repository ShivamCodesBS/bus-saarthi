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
      route_id =
        records[0]?.route_id ||
        (records[0] as any)?.routeId ||
        (records[0] as any)?.route ||
        null;
    }

    if (!route_id) {
      throw new BadRequestException(
        'route_id is required — it identifies the route the bus is serving',
      );
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
    const records = await this.prisma.attendance.findMany({
      where: {
        timestamp: { gte: todayStart },
      },
      orderBy: { timestamp: 'desc' },
      include: {
        passenger: {
          select: {
            name: true,
            feeStatus: true,
            routeId: true,
          },
        },
      },
    });

    return records.map((r) => {
      const resolvedName = r.name || r.passenger?.name || r.passengerId;
      const resolvedRoute = r.routeId || r.passenger?.routeId || '1';
      return {
        id: r.id,
        passengerId: r.passengerId,
        passenger_id: r.passengerId,
        routeId: resolvedRoute,
        route_id: resolvedRoute,
        name: resolvedName,
        passenger_name: resolvedName,
        feeStatus: r.feeStatus || r.passenger?.feeStatus,
        fee_status: r.feeStatus || r.passenger?.feeStatus,
        confidence: r.confidence,
        timestamp: r.timestamp,
        originalRouteId: r.originalRouteId,
        original_route_id: r.originalRouteId,
        mergeEventId: r.mergeEventId,
      };
    });
  }

  async getAttendanceForRoute(routeId: string) {
    const todayStart = getISTMidnightUTC();
    const records = await this.prisma.attendance.findMany({
      where: {
        routeId: String(routeId),
        timestamp: { gte: todayStart },
      },
      orderBy: { timestamp: 'desc' },
      include: {
        passenger: {
          select: {
            name: true,
            feeStatus: true,
            routeId: true,
          },
        },
      },
    });

    return records.map((r) => {
      const resolvedName = r.name || r.passenger?.name || r.passengerId;
      return {
        ...r,
        passengerId: r.passengerId,
        passenger_id: r.passengerId,
        routeId: r.routeId,
        route_id: r.routeId,
        name: resolvedName,
        passenger_name: resolvedName,
        feeStatus: r.feeStatus || r.passenger?.feeStatus,
        fee_status: r.feeStatus || r.passenger?.feeStatus,
      };
    });
  }

  async getAttendanceForUser(loginId: string) {
    const records = await this.prisma.attendance.findMany({
      where: {
        passengerId: loginId,
      },
      orderBy: { timestamp: 'desc' },
      take: 30,
      include: {
        passenger: {
          select: {
            name: true,
            feeStatus: true,
            routeId: true,
          },
        },
      },
    });

    return records.map((r) => {
      const resolvedName = r.name || r.passenger?.name || r.passengerId;
      return {
        ...r,
        passengerId: r.passengerId,
        passenger_id: r.passengerId,
        routeId: r.routeId,
        route_id: r.routeId,
        name: resolvedName,
        passenger_name: resolvedName,
        feeStatus: r.feeStatus || r.passenger?.feeStatus,
        fee_status: r.feeStatus || r.passenger?.feeStatus,
      };
    });
  }

  /**
   * A per-day attendance summary for the profile page.
   *
   * The raw attendance rows are one-per-boarding; the profile needs "was
   * this student on the bus on each of the last N days", with the day
   * labelled. The IST day boundary is used so the day rolls over at the
   * campus day change, not at UTC midnight.
   */
  async getAttendanceSummary(loginId: string, days = 7) {
    const end = new Date();
    const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);

    const records = await this.prisma.attendance.findMany({
      where: { passengerId: loginId, timestamp: { gte: start } },
      orderBy: { timestamp: 'desc' },
    });

    // Group the records by calendar day (in the campus timezone).
    const byDay = new Map<string, any>();
    for (const r of records) {
      const key = this.dayKey(r.timestamp);
      if (!byDay.has(key)) {
        byDay.set(key, {
          date: key,
          present: true,
          count: 0,
          firstIn: r.timestamp,
          lastOut: r.timestamp,
          routeId: r.routeId,
          confidence: r.confidence,
        });
      }
      const day = byDay.get(key);
      day.count += 1;
      if (r.timestamp < day.firstIn) day.firstIn = r.timestamp;
      if (r.timestamp > day.lastOut) day.lastOut = r.timestamp;
      if (r.confidence != null) day.confidence = r.confidence;
    }

    // Build a continuous list of the last N days, marking the ones with no
    // record as absent.
    const summary: any[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(end.getTime() - i * 24 * 60 * 60 * 1000);
      const key = this.dayKey(d);
      const found = byDay.get(key);
      summary.push(
        found || {
          date: key,
          present: false,
          count: 0,
          firstIn: null,
          lastOut: null,
          routeId: null,
          confidence: null,
        },
      );
    }

    const presentDays = summary.filter((d) => d.present).length;

    return {
      status: 'success',
      data: {
        days: summary,
        presentDays,
        totalDays: days,
        attendancePercent: Math.round((presentDays / days) * 100),
        totalRecords: records.length,
      },
    };
  }

  /** A YYYY-MM-DD key in the campus timezone. */
  private dayKey(date: Date): string {
    // IST is UTC+5:30.
    const ist = new Date(date.getTime() + 330 * 60000);
    return ist.toISOString().slice(0, 10);
  }
}
