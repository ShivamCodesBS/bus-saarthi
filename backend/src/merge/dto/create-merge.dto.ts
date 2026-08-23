import { IsString, IsOptional, IsEnum } from 'class-validator';
import { MergeReason } from '@prisma/client';

export class CreateMergeDto {
  @IsString()
  cancelled_route_id: string;

  @IsString()
  target_route_id: string;

  @IsOptional()
  @IsEnum(MergeReason)
  reason?: MergeReason;

  @IsOptional()
  @IsString()
  notes?: string;
}
