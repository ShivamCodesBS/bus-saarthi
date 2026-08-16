import { Injectable, NotFoundException } from '@nestjs/common';
import { GrievanceStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GrievancesService {
  constructor(private prisma: PrismaService) {}

  async create(
    loginId: string,
    text: string,
    type?: string,
    mediaUrl?: string,
    category?: string,
    realName?: string,
  ) {
    // Fetch the user's actual route from DB instead of hardcoding '4'
    const user = await this.prisma.user.findUnique({
      where: { loginId },
      select: { routeId: true, name: true },
    });

    const routeId = user?.routeId ?? 'unknown';
    const resolvedName = realName || user?.name || 'Anonymous';

    await this.prisma.grievance.create({
      data: {
        loginId,
        route: routeId,
        text,
        type,
        mediaUrl,
        category,
        realName: resolvedName,
      },
    });
    return { status: 'success', message: 'Grievance submitted successfully' };
  }

  async findAll(loginId?: string) {
    const grievances = await this.prisma.grievance.findMany({
      orderBy: { createdAt: 'desc' },
    });
    if (!loginId) return grievances;

    const upvotes = await this.prisma.grievanceUpvote.findMany({
      where: { loginId },
      select: { grievanceId: true },
    });

    const upvotedIds = new Set(upvotes.map((u) => u.grievanceId));

    return grievances.map((g) => ({
      ...g,
      hasUpvotedLocally: upvotedIds.has(g.id),
    }));
  }

  async upvote(id: string, loginId: string) {
    const grievance = await this.prisma.grievance.findUnique({ where: { id } });
    if (!grievance) throw new NotFoundException('Grievance not found');

    const existingUpvote = await this.prisma.grievanceUpvote.findUnique({
      where: {
        grievanceId_loginId: {
          grievanceId: id,
          loginId,
        },
      },
    });

    let newUpvotes = grievance.upvotes;

    if (existingUpvote) {
      // Remove upvote
      await this.prisma.grievanceUpvote.delete({
        where: {
          grievanceId_loginId: {
            grievanceId: id,
            loginId,
          },
        },
      });
      newUpvotes -= 1;
    } else {
      // Add upvote
      await this.prisma.grievanceUpvote.create({
        data: { grievanceId: id, loginId },
      });
      newUpvotes += 1;
    }

    await this.prisma.grievance.update({
      where: { id },
      data: { upvotes: newUpvotes },
    });

    return { status: 'success', upvotes: newUpvotes };
  }

  async resolve(id: string) {
    const grievance = await this.prisma.grievance.findUnique({ where: { id } });
    if (!grievance) throw new NotFoundException('Grievance not found');

    await this.prisma.grievance.update({
      where: { id },
      data: { status: GrievanceStatus.resolved },
    });
    return { status: 'success' };
  }

  async remove(id: string) {
    const grievance = await this.prisma.grievance.findUnique({ where: { id } });
    if (!grievance) throw new NotFoundException('Grievance not found');
    await this.prisma.grievance.delete({ where: { id } });
    return { status: 'success', message: 'Grievance deleted' };
  }
}
