import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class StreamsService {
  private readonly logger = new Logger(StreamsService.name);

  // In a real app, this would be a Redis store or Database table.
  // Using an in-memory map for the integration demonstration.
  private activeStreams = new Map<string, boolean>();

  async validateBus(busId: string): Promise<boolean> {
    // Implement actual DB check to verify if the bus is registered.
    this.logger.log(`Validating bus stream connection: ${busId}`);
    return true; // Allowing all for now
  }

  async setStreamActive(busId: string, isActive: boolean): Promise<void> {
    if (isActive) {
      this.activeStreams.set(busId, true);
      this.logger.log(`Stream activated for bus: ${busId}`);
    } else {
      this.activeStreams.delete(busId);
      this.logger.log(`Stream deactivated for bus: ${busId}`);
    }
  }

  getActiveStreams(): string[] {
    return Array.from(this.activeStreams.keys());
  }
}
