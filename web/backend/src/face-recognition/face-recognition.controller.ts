import {
  Controller,
  Post,
  Delete,
  Get,
  Param,
  UseGuards,
} from '@nestjs/common';
import { FaceRecognitionService } from './face-recognition.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('api/faces')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FaceRecognitionController {
  constructor(
    private readonly faceRecognitionService: FaceRecognitionService,
  ) {}

  /**
   * Called by mobile app after it successfully captures ArcFace embeddings on-device.
   */
  @Post(':passengerId/enroll')
  @Roles(UserRole.admin, UserRole.transport_incharge, UserRole.driver)
  async markEnrolled(@Param('passengerId') passengerId: string) {
    return this.faceRecognitionService.markFaceEnrolled(passengerId);
  }

  /**
   * Check face enrollment status for a passenger.
   */
  @Get(':passengerId/status')
  async getFaceStatus(@Param('passengerId') passengerId: string) {
    return this.faceRecognitionService.getFaceStatus(passengerId);
  }

  /**
   * Clear face enrollment for a passenger.
   */
  @Delete(':passengerId')
  @Roles(UserRole.admin, UserRole.transport_incharge)
  async deleteFace(@Param('passengerId') passengerId: string) {
    return this.faceRecognitionService.deleteFace(passengerId);
  }
}
