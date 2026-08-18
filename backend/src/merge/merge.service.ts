import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CreateMergeDto } from './dto/create-merge.dto';
import {
  getISTMidnightUTC,
  getNextISTMidnightUTC,
} from '../common/utils/ist-date.util';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class MergeService {
  private readonly logger = new Logger(MergeService.name);

  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
    private notificationsService: NotificationsService,
  ) {}

  /**
   * Primary flow: TI directly creates & executes a merge.
   * Driver calls TI on phone → TI merges from dashboard.
   */
  async createMerge(dto: CreateMergeDto, initiatedBy: string) {
    // ── Step 1: Validate routes exist ──────────────────────
    const cancelledRoute = await this.prisma.route.findUnique({
      where: { routeId: dto.cancelled_route_id },
    });
    const targetRoute = await this.prisma.route.findUnique({
      where: { routeId: dto.target_route_id },
    });

    if (!cancelledRoute) {
      throw new NotFoundException(
        `Cancelled route ${dto.cancelled_route_id} not found`,
      );
    }
    if (!targetRoute) {
      throw new NotFoundException(
        `Target route ${dto.target_route_id} not found`,
      );
    }

    // Same route check
    if (dto.cancelled_route_id === dto.target_route_id) {
      throw new BadRequestException('Cannot merge a route into itself');
    }

    // Same city check
    if (cancelledRoute.city !== targetRoute.city) {
      throw new BadRequestException(
        `Cannot merge routes from different cities (${cancelledRoute.city} ≠ ${targetRoute.city})`,
      );
    }

    // Already cancelled check
    const existingMerge = await this.findActiveMergeForCancelledRoute(
      dto.cancelled_route_id,
    );
    if (existingMerge) {
      throw new ConflictException(
        `Route ${dto.cancelled_route_id} is already cancelled/merged today`,
      );
    }

    // Check if target route is itself cancelled
    const targetMerge = await this.findActiveMergeForCancelledRoute(
      dto.target_route_id,
    );
    if (targetMerge) {
      throw new BadRequestException(
        `Target route ${dto.target_route_id} is itself cancelled. Choose an active route.`,
      );
    }

    // ── Step 2: Capacity calculation ──────────────────────
    const todayStart = getISTMidnightUTC();

    const cancelledStudentCount = await this.prisma.user.count({
      where: { routeId: dto.cancelled_route_id, role: 'passenger' },
    });

    const targetCurrentAttendance = await this.prisma.attendance.count({
      where: { routeId: dto.target_route_id, timestamp: { gte: todayStart } },
    });

    const targetCapacity = targetRoute.seatingCapacity || 50;
    const projectedTotal = targetCurrentAttendance + cancelledStudentCount;
    const isOverCapacity = projectedTotal > targetCapacity;

    // ── Step 3: Create MergeEvent ─────────────────────────
    const expiresAt = getNextISTMidnightUTC();

    const mergeEvent = await this.prisma.mergeEvent.create({
      data: {
        cancelledRouteId: dto.cancelled_route_id,
        targetRouteId: dto.target_route_id,
        reason: dto.reason || 'low_attendance',
        status: 'active',
        initiatedBy,
        studentsMoved: cancelledStudentCount,
        cancelledBusNumber: cancelledRoute.busNumber,
        targetBusNumber: targetRoute.busNumber,
        cancelledRouteName: cancelledRoute.routeName,
        targetRouteName: targetRoute.routeName,
        notes: dto.notes || null,
        expiresAt,
      },
    });

    this.logger.log(
      `Merge created: ${cancelledRoute.routeName} (${cancelledRoute.busNumber}) → ${targetRoute.routeName} (${targetRoute.busNumber}) | ${cancelledStudentCount} students | by ${initiatedBy}`,
    );

    // ── Step 4: Transfer already-marked attendance ────────
    const transferred = await this.prisma.attendance.updateMany({
      where: {
        routeId: dto.cancelled_route_id,
        timestamp: { gte: todayStart },
      },
      data: {
        originalRouteId: dto.cancelled_route_id,
        routeId: dto.target_route_id,
        mergeEventId: mergeEvent.id,
      },
    });

    this.logger.log(
      `Transferred ${transferred.count} attendance records from ${dto.cancelled_route_id} to ${dto.target_route_id}`,
    );

    // ── Step 5: Emit real-time events ─────────────────────
    this.eventEmitter.emit('merge.executed', {
      mergeEvent,
      cancelledRoute,
      targetRoute,
      cancelledStudentCount,
      isOverCapacity,
      projectedTotal,
      targetCapacity,
    });

    // ── Step 6: Send push notifications ───────────────────
    await this.sendMergeNotifications(
      dto.cancelled_route_id,
      dto.target_route_id,
      cancelledRoute,
      targetRoute,
    );

    // ── Step 7: Auto-broadcast ────────────────────────────
    const reasonText = (dto.reason || 'low_attendance').replace(/_/g, ' ');
    await this.prisma.broadcast.create({
      data: {
        title: '🔀 Bus Merge Notice',
        message: `${cancelledRoute.routeName} (Bus ${cancelledRoute.busNumber}) has been merged into ${targetRoute.routeName} (Bus ${targetRoute.busNumber}) due to ${reasonText}. Affected students please board Bus ${targetRoute.busNumber}.`,
      },
    });

    return {
      status: 'success',
      message: `Merged ${cancelledRoute.routeName} into ${targetRoute.routeName}`,
      data: mergeEvent,
      transferredAttendance: transferred.count,
      warning: isOverCapacity
        ? `⚠️ Target bus may be overcrowded (${projectedTotal}/${targetCapacity})`
        : null,
    };
  }

  /**
   * Undo/reverse a merge — restores everything back to original.
   */
  async undoMerge(mergeId: string, undoneBy: string) {
    const merge = await this.prisma.mergeEvent.findUnique({
      where: { id: mergeId },
    });

    if (!merge) {
      throw new NotFoundException('Merge event not found');
    }
    if (merge.status !== 'active') {
      throw new BadRequestException(
        `Cannot undo merge with status "${merge.status}"`,
      );
    }

    const todayStart = getISTMidnightUTC();

    // 1. Revert attendance records back to original route
    const reverted = await this.prisma.attendance.updateMany({
      where: {
        mergeEventId: mergeId,
        timestamp: { gte: todayStart },
      },
      data: {
        routeId: merge.cancelledRouteId,
        originalRouteId: null,
        mergeEventId: null,
      },
    });

    // 2. Mark merge as undone
    await this.prisma.mergeEvent.update({
      where: { id: mergeId },
      data: { status: 'undone', unmergedAt: new Date() },
    });

    this.logger.log(
      `Merge undone: ${merge.cancelledRouteName} restored | ${reverted.count} records reverted | by ${undoneBy}`,
    );

    // 3. Emit events
    this.eventEmitter.emit('merge.undone', {
      merge,
      undoneBy,
      revertedCount: reverted.count,
    });

    // 4. Broadcast
    await this.prisma.broadcast.create({
      data: {
        title: '↩️ Merge Reversed',
        message: `${merge.cancelledRouteName} (Bus ${merge.cancelledBusNumber}) has been restored. Students on this route, please board your original bus.`,
      },
    });

    return {
      status: 'success',
      message: `Merge undone. ${merge.cancelledRouteName} restored.`,
      revertedRecords: reverted.count,
    };
  }

  /**
   * Get all active merges for today.
   */
  async getActiveMerges() {
    const todayStart = getISTMidnightUTC();
    return this.prisma.mergeEvent.findMany({
      where: {
        status: 'active',
        createdAt: { gte: todayStart },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get merge history with optional date filtering.
   */
  async getMergeHistory(fromDate?: string, toDate?: string) {
    const where: any = {};

    if (fromDate) {
      where.createdAt = { gte: new Date(`${fromDate}T00:00:00+05:30`) };
    }
    if (toDate) {
      where.createdAt = {
        ...where.createdAt,
        lte: new Date(`${toDate}T23:59:59+05:30`),
      };
    }

    return this.prisma.mergeEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  /**
   * Check if a specific route is cancelled today (used by telemetry & attendance).
   */
  async isRouteCancelledToday(routeId: string): Promise<boolean> {
    const todayStart = getISTMidnightUTC();
    const merge = await this.prisma.mergeEvent.findFirst({
      where: {
        cancelledRouteId: routeId,
        status: 'active',
        createdAt: { gte: todayStart },
      },
    });
    return !!merge;
  }

  /**
   * Find an active merge where the given cancelled route is merged into the target route.
   * Used by attendance service to check if a student is eligible to board.
   */
  async findActiveMerge(
    cancelledRouteId: string,
    targetRouteId: string,
  ) {
    const todayStart = getISTMidnightUTC();
    return this.prisma.mergeEvent.findFirst({
      where: {
        cancelledRouteId,
        targetRouteId,
        status: 'active',
        createdAt: { gte: todayStart },
      },
    });
  }

  /**
   * Find an active merge for a cancelled route (regardless of target).
   */
  async findActiveMergeForCancelledRoute(cancelledRouteId: string) {
    const todayStart = getISTMidnightUTC();
    return this.prisma.mergeEvent.findFirst({
      where: {
        cancelledRouteId,
        status: 'active',
        createdAt: { gte: todayStart },
      },
    });
  }

  /**
   * Smart suggestions: find routes with low attendance today.
   */
  async getMergeSuggestions() {
    const todayStart = getISTMidnightUTC();
    const routes = await this.prisma.route.findMany();
    const suggestions: any[] = [];

    for (const route of routes) {
      // Skip already-cancelled routes
      const isCancelled = await this.isRouteCancelledToday(route.routeId);
      if (isCancelled) continue;

      const attendanceCount = await this.prisma.attendance.count({
        where: { routeId: route.routeId, timestamp: { gte: todayStart } },
      });

      const totalStudents = await this.prisma.user.count({
        where: { routeId: route.routeId, role: 'passenger' },
      });

      // Suggest merge if fewer than 5 students have marked attendance
      // and there are students assigned to this route
      if (totalStudents > 0 && attendanceCount < 5) {
        // Find best target: same city, most capacity remaining
        const sameCityRoutes = routes.filter(
          (r) => r.city === route.city && r.routeId !== route.routeId,
        );

        let bestTarget: any = null;
        let maxAvailable = 0;

        for (const target of sameCityRoutes) {
          const targetCancelled = await this.isRouteCancelledToday(
            target.routeId,
          );
          if (targetCancelled) continue;

          const targetAttendance = await this.prisma.attendance.count({
            where: {
              routeId: target.routeId,
              timestamp: { gte: todayStart },
            },
          });
          const available =
            (target.seatingCapacity || 50) - targetAttendance;
          if (available > maxAvailable) {
            maxAvailable = available;
            bestTarget = {
              ...target,
              currentAttendance: targetAttendance,
            };
          }
        }

        if (bestTarget) {
          suggestions.push({
            cancelledRoute: {
              ...route,
              currentAttendance: attendanceCount,
              totalStudents,
            },
            targetRoute: bestTarget,
            availableSeats: maxAvailable,
          });
        }
      }
    }

    return suggestions;
  }

  /**
   * Get merge analytics for a date range.
   */
  async getMergeAnalytics(fromDate: string, toDate: string) {
    const merges = await this.prisma.mergeEvent.findMany({
      where: {
        createdAt: {
          gte: new Date(`${fromDate}T00:00:00+05:30`),
          lte: new Date(`${toDate}T23:59:59+05:30`),
        },
      },
    });

    // Group by cancelled route
    const routeStats: Record<string, any> = {};
    for (const merge of merges) {
      const key = merge.cancelledRouteId;
      if (!routeStats[key]) {
        routeStats[key] = {
          routeId: key,
          routeName: merge.cancelledRouteName,
          busNumber: merge.cancelledBusNumber,
          mergeCount: 0,
          totalStudentsMoved: 0,
          reasons: {},
        };
      }
      routeStats[key].mergeCount++;
      routeStats[key].totalStudentsMoved += merge.studentsMoved;
      const reason = merge.reason || 'other';
      routeStats[key].reasons[reason] =
        (routeStats[key].reasons[reason] || 0) + 1;
    }

    return {
      totalMerges: merges.length,
      dateRange: { from: fromDate, to: toDate },
      routeBreakdown: Object.values(routeStats).sort(
        (a: any, b: any) => b.mergeCount - a.mergeCount,
      ),
    };
  }

  /**
   * Expire all active merges (called by midnight cron job).
   */
  async expireActiveMerges() {
    const result = await this.prisma.mergeEvent.updateMany({
      where: {
        status: 'active',
        expiresAt: { lte: new Date() },
      },
      data: { status: 'expired' },
    });

    if (result.count > 0) {
      this.logger.log(
        `Auto-expired ${result.count} merge events at midnight`,
      );
    }

    return result.count;
  }

  /**
   * Send push notifications to all affected parties.
   */
  private async sendMergeNotifications(
    cancelledRouteId: string,
    targetRouteId: string,
    cancelledRoute: any,
    targetRoute: any,
  ) {
    try {
      // 1. Notify students on cancelled route
      const affectedStudents = await this.prisma.user.findMany({
        where: { routeId: cancelledRouteId, role: 'passenger' },
        select: { loginId: true, name: true },
      });

      for (const student of affectedStudents) {
        await this.notificationsService
          .sendPushNotification(student.loginId, {
            title: '🚌 Bus Change Notice',
            body: `Your bus (${cancelledRoute.routeName}, Bus ${cancelledRoute.busNumber}) is cancelled today. Please board Bus ${targetRoute.busNumber} (${targetRoute.routeName}).`,
            icon: '/icons/bus-192x192.png',
            tag: 'bus-merge',
            requireInteraction: true,
          })
          .catch((err) =>
            this.logger.warn(
              `Push failed for student ${student.loginId}: ${err.message}`,
            ),
          );
      }

      // 2. Notify parents of affected students
      const parentLinks = await this.prisma.parentChildLink.findMany({
        where: {
          childLoginId: {
            in: affectedStudents.map((s) => s.loginId),
          },
        },
      });

      for (const link of parentLinks) {
        await this.notificationsService
          .sendPushNotification(link.parentLoginId, {
            title: '🔔 Bus Change for Your Child',
            body: `Your child's bus has been changed to Bus ${targetRoute.busNumber} (${targetRoute.routeName}) due to low attendance. Track the new bus in the app.`,
            icon: '/icons/bus-192x192.png',
            tag: 'bus-merge-parent',
            requireInteraction: true,
          })
          .catch((err) =>
            this.logger.warn(
              `Push failed for parent ${link.parentLoginId}: ${err.message}`,
            ),
          );
      }

      this.logger.log(
        `Merge notifications sent: ${affectedStudents.length} students, ${parentLinks.length} parents`,
      );
    } catch (err) {
      this.logger.error('Failed to send merge notifications:', err);
    }
  }
}
