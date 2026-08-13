import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from '../users/entities/user.entity';

/**
 * Face Recognition Service — Backend Side
 *
 * Face recognition itself is handled on-device by the mobile app using ArcFace.
 * This service manages face enrollment metadata and handles the face-verified
 * attendance submissions from the mobile app.
 */
@Injectable()
export class FaceRecognitionService {
  private readonly logger = new Logger(FaceRecognitionService.name);

  constructor(
    @InjectRepository(User) private usersRepository: Repository<User>,
  ) {}

  /**
   * Mark a passenger as face-enrolled.
   * Called after the mobile app successfully captures and stores ArcFace embeddings locally.
   */
  async markFaceEnrolled(loginId: string) {
    const user = await this.usersRepository.findOne({ where: { loginId } });
    if (!user) throw new NotFoundException('User not found');

    user.faceEnrolledAt = new Date();
    await this.usersRepository.save(user);

    return { status: 'success', message: 'Face enrollment recorded', loginId };
  }

  /**
   * Check if a passenger has an enrolled face.
   */
  async getFaceStatus(loginId: string) {
    const user = await this.usersRepository.findOne({ where: { loginId } });
    if (!user) throw new NotFoundException('User not found');

    return {
      loginId: user.loginId,
      name: user.name,
      faceEnrolled: !!user.faceEnrolledAt,
      faceEnrolledAt: user.faceEnrolledAt,
    };
  }

  /**
   * Remove face enrollment for a passenger.
   * The mobile app should also clear its local ArcFace embeddings.
   */
  async deleteFace(loginId: string) {
    const user = await this.usersRepository.findOne({ where: { loginId } });
    if (!user) throw new NotFoundException('User not found');

    user.faceEnrolledAt = null;
    await this.usersRepository.save(user);

    return { status: 'success', message: 'Face enrollment cleared' };
  }
}
