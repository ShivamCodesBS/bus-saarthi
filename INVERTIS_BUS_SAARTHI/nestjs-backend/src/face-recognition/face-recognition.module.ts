import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FaceRecognitionService } from './face-recognition.service';
import { FaceRecognitionController } from './face-recognition.controller';
import { RekognitionService } from './rekognition.service';
import { S3Service } from './s3.service';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [FaceRecognitionController],
  providers: [FaceRecognitionService, RekognitionService, S3Service],
  exports: [FaceRecognitionService],
})
export class FaceRecognitionModule {}
