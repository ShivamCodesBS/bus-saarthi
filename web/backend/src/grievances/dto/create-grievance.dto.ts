import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateGrievanceDto {
  @IsString()
  @IsNotEmpty()
  text: string;

  @IsString()
  @IsOptional()
  type?: string;

  @IsString()
  @IsOptional()
  mediaUrl?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsString()
  @IsOptional()
  realName?: string;
}
