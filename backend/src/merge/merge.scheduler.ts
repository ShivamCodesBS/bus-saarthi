import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MergeService } from './merge.service';

@Injectable()
export class MergeScheduler {
  private readonly logger = new Logger(MergeScheduler.name);

  constructor(private mergeService: MergeService) {}

  /**
   * Runs every midnight IST to auto-expire all active merges.
   * Next morning, everything resets to normal — all routes are active again.
   */
  @Cron('0 30 18 * * *') // 18:30 UTC = 00:00 IST (midnight)
  async handleMidnightExpiry() {
    this.logger.log('Running midnight merge expiry job...');
    const expiredCount = await this.mergeService.expireActiveMerges();
    this.logger.log(`Midnight job complete. Expired ${expiredCount} merges.`);
  }
}
