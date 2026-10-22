import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { UserRole } from '@prisma/client';

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  login_id: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  /**
   * Optional role selected on the login screen. When present the backend
   * verifies it matches the account's real role, so the dropdown can never be
   * used to reach a dashboard the account is not entitled to.
   */
  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;

  @IsString()
  @IsOptional()
  fcm_token?: string;
}
