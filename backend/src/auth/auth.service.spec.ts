import { ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

jest.mock('bcrypt', () => ({ compare: jest.fn() }));
import * as bcrypt from 'bcrypt';

describe('AuthService phone fallback', () => {
  let prisma: any;
  let service: AuthService;

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn(),
      },
    };
    service = new AuthService(
      prisma as PrismaService,
      {
        sign: jest.fn(),
      } as unknown as JwtService,
    );
  });

  it('rejects phone login when multiple accounts match', async () => {
    prisma.user.findMany.mockResolvedValue([
      { loginId: 'student-1' },
      { loginId: 'parent-1' },
    ]);

    await expect(
      service.login({ login_id: '5551234', password: 'secret' } as any),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(bcrypt.compare).not.toHaveBeenCalled();
  });

  it('uses the only matching phone account', async () => {
    prisma.user.findMany.mockResolvedValue([
      {
        id: 'user-1',
        loginId: 'student-1',
        name: 'Student',
        password: 'hash',
        role: 'passenger',
        routeId: null,
        feeStatus: 'paid',
        profilePic: null,
        designation: null,
        phone: '5551234',
        email: null,
        subject: null,
        gradeClass: null,
        locationLat: null,
        locationLng: null,
        wakeAlarm: null,
      },
    ]);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    prisma.user.update = jest.fn();
    const sign = jest.fn().mockReturnValue('token');
    service = new AuthService(prisma as PrismaService, { sign } as any);

    const result = await service.login({
      login_id: '5551234',
      password: 'secret',
    } as any);

    expect(result.user.login_id).toBe('student-1');
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 2 }),
    );
  });
});
