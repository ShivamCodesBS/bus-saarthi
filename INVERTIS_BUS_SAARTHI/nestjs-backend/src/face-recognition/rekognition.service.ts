import { Injectable, Logger, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RekognitionClient, DetectFacesCommand, IndexFacesCommand, SearchFacesByImageCommand, DeleteFacesCommand } from '@aws-sdk/client-rekognition';
import { User } from '../users/entities/user.entity';

@Injectable()
export class RekognitionService {
  private client: RekognitionClient;
  private readonly logger = new Logger(RekognitionService.name);

  constructor(private configService: ConfigService) {
    this.client = new RekognitionClient({
      region: this.configService.get<string>('aws.region'),
      credentials: {
        accessKeyId: this.configService.get<string>('aws.accessKeyId')!,
        secretAccessKey: this.configService.get<string>('aws.secretAccessKey')!,
      },
    });
  }

  async validateFaceImage(imageBuffer: Buffer) {
    const result = await this.client.send(new DetectFacesCommand({
      Image: { Bytes: imageBuffer },
      Attributes: ['ALL'],
    }));

    const faces = result.FaceDetails || [];
    if (faces.length === 0) throw new BadRequestException('No face detected in the image.');
    if (faces.length > 1) throw new BadRequestException(`${faces.length} faces detected. Please upload an image with exactly one face.`);

    const face = faces[0];
    const minConfidence = this.configService.get<number>('aws.minFaceConfidence');
    const minSharpness = this.configService.get<number>('aws.minSharpness');
    const minBrightness = this.configService.get<number>('aws.minBrightness');

    if (face.Confidence! < minConfidence!) throw new BadRequestException(`Detection confidence ${face.Confidence!.toFixed(1)}% is below ${minConfidence}%`);
    if (face.Quality) {
      if (face.Quality.Sharpness! < minSharpness!) throw new BadRequestException(`Image is too blurry (sharpness: ${face.Quality.Sharpness!.toFixed(1)})`);
      if (face.Quality.Brightness! < minBrightness!) throw new BadRequestException(`Image is too dark (brightness: ${face.Quality.Brightness!.toFixed(1)})`);
    }

    return face;
  }

  async indexFace(imageBuffer: Buffer, externalImageId: string) {
    await this.validateFaceImage(imageBuffer);

    const result = await this.client.send(new IndexFacesCommand({
      CollectionId: this.configService.get<string>('aws.rekognitionCollection'),
      Image: { Bytes: imageBuffer },
      ExternalImageId: externalImageId,
      DetectionAttributes: ['ALL'],
      MaxFaces: 1,
      QualityFilter: 'HIGH',
    }));

    const records = result.FaceRecords || [];
    if (records.length === 0) throw new BadRequestException('Rekognition rejected the face (quality filter: HIGH).');

    return records[0].Face!.FaceId;
  }

  async searchFacesByImage(imageBuffer: Buffer) {
    try {
      const result = await this.client.send(new SearchFacesByImageCommand({
        CollectionId: this.configService.get<string>('aws.rekognitionCollection'),
        Image: { Bytes: imageBuffer },
        MaxFaces: 1,
        FaceMatchThreshold: this.configService.get<number>('aws.confidenceThreshold'),
        QualityFilter: 'AUTO',
      }));

      const matches = result.FaceMatches || [];
      if (matches.length === 0) return null;

      const best = matches[0];
      return {
        faceId: best.Face!.FaceId,
        externalImageId: best.Face!.ExternalImageId,
        confidence: best.Similarity,
      };
    } catch (err) {
      if (err.name === 'InvalidParameterException') return null; // No face found in search image
      throw err;
    }
  }

  async deleteFace(faceId: string) {
    if (!faceId) return;
    await this.client.send(new DeleteFacesCommand({
      CollectionId: this.configService.get<string>('aws.rekognitionCollection'),
      FaceIds: [faceId],
    }));
  }
}
