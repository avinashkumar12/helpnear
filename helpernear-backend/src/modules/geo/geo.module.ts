import { Module } from '@nestjs/common';
import { GeoService } from './geo.service';

// The public /workers/nearby route lives in WorkersController.
@Module({
  providers: [GeoService],
  exports: [GeoService],
})
export class GeoModule {}
