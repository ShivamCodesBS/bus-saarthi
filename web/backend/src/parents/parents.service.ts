import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { UserRole, FeeStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

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
    const parentLoginId = `P${childLoginId.replace(/^[A-Za-z]/, '')}`;

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

  async getParentWithChildren(parentLoginId: string) {
    const parent = await this.prisma.user.findUnique({
      where: { loginId: parentLoginId },
    });
    if (!parent) throw new NotFoundException('Parent account not found');

    const links = await this.prisma.parentChildLink.findMany({
      where: { parentLoginId },
    });

    const children = await Promise.all(
      links.map(async (link) => {
        const child = await this.prisma.user.findUnique({
          where: { loginId: link.childLoginId },
        });
        if (!child) return null;

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const todayAttendance = await this.prisma.attendance.findFirst({
          where: {
            passengerId: link.childLoginId,
            timestamp: { gte: todayStart },
          },
        });

        return {
          loginId: child.loginId,
          name: child.name,
          gradeClass: child.gradeClass,
          routeId: child.routeId,
          feeStatus: child.feeStatus,
          profilePic: child.profilePic,
          nickname: link.nickname,
          boardedToday: !!todayAttendance,
          boardedAt: todayAttendance?.timestamp || null,
        };
      }),
    );

    return {
      parent: {
        loginId: parent.loginId,
        name: parent.name,
        phone: parent.phone,
        email: parent.email,
        profilePic: parent.profilePic,
      },
      children: children.filter(Boolean),
    };
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

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const record = await this.prisma.attendance.findFirst({
      where: {
        passengerId: childLoginId,
        timestamp: { gte: todayStart },
      },
    });

    const child = await this.prisma.user.findUnique({
      where: { loginId: childLoginId },
    });

    return {
      boarded: !!record,
      boardedAt: record?.timestamp || null,
      child: {
        name: child?.name,
        routeId: child?.routeId,
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

    return {
      status: 'success',
      message: `Leave marked for ${child.name} on ${dateStr}`,
    };
  }

  private async verifyParentChildLink(
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
