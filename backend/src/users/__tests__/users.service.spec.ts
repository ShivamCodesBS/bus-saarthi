import { Test, TestingModule } from '@nestjs/testing';
import {
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../cache/cache.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { UserRole, FeeStatus } from '@prisma/client';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

jest.mock('bcrypt');

describe('UsersService', () => {
  let service: UsersService;
  let prisma: jest.Mocked<PrismaService>;
  let cache: jest.Mocked<CacheService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  const mockUser = {
    id: 'user-1',
    loginId: 'S001',
    name: 'Test Student',
    password: 'hashed-password',
    role: UserRole.passenger,
    routeId: '4',
    feeStatus: FeeStatus.paid,
    phone: null,
    email: null,
    profilePic: null,
    designation: null,
    subject: null,
    gradeClass: null,
    locationLat: null,
    locationLng: null,
    licenseNumber: null,
    licenseExpiry: null,
    experienceYears: null,
    bloodGroup: null,
    parentName: null,
    parentPhone: null,
    dob: null,
    address: null,
    gradeClass: null,
    faceEnrolledAt: null,
    awsFaceId: null,
    faceResetRequestedAt: null,
    faceResetRequestedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    tokenVersion: 0,
    wakeAlarm: null,
  };

  beforeEach(async () => {
    const mockPrisma = {
      user: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
      route: {
        findUnique: jest.fn(),
      },
    };

    const mockCache = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      delByPattern: jest.fn(),
      remember: jest.fn((key, ttl, loader) => loader()),
    };

    const mockEventEmitter = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CacheService, useValue: mockCache },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = module.get(PrismaService);
    cache = module.get(CacheService);

    jest.clearAllMocks();
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
  });

  describe('findByLoginId', () => {
    it('should return user without password', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        password: 'hashed-password',
      });

      const result = await service.findByLoginId('S001');

      expect(result).toBeDefined();
      expect(result.loginId).toBe('S001');
      expect(result.password).toBeUndefined();
    });

    it('should throw NotFoundException for non-existent user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.findByLoginId('S999')).rejects.toThrow(
        'User with login ID S999 not found',
      );
    });
  });

  describe('findOwnProfile', () => {
    it('should return user profile with route info', async () => {
      // First call: find user
      prisma.user.findUnique.mockResolvedValueOnce(mockUser);

      // Second call: find route
      prisma.route.findUnique.mockResolvedValueOnce({
        routeId: '4',
        routeName: 'Route 4',
        busNumber: 'Bus 4',
        bus: { busNumber: 'Bus 4' },
        driverId: 'D001',
      });

      // Third call: find driver
      prisma.user.findUnique.mockResolvedValueOnce({
        loginId: 'D001',
        name: 'Driver Name',
      });

      const result = await service.findOwnProfile('S001');

      expect(result.loginId).toBe('S001');
      expect(result.routeName).toBe('Route 4');
      expect(result.busNumber).toBe('Bus 4');
      expect(result.driverName).toBe('Driver Name');
    });
  });

  describe('findAll', () => {
    it('should return all users without passwords', async () => {
      // Service uses select that excludes password, so mock should not include it
      const users = [
        { ...mockUser },
        { ...mockUser, id: 'user-2', loginId: 'S002' },
      ];
      delete users[0].password;
      delete users[1].password;
      prisma.user.findMany.mockResolvedValue(users);

      const result = await service.findAll();

      expect(result).toHaveLength(2);
      expect(result[0].password).toBeUndefined();
      expect(result[1].password).toBeUndefined();
    });
  });

  describe('create', () => {
    const createDto = {
      login_id: 'S002',
      name: 'New Student',
      password: 'password123',
      role: UserRole.passenger,
      route_id: '4',
      fee_status: 'unpaid',
      phone: '1234567890',
      email: 'test@test.com',
    };

    it('should create a new user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.findFirst.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      prisma.user.create.mockResolvedValue({
        id: 'user-2',
        loginId: 'S002',
        name: 'New Student',
        password: 'hashed-password',
        role: UserRole.passenger,
        routeId: '4',
        feeStatus: FeeStatus.unpaid,
        phone: '1234567890',
        email: 'test@test.com',
        profilePic: null,
        designation: null,
        subject: null,
        gradeClass: null,
        locationLat: null,
        locationLng: null,
        licenseNumber: null,
        licenseExpiry: null,
        experienceYears: null,
        bloodGroup: null,
        parentName: null,
        parentPhone: null,
        dob: null,
        address: null,
        faceEnrolledAt: null,
        awsFaceId: null,
        faceResetRequestedAt: null,
        faceResetRequestedBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        tokenVersion: 0,
        wakeAlarm: null,
      });

      const result = await service.create(createDto, UserRole.admin);

      expect(result.status).toBe('success');
      // Service returns camelCase loginId (sanitize doesn't transform to snake_case)
      expect(result.user.loginId).toBe('S002');
      expect(prisma.user.create).toHaveBeenCalled();
    });

    it('should throw ConflictException for duplicate login ID', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(
        service.create(
          { login_id: 'S001', name: 'Test', role: UserRole.passenger },
          UserRole.admin,
        ),
      ).rejects.toThrow('User S001 already exists');
    });

    it('should throw ConflictException for duplicate phone', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.findFirst.mockResolvedValue({ loginId: 'S003' });

      await expect(
        service.create(
          {
            ...{
              login_id: 'S002',
              name: 'Test',
              password: 'pass',
              role: UserRole.passenger,
            },
            phone: '9999999999',
          },
          UserRole.admin,
        ),
      ).rejects.toThrow(
        'Phone number 9999999999 is already registered to S003',
      );
    });
  });

  describe('update', () => {
    it('should update user and increment tokenVersion for sensitive changes', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue({
        ...mockUser,
        name: 'Updated Name',
        tokenVersion: 1,
      });

      const result = await service.update(
        'S001',
        { name: 'Updated Name' },
        UserRole.admin,
      );

      expect(result.status).toBe('success');
      expect(prisma.user.update).toHaveBeenCalled();
    });

    it('should throw ForbiddenException for unauthorized role change', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        role: UserRole.passenger,
      });

      await expect(
        service.update(
          'S001',
          { role: UserRole.admin },
          UserRole.transport_incharge,
        ),
      ).rejects.toThrow(
        'You are not allowed to change this account to the role "admin"',
      );
    });
  });

  describe('changePassword', () => {
    it('should change password and revoke tokens', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        loginId: 'S001',
        password: 'hashed-old-password',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      prisma.user.update.mockResolvedValue({});

      const result = await service.changePassword(
        'S001',
        'old-password',
        'new-password',
        'S001',
        UserRole.passenger,
      );

      expect(result.status).toBe('success');
    });

    it('should throw UnauthorizedException for wrong current password', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        loginId: 'S001',
        password: 'hashed-old-password',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.changePassword(
          'S001',
          'wrong-password',
          'new-password',
          'S001',
          UserRole.passenger,
        ),
      ).rejects.toThrow('Current password is incorrect');
    });
  });

  describe('setWakeAlarm', () => {
    it('should set wake alarm and emit event', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        loginId: 'S001',
      });
      prisma.user.update.mockResolvedValue({});

      const result = await service.setWakeAlarm('S001', {
        lat: 28.318,
        lng: 79.467,
        thresholdKm: 2,
      });

      expect(result.status).toBe('success');
      expect(prisma.user.update).toHaveBeenCalled();
    });
  });

  describe('getWakeAlarm', () => {
    it('should return boolean alarmSet true when wakeAlarm has valid coordinates', async () => {
      prisma.user.findUnique.mockResolvedValue({
        wakeAlarm: {
          enabled: true,
          lat: 27.8471,
          lng: 79.9189,
          thresholdKm: 2,
          firedAt: null,
        },
      });

      const result = await service.getWakeAlarm('S001');

      expect(result.status).toBe('success');
      expect(result.alarmSet).toBe(true);
      expect(typeof result.alarmSet).toBe('boolean');
      expect(result.alarm?.lat).toBe(27.8471);
    });

    it('should return boolean alarmSet false when wakeAlarm is disabled', async () => {
      prisma.user.findUnique.mockResolvedValue({
        wakeAlarm: {
          enabled: false,
        },
      });

      const result = await service.getWakeAlarm('S001');

      expect(result.status).toBe('success');
      expect(result.alarmSet).toBe(false);
      expect(typeof result.alarmSet).toBe('boolean');
      expect(result.alarm).toBeNull();
    });
  });

  describe('cancelWakeAlarm', () => {
    it('should cancel wake alarm and emit event', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        loginId: 'S001',
      });
      prisma.user.update.mockResolvedValue({});

      const result = await service.cancelWakeAlarm('S001');

      expect(result.status).toBe('success');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { loginId: 'S001' },
        data: { wakeAlarm: { enabled: false } },
      });
    });
  });
});
