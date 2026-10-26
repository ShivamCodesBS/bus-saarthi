import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { HealthService } from './health/health.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const mockHealthService = {
      check: jest.fn().mockResolvedValue({ status: 'ok' }),
    };

    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: HealthService,
          useValue: mockHealthService,
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return service info', async () => {
      const res = await appController.index();
      expect(res.service).toBe('Bus Saarthi API');
    });
  });
});
