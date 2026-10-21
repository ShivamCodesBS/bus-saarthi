import {
  IsString,
  IsArray,
  ValidateNested,
  IsOptional,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AttendanceRecordDto {
  @IsOptional()
  @IsString()
  passenger_id?: string;

  @IsOptional()
  @IsString()
  login_id?: string;

  @IsOptional()
  @IsString()
  student_id?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  fee_status?: string;

  @IsOptional()
  @IsNumber()
  confidence?: number;

  @IsOptional()
  @IsString()
  timestamp?: string;

  @IsOptional()
  @IsString()
  check_in_time?: string;

  @IsOptional()
  @IsString()
  route_id?: string;
}

export class SyncAttendanceDto {
  @IsOptional()
  @IsString()
  route_id?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttendanceRecordDto)
  records?: AttendanceRecordDto[];

  @IsOptional()
  @IsString()
  passenger_id?: string;

  @IsOptional()
  @IsString()
  login_id?: string;

  @IsOptional()
  @IsString()
  student_id?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  fee_status?: string;

  @IsOptional()
  @IsNumber()
  confidence?: number;

  @IsOptional()
  @IsString()
  timestamp?: string;

  @IsOptional()
  @IsString()
  check_in_time?: string;

  @IsOptional()
  data?: any;
}
