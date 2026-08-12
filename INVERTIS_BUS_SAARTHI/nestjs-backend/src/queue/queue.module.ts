import { Module, Logger } from '@nestjs/common';

const logger = new Logger('QueueModule');

// BullMQ/Redis is optional for local development.
// If Redis is not available, the queue module will be empty and telemetry
// will process synchronously instead of through a queue.
@Module({
  imports: [],
})
export class QueueModule {
  constructor() {
    logger.log('Queue module loaded (Redis/BullMQ disabled for local dev mode)');
  }
}
