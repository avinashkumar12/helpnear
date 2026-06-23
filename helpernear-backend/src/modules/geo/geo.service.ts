import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

export interface NearbyWorkerRow {
  id: string;
  user_id: string;
  bio: string | null;
  experience_years: number;
  price_range: string | null;
  status: string;
  is_verified: boolean;
  latitude: number | null;
  longitude: number | null;
  photo_url: string | null;
  created_at: Date;
  updated_at: Date;
  name: string | null;
  phone: string;
  distance: number;
}

@Injectable()
export class GeoService {
  constructor(private readonly prisma: PrismaService) {}

  async searchNearby(
    lat: number,
    lng: number,
    radiusKm: number,
    categoryId?: string,
  ): Promise<NearbyWorkerRow[]> {
    const results = await this.prisma.$queryRaw<NearbyWorkerRow[]>(
      Prisma.sql`
        SELECT wp.id, wp.user_id, wp.bio, wp.experience_years, wp.price_range,
               wp.status, wp.is_verified, wp.latitude, wp.longitude, wp.photo_url,
               wp.created_at, wp.updated_at,
               u.name, u.phone,
               (6371 * acos(
                 cos(radians(${lat})) * cos(radians(wp.latitude)) *
                 cos(radians(wp.longitude) - radians(${lng})) +
                 sin(radians(${lat})) * sin(radians(wp.latitude))
               )) AS distance
        FROM worker_profiles wp
        JOIN users u ON u.id = wp.user_id
        ${categoryId ? Prisma.sql`JOIN worker_categories wc ON wc.worker_id = wp.id AND wc.category_id = ${categoryId}` : Prisma.empty}
        WHERE wp.is_verified = true
          AND wp.status != 'OFFLINE'
          AND wp.latitude IS NOT NULL
          AND wp.longitude IS NOT NULL
        HAVING (6371 * acos(
                 cos(radians(${lat})) * cos(radians(wp.latitude)) *
                 cos(radians(wp.longitude) - radians(${lng})) +
                 sin(radians(${lat})) * sin(radians(wp.latitude))
               )) < ${radiusKm}
        ORDER BY distance ASC
        LIMIT 50
      `,
    );
    return results;
  }
}
