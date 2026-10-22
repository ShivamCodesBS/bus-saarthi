import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { UserRole, FeeStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { getISTMidnightUTC } from '../common/utils/ist-date.util';

@Injectable()
export class ParentsService {
  constructor(private prisma: PrismaService) {}

  async createParentAndLink(
    childLoginId: string,
    parentName: string,
    parentPhone: string,
    parentPassword: string,
    nickname?: string,
  ) {
    const child = await this.prisma.user.findUnique({
      where: { loginId: childLoginId },
      select: { loginId: true, name: true, role: true },
    });
    if (!child) {
      throw new NotFoundException(`Student ${childLoginId} not found`);
    }
    if (child.role !== UserRole.passenger) {
      throw new BadRequestException(
        'Only a student account can have a parent linked to it',
      );
    }

    // A parent account is keyed on the phone number, so one parent can be
    // linked to several children (siblings) without creating duplicates.
    const parentLoginId = await this.resolveParentLoginId(
      parentPhone,
      childLoginId,
    );

    let parentUser = await this.prisma.user.findUnique({
      where: { loginId: parentLoginId },
    });

    if (!parentUser) {
      const hashedPassword = await bcrypt.hash(
        parentPassword || 'Invertis@123',
        10,
      );
      parentUser = await this.prisma.user.create({
        data: {
          loginId: parentLoginId,
          name: parentName,
          password: hashedPassword,
          role: UserRole.parent,
          phone: parentPhone,
        },
      });
    } else if (parentUser.role !== UserRole.parent) {
      throw new BadRequestException(
        `Account ${parentLoginId} exists but is not a parent account`,
      );
    }

    const existingLink = await this.prisma.parentChildLink.findUnique({
      where: {
        parentLoginId_childLoginId: {
          parentLoginId,
          childLoginId,
        },
      },
    });

    if (!existingLink) {
      await this.prisma.parentChildLink.create({
        data: { parentLoginId, childLoginId, nickname },
      });
    }

    return {
      status: 'success',
      parent_login_id: parentLoginId,
      message: `Parent account ${parentLoginId} created and linked to ${childLoginId}`,
    };
  }

  /**
   * Derive a stable parent login id. If a parent with this phone number
   * already exists we reuse that account (so siblings share one login);
   * otherwise we mint `P<digits>`.
   */
  private async resolveParentLoginId(
    parentPhone: string,
    childLoginId: string,
  ): Promise<string> {
    if (parentPhone) {
      const existing = await this.prisma.user.findFirst({
        where: { phone: parentPhone, role: UserRole.parent },
        select: { loginId: true },
      });
      if (existing) return existing.loginId;
    }

    const digits = (parentPhone || childLoginId).replace(/\D/g, '');
    const base = digits ? `P${digits.slice(-6)}` : `P${childLoginId.replace(/^[A-Za-z]/, '')}`;

    // Ensure uniqueness by appending a counter if needed.
    let candidate = base;
    let suffix = 1;
    while (await this.prisma.user.findUnique({ where: { loginId: candidate } })) {
      suffix += 1;
      candidate = `${base}${suffix}`;
    }
    return candidate;
  }

  async getParentWithChildren(parentLoginId: string) {
    const parent = await this.prisma.user.findUnique({
      where: { loginId: parentLoginId },
    });
    if (!parent) throw new NotFoundException('Parent account not found');

    const links = await this.prisma.parentChildLink.findMany({
      where: { parentLoginId },
    });

    const todayStart = getISTMidnightUTC();

    // One query for all children instead of one per child.
    const children = await this.prisma.user.findMany({
      where: { loginId: { in: links.map((l) => l.childLoginId) } },
      select: {
        loginId: true,
        name: true,
        gradeClass: true,
        routeId: true,
        feeStatus: true,
        profilePic: true,
      },
    });

    // One query for today's attendance of all children.
    const attendance = await this.prisma.attendance.findMany({
      where: {
        passengerId: { in: children.map((c) => c.loginId) },
        timestamp: { gte: todayStart },
      },
      select: { passengerId: true, timestamp: true },
    });
    const boardedMap = new Map(
      attendance.map((a) => [a.passengerId, a.timestamp]),
    );

    const linkByChild = new Map(links.map((l) => [l.childLoginId, l]));

    return {
      parent: {
        loginId: parent.loginId,
        name: parent.name,
        phone: parent.phone,
        email: parent.email,
        profilePic: parent.profilePic,
      },
      children: children.map((child) => ({
        loginId: child.loginId,
        name: child.name,
        gradeClass: child.gradeClass,
        routeId: child.routeId,
        feeStatus: child.feeStatus,
        profilePic: child.profilePic,
        nickname: linkByChild.get(child.loginId)?.nickname ?? null,
        boardedToday: boardedMap.has(child.loginId),
        boardedAt: boardedMap.get(child.loginId) ?? null,
      })),
    };
  }

  /**
   * All grievances raised by any of this parent's children.
   *
   * This is what lets a parent follow up on their child's complaints, see
   * whether the transport team has fixed them, and confirm or reject a fix.
   */
  async getChildGrievances(parentLoginId: string) {
    const links = await this.prisma.parentChildLink.findMany({
      where: { parentLoginId },
      select: { childLoginId: true, nickname: true },
    });
    const childIds = links.map((l) => l.childLoginId);
    if (childIds.length === 0) return [];

    const grievances = await this.prisma.grievance.findMany({
      where: { loginId: { in: childIds } },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });

    const nicknameByChild = new Map(links.map((l) => [l.childLoginId, l.nickname]));

    return grievances.map((g) => ({
      id: g.id,
      loginId: g.loginId,
      childName: nicknameByChild.get(g.loginId) ?? g.loginId,
      route: g.route,
      busNumber: g.busNumber,
      text: g.text,
      type: g.type,
      mediaUrl: g.mediaUrl,
      category: g.category,
      status: g.status,
      upvotes: g.upvotes,
      adminResponse: g.adminResponse,
      resolutionNote: g.resolutionNote,
      createdAt: g.createdAt,
      resolvedAt: g.resolvedAt,
      confirmedAt: g.confirmedAt,
      dueAt: g.dueAt,
      reopenCount: g.reopenCount,
      priority: g.priority,
    }));
  }

  async getChildGrievancesFor(
    parentLoginId: string,
    childLoginId: string,
  ) {
    await this.verifyParentChildLink(parentLoginId, childLoginId);
    const all = await this.getChildGrievances(parentLoginId);
    return all.filter((g) => g.loginId === childLoginId);
  }

  async getChildAttendance(parentLoginId: string, childLoginId: string) {
    await this.verifyParentChildLink(parentLoginId, childLoginId);

    const records = await this.prisma.attendance.findMany({
      where: { passengerId: childLoginId },
      orderBy: { timestamp: 'desc' },
      take: 60,
    });

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthRecords = records.filter(
      (r) => new Date(r.timestamp) >= monthStart,
    );

    const daysInMonth = now.getDate();
    let workingDays = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const day = new Date(now.getFullYear(), now.getMonth(), d).getDay();
      if (day !== 0) workingDays++;
    }

    return {
      records,
      monthlyAttendance: monthRecords.length,
      workingDays,
      attendancePercent:
        workingDays > 0
          ? Math.round((monthRecords.length / workingDays) * 100)
          : 0,
    };
  }

  async getChildTodayStatus(parentLoginId: string, childLoginId: string) {
    await this.verifyParentChildLink(parentLoginId, childLoginId);

    // Use the IST day boundary, otherwise "today" rolls over at the wrong hour.
    const todayStart = getISTMidnightUTC();

    const record = await this.prisma.attendance.findFirst({
      where: {
        passengerId: childLoginId,
        timestamp: { gte: todayStart },
      },
      orderBy: { timestamp: 'desc' },
    });

    const child = await this.prisma.user.findUnique({
      where: { loginId: childLoginId },
      select: {
        name: true,
        routeId: true,
        feeStatus: true,
        gradeClass: true,
      },
    });

    // Resolve the live bus for the child's route — the bus can change, the
    // route cannot.
    let busNumber: string | null = null;
    let routeName: string | null = null;
    if (child?.routeId) {
      const route = await this.prisma.route.findUnique({
        where: { routeId: child.routeId },
        select: { busNumber: true, routeName: true },
      });
      busNumber = route?.busNumber ?? null;
      routeName = route?.routeName ?? null;
    }

    return {
      boarded: !!record,
      boardedAt: record?.timestamp || null,
      child: {
        name: child?.name,
        routeId: child?.routeId,
        routeName,
        busNumber,
        feeStatus: child?.feeStatus,
        gradeClass: child?.gradeClass,
      },
    };
  }

  async markChildLeave(
    parentLoginId: string,
    childLoginId: string,
    dateStr: string,
  ) {
    await this.verifyParentChildLink(parentLoginId, childLoginId);

    const child = await this.prisma.user.findUnique({
      where: { loginId: childLoginId },
    });
    if (!child || child.role !== UserRole.passenger) {
      throw new BadRequestException('Child not found or not a passenger');
    }

    try {
      await this.prisma.leave.upsert({
        where: {
          loginId_date: {
            loginId: childLoginId,
            date: new Date(dateStr),
          },
        },
        update: {},
        create: {
          loginId: childLoginId,
          date: new Date(dateStr),
        },
      });
    } catch (e: any) {
      // Prisma unique constraint or duplicate handled cleanly
    }

    return {
      status: 'success',
      message: `Leave marked for ${child.name} on ${dateStr}`,
    };
  }

  async verifyParentChildLink(
    parentLoginId: string,
    childLoginId: string,
  ) {
    const link = await this.prisma.parentChildLink.findUnique({
      where: {
        parentLoginId_childLoginId: {
          parentLoginId,
          childLoginId,
        },
      },
    });
    if (!link) {
      throw new NotFoundException('Child not linked to this parent account');
    }
    return link;
  }

  async getAllLinks() {
    return this.prisma.parentChildLink.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }
}
