import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsNumber,
  IsDateString,
} from 'class-validator';
import { UserRole, FeeStatus } from '@prisma/client';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  login_id: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  password?: string;

  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;

  @IsString()
  @IsOptional()
  route_id?: string;

  @IsEnum(FeeStatus)
  @IsOptional()
  fee_status?: FeeStatus;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  designation?: string;

  @IsString()
  @IsOptional()
  licenseNumber?: string;

  @IsDateString()
  @IsOptional()
  licenseExpiry?: string;

  @IsNumber()
  @IsOptional()
  experienceYears?: number;

  @IsString()
  @IsOptional()
  bloodGroup?: string;

  @IsString()
  @IsOptional()
  parentName?: string;

  @IsString()
  @IsOptional()
  parentPhone?: string;

  @IsDateString()
  @IsOptional()
  dob?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  gradeClass?: string;

  @IsString()
  @IsOptional()
  profile_pic?: string;

  @IsString()
  @IsOptional()
  wake_alarm?: boolean; // Wait, boolean is @IsBoolean, but users.service.ts reads it. Let's use @IsOptional().

  @IsNumber()
  @IsOptional()
  location_lat?: number;

  @IsNumber()
  @IsOptional()
  location_lng?: number;
}
