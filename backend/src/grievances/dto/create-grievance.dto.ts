import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  IsBoolean,
} from 'class-validator';

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
   * True when the reporter asked to stay anonymous. Staff (TI/Admin) still
   * see the real name internally, but other passengers never do.
   */
  @IsBoolean()
  @IsOptional()
  isAnonymous?: boolean;

  /**
   * Route the complainant believes the issue relates to. The server always
   * resolves the route from the account's own allocation, so this is only a
   * hint — but it is accepted so the client can be explicit.
   */
  @IsString()
  @IsOptional()
  route?: string;
}
