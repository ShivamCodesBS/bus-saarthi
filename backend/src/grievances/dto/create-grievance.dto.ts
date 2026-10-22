import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class CreateGrievanceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
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

  /**
   * Route the complainant believes the issue relates to. The server always
   * resolves the route from the account's own allocation, so this is only a
   * hint — but it is accepted so the client can be explicit.
   */
  @IsString()
  @IsOptional()
  route?: string;
}
