import {
  Controller,
  Post,
  Body,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { StreamsService } from './streams.service';

@Controller('api/streams')
export class StreamsController {
  constructor(private readonly streamsService: StreamsService) {}

  @Post('auth')
  async authenticateStream(@Body() body: { path: string; action: string }) {
    const { path, action } = body;
    // MediaMTX passes the stream path (e.g., 'live/bus-123')
    const streamId = path.replace('live/', '');

    if (action === 'publish') {
      const isValid = await this.streamsService.validateBus(streamId);
      if (!isValid) {
        throw new HttpException('Unauthorized Bus', HttpStatus.UNAUTHORIZED);
      }
      await this.streamsService.setStreamActive(streamId, true);
    } else if (action === 'unpublish') {
      await this.streamsService.setStreamActive(streamId, false);
    }

    return { status: 'ok' };
  }
}
