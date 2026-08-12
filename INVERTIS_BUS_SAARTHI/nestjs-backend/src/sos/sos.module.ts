import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SosService } from './sos.service';
import { SosController, SosAliasController } from './sos.controller';
import { SosAlert } from './entities/sos-alert.entity';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SosAlert, User])],
  controllers: [SosController, SosAliasController],
  providers: [SosService],
  exports: [SosService],
})
export class SosModule {}
