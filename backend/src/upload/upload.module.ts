import { Module } from '@nestjs/common';

import { UploadService } from './upload.service';
import { UploadController } from './upload.controller';
import { User } from '@prisma/client';

@Module({
  controllers: [UploadController],
  providers: [UploadService],
  exports: [UploadService],
})
export class UploadModule {}
