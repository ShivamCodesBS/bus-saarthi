import { Controller, Post, Request, UseInterceptors, UploadedFile, UseGuards } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('api/upload')
@UseGuards(JwtAuthGuard)
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  // Generic file upload
  @Post()
  @UseInterceptors(FileInterceptor('file'))
  uploadFile(@UploadedFile() file: Express.Multer.File) {
    return this.uploadService.uploadFile(file, 'bus_saarthi_media');
  }

  // Profile picture upload — updates user's profilePic in DB
  @Post('profile_pic')
  @UseInterceptors(FileInterceptor('file'))
  uploadProfilePic(@UploadedFile() file: Express.Multer.File, @Request() req: any) {
    return this.uploadService.uploadProfilePic(file, req.user.loginId);
  }
}
