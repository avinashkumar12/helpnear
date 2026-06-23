import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GeoService } from './geo.service';

@ApiTags('Geo')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('workers')
export class GeoController {
  constructor(private readonly geoService: GeoService) {}

  @ApiQuery({ name: 'lat', type: Number })
  @ApiQuery({ name: 'lng', type: Number })
  @ApiQuery({ name: 'radius', type: Number, required: false })
  @ApiQuery({ name: 'categoryId', type: String, required: false })
  @Get('nearby')
  async searchNearby(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('radius') radius: string = '5',
    @Query('categoryId') categoryId?: string,
  ) {
    const data = await this.geoService.searchNearby(
      parseFloat(lat),
      parseFloat(lng),
      parseFloat(radius),
      categoryId,
    );
    return { message: 'Nearby workers retrieved successfully', data };
  }
}
