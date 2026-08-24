import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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

  constructor(private prisma: PrismaService) {}

  /**
   * Mark a passenger as face-enrolled.
   * Called after the mobile app successfully captures and stores ArcFace embeddings locally.
   */
  async markFaceEnrolled(loginId: string) {
    const user = await this.prisma.user.findUnique({ where: { loginId } });
    if (!user) throw new NotFoundException('User not found');

    await this.prisma.user.update({
      where: { loginId },
      data: { faceEnrolledAt: new Date() },
    });

    return { status: 'success', message: 'Face enrollment recorded', loginId };
  }

  /**
   * Check if a passenger has an enrolled face.
   */
  async getFaceStatus(loginId: string) {
    const user = await this.prisma.user.findUnique({ where: { loginId } });
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
    const user = await this.prisma.user.findUnique({ where: { loginId } });
    if (!user) throw new NotFoundException('User not found');

    await this.prisma.user.update({
      where: { loginId },
      data: { faceEnrolledAt: null },
    });

    return { status: 'success', message: 'Face enrollment cleared' };
  }
}
