import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Plumbing' })
  @IsNotEmpty()
  @IsString()
  @MinLength(2, { message: 'Category name must be at least 2 characters' })
  @MaxLength(50, { message: 'Category name must be at most 50 characters' })
  name: string;

  @ApiPropertyOptional({ example: 'wrench' })
  @IsOptional()
  @IsString()
  @MaxLength(10, { message: 'Icon must be at most 10 characters' })
  icon?: string;

  @ApiPropertyOptional({ example: 'Professional plumbing services' })
  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'Description must be at most 200 characters' })
  description?: string;
}
