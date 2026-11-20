import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ValidateNested,
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class ServiceItemDto {
  @ApiProperty({ example: 'Tap repair' })
  @IsString()
  @MaxLength(60)
  name: string;

  @ApiProperty({ example: '₹300' })
  @IsString()
  @MaxLength(30)
  price: string;
}

export class CreateWorkerDto {
  @ApiPropertyOptional({ example: 'Experienced plumber with 10 years of work' })
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Bio must be at most 1000 characters' })
  bio?: string;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'Experience years cannot be negative' })
  @Max(60, { message: 'Experience years seems too high' })
  experienceYears?: number;

  @ApiPropertyOptional({ example: '₹200–500/hr' })
  @IsOptional()
  @IsString()
  @MaxLength(50, { message: 'Price range must be at most 50 characters' })
  priceRange?: string;

  @ApiPropertyOptional({ type: [ServiceItemDto], description: 'Service price list' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(15, { message: 'Maximum 15 services allowed' })
  @ValidateNested({ each: true })
  @Type(() => ServiceItemDto)
  services?: ServiceItemDto[];

  @ApiProperty({ example: ['cat-uuid-1', 'cat-uuid-2'] })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one category is required' })
  @ArrayMaxSize(10, { message: 'Maximum 10 categories allowed' })
  @IsUUID('4', { each: true, message: 'Each categoryId must be a valid UUID' })
  categoryIds: string[];

  @ApiPropertyOptional({ example: 'Indore' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @ApiProperty({ example: 28.6139 })
  @IsNumber()
  @Min(-90, { message: 'Latitude must be between -90 and 90' })
  @Max(90, { message: 'Latitude must be between -90 and 90' })
  latitude: number;

  @ApiProperty({ example: 77.209 })
  @IsNumber()
  @Min(-180, { message: 'Longitude must be between -180 and 180' })
  @Max(180, { message: 'Longitude must be between -180 and 180' })
  longitude: number;
}
