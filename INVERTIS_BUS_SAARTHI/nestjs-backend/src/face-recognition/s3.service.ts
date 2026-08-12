import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';

@Injectable()
export class S3Service {
  private client: S3Client;
  private readonly logger = new Logger(S3Service.name);

  constructor(private configService: ConfigService) {
    this.client = new S3Client({
      region: this.configService.get<string>('aws.region'),
      credentials: {
        accessKeyId: this.configService.get<string>('aws.accessKeyId')!,
        secretAccessKey: this.configService.get<string>('aws.secretAccessKey')!,
      },
    });
  }

  generateKey(passengerId: string, suffix: string = 'enroll') {
    const safeId = String(passengerId).replace(/[^a-zA-Z0-9_-]/g, '_');
    return `faces/${safeId}-${suffix}-${Date.now()}.jpg`;
  }

  async uploadImage(buffer: Buffer, key: string, mimeType: string) {
    const upload = new Upload({
      client: this.client,
      params: {
        Bucket: this.configService.get<string>('aws.s3Bucket'),
        Key: key,
        Body: Readable.from(buffer),
        ContentType: mimeType,
        ServerSideEncryption: 'AES256',
        Metadata: { uploadedAt: new Date().toISOString() },
      },
      partSize: 5 * 1024 * 1024,
      queueSize: 1,
    });

    await upload.done();
    return key;
  }

  async deleteImage(key: string) {
    if (!key) return;
    try {
      await this.client.send(new DeleteObjectCommand({
        Bucket: this.configService.get<string>('aws.s3Bucket'),
        Key: key,
      }));
    } catch (err) {
      this.logger.error(`Failed to delete S3 object ${key}`, err);
    }
  }

  async getPresignedUrl(key: string) {
    if (!key) return null;
    const command = new GetObjectCommand({
      Bucket: this.configService.get<string>('aws.s3Bucket'),
      Key: key,
    });
    return getSignedUrl(this.client, command, { expiresIn: 3600 });
  }
}
