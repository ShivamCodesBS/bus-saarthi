import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from '../users/entities/user.entity';
import { RekognitionService } from './rekognition.service';
import { S3Service } from './s3.service';

@Injectable()
export class FaceRecognitionService {
  constructor(
    @InjectRepository(User) private usersRepository: Repository<User>,
    private rekognitionService: RekognitionService,
    private s3Service: S3Service,
  ) {}

  async enrollFace(loginId: string, imageBuffer: Buffer, mimeType: string) {
    const user = await this.usersRepository.findOne({ where: { loginId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.role !== UserRole.PASSENGER) throw new ConflictException('Only passengers can enroll faces');
    if (user.awsFaceId) throw new ConflictException('A face is already enrolled for this passenger');

    const s3Key = this.s3Service.generateKey(loginId, 'enroll');
    await this.s3Service.uploadImage(imageBuffer, s3Key, mimeType);

    try {
      const faceId = await this.rekognitionService.indexFace(imageBuffer, loginId);
      
      user.awsFaceId = faceId || null;
      user.externalImageId = loginId;
      user.s3ObjectKey = s3Key;
      user.faceEnrolledAt = new Date();
      await this.usersRepository.save(user);

      return { status: 'success', faceId, s3Key };
    } catch (error) {
      await this.s3Service.deleteImage(s3Key);
      throw error;
    }
  }

  async recognizeFace(imageBuffer: Buffer) {
    const match = await this.rekognitionService.searchFacesByImage(imageBuffer);
    if (!match) return { status: 'no_match', detail: 'No matching face found above threshold' };

    const passenger = await this.usersRepository.findOne({ where: { loginId: match.externalImageId } });
    if (!passenger) return { status: 'no_match', detail: 'Face recognized but passenger record not found in database' };

    return {
      status: 'matched',
      passenger: {
        login_id: passenger.loginId,
        name: passenger.name,
        fee_status: passenger.feeStatus,
        route_id: passenger.routeId,
      },
      confidence: match.confidence,
    };
  }

  async deleteFace(loginId: string) {
    const user = await this.usersRepository.findOne({ where: { loginId } });
    if (!user || !user.awsFaceId) throw new NotFoundException('No face enrolled for this passenger');

    await this.rekognitionService.deleteFace(user.awsFaceId);
    if (user.s3ObjectKey) {
      await this.s3Service.deleteImage(user.s3ObjectKey);
    }

    user.awsFaceId = null;
    user.externalImageId = null;
    user.s3ObjectKey = null;
    user.faceEnrolledAt = null;
    await this.usersRepository.save(user);

    return { status: 'success', message: 'Face deleted' };
  }
}
