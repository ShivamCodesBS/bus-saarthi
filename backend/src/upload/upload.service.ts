import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v2 as cloudinary } from 'cloudinary';
import { ConfigService } from '@nestjs/config';
import { User } from '../users/entities/user.entity';

@Injectable()
export class UploadService {
  constructor(
    private configService: ConfigService,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {
    cloudinary.config({
      cloud_name: this.configService.get<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: this.configService.get<string>('CLOUDINARY_API_KEY'),
      api_secret: this.configService.get<string>('CLOUDINARY_API_SECRET'),
    });
  }

  async uploadFile(file: Express.Multer.File, folder: string = 'bus_saarthi_media') {
    if (!file) throw new BadRequestException('No file provided');

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder },
        (error, result) => {
          if (error) return reject(error);
          if (!result) return reject(new Error('Upload failed'));
          resolve({ status: 'success', url: result.secure_url });
        },
      );
      uploadStream.end(file.buffer);
    });
  }

  async uploadProfilePic(file: Express.Multer.File, loginId: string): Promise<any> {
    if (!file) throw new BadRequestException('No file provided');

    const result: any = await this.uploadFile(file, 'bus_saarthi_avatars');
    const profilePicUrl = result.url;

    // Update user's profile pic in DB
    const user = await this.usersRepository.findOne({ where: { loginId } });
    if (user) {
      user.profilePic = profilePicUrl;
      await this.usersRepository.save(user);
    }

    return {
      status: 'success',
      url: profilePicUrl,
      profile_pic: profilePicUrl,
    };
  }
}
