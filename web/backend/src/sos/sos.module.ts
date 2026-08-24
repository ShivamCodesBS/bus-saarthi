import { Module } from '@nestjs/common';

import { SosService } from './sos.service';
import { SosController, SosAliasController } from './sos.controller';

import { User } from '@prisma/client';

@Module({
  controllers: [SosController, SosAliasController],
  providers: [SosService],
  exports: [SosService],
})
export class SosModule {}
