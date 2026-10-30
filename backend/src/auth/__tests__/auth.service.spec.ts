import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from '../auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto } from '../dto/login.dto';
import { UserRole } from '@prisma/client';

// Mock bcrypt
jest.mock('bcrypt');
jest.mock('crypto', () => ({
  randomBytes: jest.fn(() => Buffer.from('mock-refresh-token')),
}));

describe('AuthService', () => {
  let service: AuthService;
  let prisma: jest.Mocked<PrismaService>;
  let jwtService: jest.Mocked<JwtService>;

  const mockUser = {
    id: 'user-1',
    loginId: 'S001',
    name: 'Test Student',
    password: 'hashed-password',
    role: UserRole.passenger,
    routeId: '4',
    feeStatus: 'paid',
    profilePic: null,
    designation: null,
    email: null,
    phone: null,
    subject: null,
    gradeClass: null,
    wakeAlarm: null,
    tokenVersion: 0,
  };

  beforeEach(async () => {
    // Create a mock transaction client that mirrors prisma.user
    const mockTxUser = {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    };

    const mockPrisma = {
      user: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
      $transaction: jest.fn(async (callback) => callback(mockTxUser)),
    };

    const mockJwtService = {
      sign: jest.fn().mockReturnValue('mock-access-token'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get(PrismaService);
    jwtService = module.get(JwtService);

    // Reset mocks
    jest.clearAllMocks();
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
  });

  describe('login', () => {
    const loginDto: LoginDto = {
      login_id: 'S001',
      password: 'password123',
      role: 'passenger',
    };

    it('should successfully login with valid credentials', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue({
        ...mockUser,
        lastLogin: new Date(),
      });

      const result = await service.login(loginDto);

      expect(result.status).toBe('success');
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.refreshTokenExpiresAt).toBeDefined();
      expect(result.user.login_id).toBe('S001');
      expect(result.user.role).toBe(UserRole.passenger);
    });

    it('should throw UnauthorizedException for invalid login ID', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.findMany.mockResolvedValue([]);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for invalid password', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for role mismatch', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        role: UserRole.passenger,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(
        service.login({ ...loginDto, role: 'admin' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw ConflictException for duplicate phone numbers', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.findMany.mockResolvedValue([
        { ...mockUser, loginId: 'S002' },
        { ...mockUser, loginId: 'S003' },
      ]);

      await expect(service.login(loginDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('generateAndStoreRefreshToken', () => {
    it('should generate and store a refresh token', async () => {
      prisma.user.update.mockResolvedValue({});

      const result = await service['generateAndStoreRefreshToken']('user-1');

      expect(result.token).toBeDefined();
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(prisma.user.update).toHaveBeenCalled();
    });
  });

  describe('verifyAndRotateRefreshToken', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-refresh-token');
    });

    it('should verify and rotate a valid refresh token', async () => {
      const mockTxUser = {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-1',
          refreshToken: 'hashed-refresh-token',
          refreshTokenExpiresAt: new Date(Date.now() + 86400000),
          loginId: 'S001',
          name: 'Test Student',
          role: UserRole.passenger,
          routeId: '4',
        }),
        update: jest.fn().mockResolvedValue({}),
      };
      const mockTx = { user: mockTxUser };

      prisma.$transaction.mockImplementationOnce(async (callback) =>
        callback(mockTx),
      );

      const result = await service.verifyAndRotateRefreshToken(
        'user-1',
        'valid-refresh-token',
      );

      expect(result).toBeDefined();
      expect(result?.accessToken).toBeDefined();
      expect(result?.refreshToken).toBeDefined();
      expect(result?.refreshTokenExpiresAt).toBeInstanceOf(Date);
      expect(mockTxUser.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        select: expect.any(Object),
      });
      expect(mockTxUser.update).toHaveBeenCalled();
    });

    it('should return null for expired refresh token', async () => {
      const mockTxUser = {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-1',
          refreshToken: 'hashed-refresh-token',
          refreshTokenExpiresAt: new Date(Date.now() - 86400000), // Expired
        }),
        update: jest.fn(),
      };
      const mockTx = { user: mockTxUser };

      prisma.$transaction.mockImplementationOnce(async (callback) =>
        callback(mockTx),
      );

      const result = await service.verifyAndRotateRefreshToken(
        'user-1',
        'expired-token',
      );

      expect(result).toBeNull();
    });

    it('should return null for invalid refresh token', async () => {
      const mockTxUser = {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-1',
          refreshToken: 'hashed-refresh-token',
          refreshTokenExpiresAt: new Date(Date.now() + 86400000),
        }),
        update: jest.fn(),
      };
      const mockTx = { user: mockTxUser };

      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      prisma.$transaction.mockImplementationOnce(async (callback) =>
        callback(mockTx),
      );

      const result = await service.verifyAndRotateRefreshToken(
        'user-1',
        'invalid-token',
      );

      expect(result).toBeNull();
    });
  });

  describe('revokeRefreshToken', () => {
    it('should revoke refresh token and increment tokenVersion', async () => {
      prisma.user.update.mockResolvedValue({});

      await service.revokeRefreshToken('user-1');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          refreshToken: null,
          refreshTokenExpiresAt: null,
          tokenVersion: { increment: 1 },
        },
      });
    });
  });

  describe('generateAccessToken', () => {
    it('should generate an access token with correct payload', () => {
      const token = service.generateAccessToken({
        login_id: 'S001',
        name: 'Test Student',
        role: UserRole.passenger,
        route_id: '4',
      });

      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          login_id: 'S001',
          role: UserRole.passenger,
          name: 'Test Student',
          route_id: '4',
          tokenVersion: 0,
        }),
        { expiresIn: process.env.JWT_EXPIRES_IN || '24h' },
      );
    });
  });
});
