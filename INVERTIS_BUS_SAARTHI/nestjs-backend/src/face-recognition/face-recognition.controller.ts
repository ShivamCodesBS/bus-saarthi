import { Controller, Post, Delete, Param, UseInterceptors, UploadedFile, UseGuards, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FaceRecognitionService } from './face-recognition.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

@Controller('api')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FaceRecognitionController {
  constructor(private readonly faceRecognitionService: FaceRecognitionService) {}

  @Post('faces/:passengerId/enroll')
  @Roles(UserRole.ADMIN, UserRole.TRANSPORT_INCHARGE)
  @UseInterceptors(FileInterceptor('file'))
  async enrollFace(@Param('passengerId') passengerId: string, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No image file provided');
    return this.faceRecognitionService.enrollFace(passengerId, file.buffer, file.mimetype);
  }

  @Post('attendance/recognize')
  @Roles(UserRole.ADMIN, UserRole.TRANSPORT_INCHARGE, UserRole.DRIVER) // Usually transport incharge or driver app scans faces
  @UseInterceptors(FileInterceptor('file'))
  async recognizeFace(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No image file provided');
    return this.faceRecognitionService.recognizeFace(file.buffer);
  }

  @Delete('faces/:passengerId')
  @Roles(UserRole.ADMIN, UserRole.TRANSPORT_INCHARGE)
  async deleteFace(@Param('passengerId') passengerId: string) {
    return this.faceRecognitionService.deleteFace(passengerId);
  }
}
