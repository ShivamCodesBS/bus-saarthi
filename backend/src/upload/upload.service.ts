import { Injectable, BadRequestException } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UploadService {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    cloudinary.config({
      cloud_name: this.configService.get<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: this.configService.get<string>('CLOUDINARY_API_KEY'),
      api_secret: this.configService.get<string>('CLOUDINARY_API_SECRET'),
    });
  }

  async uploadFile(
    file: Express.Multer.File,
    folder: string = 'bus_saarthi_media',
  ) {
    if (!file) throw new BadRequestException('No file provided');
    if (!file.buffer?.length) {
      throw new BadRequestException('The uploaded file was empty');
    }

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder, resource_type: 'auto' },
        (error, result) => {
          if (error) {
            // Cloudinary rejects the file (wrong format, too large, …).
            // Surface a readable message instead of a 500.
            const message =
              error?.message || 'The file could not be uploaded';
            return reject(
              new BadRequestException(
                /Invalid image file|File size|unsupported/i.test(message)
                  ? 'That file type or size is not supported. Please upload an image, video or audio file.'
                  : 'The file could not be uploaded. Please try again.',
              ),
            );
          }
          if (!result) {
            return reject(
              new BadRequestException('The file could not be uploaded'),
            );
          }
          resolve({
            status: 'success',
            url: result.secure_url,
            publicId: result.public_id,
            resourceType: result.resource_type,
          });
        },
      );
      uploadStream.end(file.buffer);
    });
  }

  async uploadProfilePic(
    file: Express.Multer.File,
    loginId: string,
  ): Promise<any> {
    if (!file) throw new BadRequestException('No file provided');

    const result: any = await this.uploadFile(file, 'bus_saarthi_avatars');
    const profilePicUrl = result.url;

    // Update user's profile pic in DB
    const user = await this.prisma.user.findUnique({ where: { loginId } });
    if (user) {
      await this.prisma.user.update({
        where: { loginId },
        data: { profilePic: profilePicUrl },
      });
    }

    return {
      status: 'success',
      url: profilePicUrl,
      profile_pic: profilePicUrl,
    };
  }
}
