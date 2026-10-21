import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Face Recognition Service — Backend Side
 *
 * Face recognition itself is handled on-device by the mobile app using ArcFace.
 * This service manages face enrollment metadata and handles face-verified
 * attendance submissions.
 */
@Injectable()
export class FaceRecognitionService {
  private readonly logger = new Logger(FaceRecognitionService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Mark a passenger as face-enrolled.
   * Updates both faceEnrolledAt and awsFaceId for unified frontend and legacy compatibility.
   */
  async markFaceEnrolled(loginId: string) {
    const user = await this.prisma.user.findUnique({ where: { loginId } });
    if (!user) throw new NotFoundException('User not found');

    const now = new Date();
    await this.prisma.user.update({
      where: { loginId },
      data: {
        faceEnrolledAt: now,
        awsFaceId: `arcface_${loginId}`,
      },
    });

    this.logger.log(`Face enrolled for passenger ${loginId}`);
    return {
      status: 'success',
      message: 'Face enrollment recorded',
      loginId,
      faceEnrolledAt: now,
    };
  }

  /**
   * Check if a passenger has an enrolled face.
   */
  async getFaceStatus(loginId: string) {
    const user = await this.prisma.user.findUnique({ where: { loginId } });
    if (!user) throw new NotFoundException('User not found');

    const isEnrolled = !!(user.faceEnrolledAt || user.awsFaceId);

    return {
      loginId: user.loginId,
      name: user.name,
      faceEnrolled: isEnrolled,
      faceEnrolledAt: user.faceEnrolledAt,
      awsFaceId: user.awsFaceId,
    };
  }

  /**
   * Remove face enrollment for a passenger.
   * Clears both faceEnrolledAt and awsFaceId.
   */
  async deleteFace(loginId: string) {
    const user = await this.prisma.user.findUnique({ where: { loginId } });
    if (!user) throw new NotFoundException('User not found');

    await this.prisma.user.update({
      where: { loginId },
      data: {
        faceEnrolledAt: null,
        awsFaceId: null,
      },
    });

    this.logger.log(`Face enrollment cleared for passenger ${loginId}`);
    return { status: 'success', message: 'Face enrollment cleared' };
  }
}
