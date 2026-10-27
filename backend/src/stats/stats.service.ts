import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { getISTMidnightUTC } from '../common/utils/ist-date.util';

@Injectable()
export class StatsService {
  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
  ) {}

  /**
   * Headline counts for the staff dashboards (and the Flutter admin
   * screen, which polls this). Cached for 15 seconds so rapid
   * dashboard polls don't each run seven COUNT queries.
   */
  async getAdminStats() {
    return this.cache.remember('stats:admin', 15, async () => {
      const todayStart = getISTMidnightUTC();

      const [
        totalRoutes,
        totalStudents,
        totalTeachers,
        totalDrivers,
        markedToday,
        pendingGrievances,
        activeMerges,
      ] = await Promise.all([
        this.prisma.route.count(),
        this.prisma.user.count({ where: { role: 'passenger' } }),
        this.prisma.user.count({ where: { role: 'teacher' } }),
        this.prisma.user.count({ where: { role: 'driver' } }),
        this.prisma.attendance.count({
          where: { timestamp: { gte: todayStart } },
        }),
        this.prisma.grievance.count({
          where: { status: { in: ['pending', 'in_progress', 'reopened'] } },
        }),
        this.prisma.mergeEvent.count({
          where: { status: 'active', createdAt: { gte: todayStart } },
        }),
      ]);

      return {
        status: 'success',
        data: {
          totalRoutes,
          totalStudents,
          totalTeachers,
          totalDrivers,
          markedToday,
          pendingGrievances,
          activeMerges,
        },
      };
    });
  }
}
