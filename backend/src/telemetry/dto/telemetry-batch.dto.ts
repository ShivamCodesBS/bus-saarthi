import { IsString, IsNotEmpty, IsArray, ValidateNested, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

class TelemetryDataDto {
  @IsNumber()
  lat: number;

  @IsNumber()
  lng: number;

  @IsNumber()
  gps_speed_knots: number;

  @IsNumber()
  mpu_speed_kmh: number;

  @IsNumber()
  heading_deg: number;

  @IsString()
  timestamp: string;
}

export class TelemetryBatchDto {
  @IsString()
  @IsNotEmpty()
  route_id: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TelemetryDataDto)
  data: TelemetryDataDto[];
}
