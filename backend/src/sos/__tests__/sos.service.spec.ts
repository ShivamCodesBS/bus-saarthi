import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { SosService } from '../sos.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../cache/cache.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('SosService', () => {
  let service: SosService;
  let prisma: jest.Mocked<PrismaService>;
  let cache: jest.Mocked<CacheService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  const mockUser = {
    id: 'user-1',
    loginId: 'S001',
    name: 'Test Student',
    routeId: '4',
  };

  beforeEach(async () => {
    const mockPrisma = {
      user: {
        findUnique: jest.fn(),
      },
      sosAlert: {
        create: jest.fn(),
        deleteMany: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
    };

    const mockCache = {
      setIfNotExists: jest.fn(),
      del: jest.fn(),
      isAvailable: true, // Cache is available by default for most tests
    };

    const mockEventEmitter = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SosService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CacheService, useValue: mockCache },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get<SosService>(SosService);
    prisma = module.get(PrismaService);
    cache = module.get(CacheService);
    eventEmitter = module.get(EventEmitter2);

    jest.clearAllMocks();
  });

  describe('trigger', () => {
    it('should create SOS alert and emit event', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        loginId: 'S001',
        name: 'Test Student',
        routeId: '4',
      });

      cache.setIfNotExists.mockResolvedValue(true);
      prisma.sosAlert.create.mockResolvedValue({
        id: 'sos-1',
        loginId: 'S001',
        passenger: 'Test Student',
        route: '4',
      });

      const result = await service.trigger('S001');

      expect(result.status).toBe('success');
      expect(result.data.login_id).toBe('S001');
      expect(result.data.route).toBe('4');
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'sos.triggered',
        expect.any(Object),
      );
    });

    it('should throw BadRequestException when SOS already triggered recently (cache available)', async () => {
      cache.setIfNotExists.mockResolvedValue(false);

      await expect(service.trigger('S001')).rejects.toThrow(
        'SOS alert already triggered recently. Please wait.',
      );
    });

    it('should use in-memory cooldown when cache unavailable', async () => {
      // Create service with unavailable cache
      const mockCacheUnavailable = {
        setIfNotExists: jest.fn(),
        del: jest.fn(),
        isAvailable: false,
      };

      const mockPrisma = {
        user: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'user-1',
            loginId: 'S001',
            name: 'Test Student',
            routeId: '4',
          }),
        },
        sosAlert: {
          create: jest.fn().mockResolvedValue({
            id: 'sos-1',
            loginId: 'S001',
            passenger: 'Test Student',
            route: '4',
          }),
        },
      };

      const mockEventEmitter = { emit: jest.fn() };

      const serviceWithUnavailableCache = new SosService(
        mockPrisma as any,
        mockEventEmitter as any,
        mockCacheUnavailable as any,
      );

      // First trigger should succeed (sets in-memory cooldown)
      await serviceWithUnavailableCache.trigger('S001');

      // Second trigger within cooldown should fail
      await expect(serviceWithUnavailableCache.trigger('S001')).rejects.toThrow(
        'SOS alert already triggered recently. Please wait.',
      );
    });
  });

  describe('cancel', () => {
    it('should cancel SOS alert and emit event with audit info', async () => {
      prisma.sosAlert.deleteMany.mockResolvedValue({ count: 1 });
      prisma.user.findUnique.mockResolvedValue({ routeId: '4' });

      const result = await service.cancel('S001', 'admin-1');

      expect(result.status).toBe('success');
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'sos.cancelled',
        expect.objectContaining({
          login_id: 'S001',
          cancelled_by: 'admin-1',
        }),
      );
    });

    it('should cancel without cancelledBy when called by passenger', async () => {
      prisma.sosAlert.deleteMany.mockResolvedValue({ count: 1 });
      prisma.user.findUnique.mockResolvedValue({ routeId: '4' });

      const result = await service.cancel('S001');

      expect(result.status).toBe('success');
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'sos.cancelled',
        expect.objectContaining({
          cancelled_by: 'S001', // Should default to the user's own loginId
        }),
      );
    });
  });

  describe('getActiveAlerts', () => {
    it('should return active alerts from last 12 hours', async () => {
      const mockAlerts = [
        {
          id: '1',
          loginId: 'S001',
          passenger: 'Student 1',
          route: '4',
          time: new Date(),
        },
        {
          id: '2',
          loginId: 'S002',
          passenger: 'Student 2',
          route: '4',
          time: new Date(),
        },
      ];

      prisma.sosAlert.findMany.mockResolvedValue(mockAlerts);

      const result = await service.getActiveAlerts();

      expect(result.status).toBe('success');
      expect(result.data).toHaveLength(2);
    });
  });

  describe('getMyStatus', () => {
    it('should return active alert for user', async () => {
      const mockAlert = {
        id: '1',
        loginId: 'S001',
        passenger: 'Student 1',
        route: '4',
        time: new Date(),
      };
      prisma.sosAlert.findFirst.mockResolvedValue(mockAlert);

      const result = await service.getMyStatus('S001');

      expect(result.status).toBe('success');
      expect(result.active).toBe(true);
      expect(result.alert).toBeDefined();
    });

    it('should return no active alert when none exists', async () => {
      prisma.sosAlert.findFirst.mockResolvedValue(null);

      const result = await service.getMyStatus('S001');

      expect(result.status).toBe('success');
      expect(result.active).toBe(false);
      expect(result.alert).toBeNull();
    });
  });
});
