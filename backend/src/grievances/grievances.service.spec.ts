import { ForbiddenException } from '@nestjs/common';
import { GrievanceStatus, UserRole } from '@prisma/client';
import { GrievancesService } from './grievances.service';

describe('GrievancesService parent confirmation access', () => {
  const grievance = {
    id: 'grievance-1',
    loginId: 'student-1',
    status: GrievanceStatus.resolved,
    priority: 0,
    resolutionNote: null,
  };
  let prisma: any;
  let cache: any;
  let service: GrievancesService;

  beforeEach(() => {
    prisma = {
      grievance: {
        findUnique: jest.fn().mockResolvedValue(grievance),
        update: jest.fn().mockResolvedValue({
          ...grievance,
          status: GrievanceStatus.closed,
        }),
      },
      parentChildLink: { findUnique: jest.fn() },
      user: { findMany: jest.fn().mockResolvedValue([]) },
    };
    cache = { delByPattern: jest.fn() };
    const notifications = { notifyUser: jest.fn() } as any;
    const eventEmitter = { emit: jest.fn() } as any;
    service = new GrievancesService(prisma, notifications, cache, eventEmitter);
  });

  it.each(['confirm', 'reopen'] as const)(
    'allows the linked parent to %s the child reporter grievance',
    async (action) => {
      prisma.parentChildLink.findUnique.mockResolvedValue({
        parentLoginId: 'parent-1',
      });
      if (action === 'reopen') {
        prisma.grievance.update.mockResolvedValue({
          ...grievance,
          status: GrievanceStatus.reopened,
        });
      }

      if (action === 'confirm') {
        await service.confirmResolved('grievance-1', 'parent-1');
      } else {
        await service.reopen('grievance-1', 'parent-1');
      }

      expect(prisma.parentChildLink.findUnique).toHaveBeenCalledWith({
        where: {
          parentLoginId_childLoginId: {
            parentLoginId: 'parent-1',
            childLoginId: 'student-1',
          },
        },
      });
    },
  );

  it.each(['confirm', 'reopen'] as const)(
    'rejects an unlinked user attempting to %s the grievance',
    async (action) => {
      prisma.parentChildLink.findUnique.mockResolvedValue(null);
      const attempt =
        action === 'confirm'
          ? service.confirmResolved('grievance-1', 'unrelated-user')
          : service.reopen('grievance-1', 'unrelated-user');

      await expect(attempt).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.grievance.update).not.toHaveBeenCalled();
    },
  );
});
