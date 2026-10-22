import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health/health.service';

@Controller()
export class AppController {
  constructor(private readonly healthService: HealthService) {}

  /**
   * The service banner. This used to return the Nest scaffold's
   * "Hello World!" — it now describes the running service and points at the
   * API docs and the health endpoint.
   */
  @Get()
  async index() {
    const health = await this.healthService.check();
    return {
      service: 'Bus Saarthi API',
      version: '2.0',
      status: health.status,
      docs: '/api/docs',
      health: '/health',
      timestamp: new Date().toISOString(),
    };
  }
}
