import { Injectable, BadRequestException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LeavesService {
  constructor(private prisma: PrismaService) {}

  async markLeave(loginId: string, dateStr: string) {
    const user = await this.prisma.user.findUnique({ where: { loginId } });
    if (!user || user.role !== UserRole.passenger) {
      throw new BadRequestException('Only passengers can mark leaves');
    }

    try {
      await this.prisma.leave.create({
        data: {
          loginId,
          date: new Date(dateStr),
        },
      });
      return { status: 'success', message: 'Leave marked' };
    } catch (error: any) {
      // Prisma unique constraint violation code is P2002
      if (error.code === 'P2002') {
        return {
          status: 'success',
          message: 'Leave already marked for this date',
        };
      }
      throw error;
    }
  }

  async cancelLeave(loginId: string, dateStr: string) {
    await this.prisma.leave.deleteMany({
      where: {
        loginId,
        date: new Date(dateStr),
      },
    });
    return { status: 'success', message: 'Leave cancelled' };
  }
}
