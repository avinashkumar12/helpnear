import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as QRCode from 'qrcode';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkerSort, sortWorkers, staleCutoff } from './ranking';
import { CreateWorkerDto } from './dto/create-worker.dto';
import { UpdateWorkerDto } from './dto/update-worker.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { UpdateStatusDto } from './dto/update-status.dto';

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

@Injectable()
export class WorkersService {
  constructor(private readonly prisma: PrismaService) {}

  async getNearby(
    lat: number,
    lng: number,
    radiusKm: number,
    categoryId?: string,
    opts: { sort?: WorkerSort; minRating?: number; availableNow?: boolean; page?: number; limit?: number } = {},
  ) {
    const workers = await this.prisma.workerProfile.findMany({
      where: {
        isVerified: true,
        status: opts.availableNow ? 'AVAILABLE' : { not: 'OFFLINE' },
        lastActiveAt: { gte: staleCutoff() },
        ...(categoryId && {
          categories: { some: { categoryId } },
        }),
      },
      include: {
        categories: { include: { category: true } },
        user: { select: { id: true, name: true, phone: true } },
        reviews: { select: { rating: true }, take: 100 },
      },
    });

    const mapped = workers
      .map((w) => {
        const distance = haversineKm(lat, lng, Number(w.latitude ?? 0), Number(w.longitude ?? 0));
        const ratings = w.reviews.map((r) => r.rating);
        const averageRating = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
        return { ...w, distance, averageRating, reviewCount: ratings.length };
      })
      .filter((w) => w.distance <= radiusKm)
      .filter((w) => !opts.minRating || w.averageRating >= opts.minRating);

    const sorted = sortWorkers(mapped, opts.sort ?? 'relevance', radiusKm);
    const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);
    const page = Math.max(opts.page ?? 1, 1);
    return sorted.slice((page - 1) * limit, page * limit);
  }

  async createProfile(userId: string, dto: CreateWorkerDto) {
    const existing = await this.prisma.workerProfile.findUnique({
      where: { userId },
    });
    if (existing) {
      throw new BadRequestException('Worker profile already exists');
    }

    return this.prisma.workerProfile.create({
      data: {
        userId,
        bio: dto.bio,
        experienceYears: dto.experienceYears ?? 0,
        priceRange: dto.priceRange,
        latitude: dto.latitude,
        longitude: dto.longitude,
        city: dto.city?.trim() || undefined,
        categories: {
          create: dto.categoryIds.map((categoryId) => ({ categoryId })),
        },
      },
      include: {
        categories: { include: { category: true } },
        user: { select: { id: true, name: true, phone: true, role: true } },
      },
    });
  }

  async getMyProfile(userId: string) {
    const profile = await this.prisma.workerProfile.findUnique({
      where: { userId },
      include: {
        categories: { include: { category: true } },
        user: { select: { id: true, name: true, phone: true, role: true } },
      },
    });
    if (!profile) throw new NotFoundException('Worker profile not found');

    const verification = await this.prisma.workerVerification.findUnique({
      where: { workerId: profile.id },
      select: { status: true, idType: true, note: true, submittedAt: true },
    });
    const verificationStatus = profile.isVerified ? 'APPROVED' : verification?.status ?? 'NONE';
    return {
      ...profile,
      verificationStatus,
      verificationNote: verificationStatus === 'REJECTED' ? verification?.note ?? null : null,
      completeness: this.computeCompleteness(profile, verificationStatus),
    };
  }

  private computeCompleteness(
    p: { photoUrl: string | null; bio: string | null; priceRange: string | null; latitude: number | null; categories: unknown[]; gallery: string[]; services: unknown },
    verificationStatus: string,
  ) {
    const services = Array.isArray(p.services) ? p.services : [];
    const checks: { key: string; label: string; weight: number; done: boolean }[] = [
      { key: 'photo', label: 'Add a profile photo', weight: 15, done: !!p.photoUrl },
      { key: 'bio', label: 'Write a bio (at least 30 characters)', weight: 15, done: (p.bio ?? '').trim().length >= 30 },
      { key: 'categories', label: 'Choose your categories', weight: 10, done: p.categories.length > 0 },
      { key: 'location', label: 'Set your location', weight: 10, done: p.latitude != null },
      { key: 'price', label: 'Add a price range', weight: 10, done: !!(p.priceRange ?? '').trim() },
      { key: 'services', label: 'List your services and prices', weight: 10, done: services.length > 0 },
      { key: 'gallery', label: 'Upload photos of your work', weight: 10, done: p.gallery.length > 0 },
      { key: 'verification', label: 'Submit your ID for verification', weight: 20, done: verificationStatus === 'PENDING' || verificationStatus === 'APPROVED' },
    ];
    const score = checks.filter((c) => c.done).reduce((n, c) => n + c.weight, 0);
    return { score, missing: checks.filter((c) => !c.done).map((c) => ({ key: c.key, label: c.label })) };
  }

  async submitVerification(userId: string, idType: string, filename: string) {
    const allowed = ['AADHAAR', 'PAN', 'VOTER_ID', 'DRIVING_LICENSE', 'OTHER'];
    if (!allowed.includes(idType)) {
      this.removePrivateFile(filename);
      throw new BadRequestException('Invalid ID type');
    }
    const profile = await this.prisma.workerProfile.findUnique({ where: { userId }, select: { id: true, isVerified: true } });
    if (!profile) { this.removePrivateFile(filename); throw new NotFoundException('Worker profile not found'); }
    if (profile.isVerified) { this.removePrivateFile(filename); throw new BadRequestException('Your profile is already verified'); }

    const previous = await this.prisma.workerVerification.findUnique({ where: { workerId: profile.id } });
    if (previous) this.removePrivateFile(previous.idDocPath);

    return this.prisma.workerVerification.upsert({
      where: { workerId: profile.id },
      create: { workerId: profile.id, idType, idDocPath: filename },
      update: { idType, idDocPath: filename, status: 'PENDING', note: null, submittedAt: new Date(), reviewedAt: null },
      select: { status: true, idType: true, submittedAt: true },
    });
  }

  private removePrivateFile(name: string) {
    try { fs.unlinkSync(path.join(process.cwd(), 'private-uploads', 'verification', path.basename(name))); } catch { /* already gone */ }
  }

  async addGalleryPhotos(userId: string, urls: string[]) {
    const profile = await this.prisma.workerProfile.findUnique({ where: { userId }, select: { id: true, gallery: true } });
    if (!profile) {
      urls.forEach((u) => this.removePublicUpload(u));
      throw new NotFoundException('Worker profile not found');
    }
    if (profile.gallery.length + urls.length > 8) {
      urls.forEach((u) => this.removePublicUpload(u));
      throw new BadRequestException('You can upload at most 8 work photos');
    }
    return this.prisma.workerProfile.update({
      where: { id: profile.id },
      data: { gallery: { push: urls } },
      select: { gallery: true },
    });
  }

  async removeGalleryPhoto(userId: string, url: string) {
    const profile = await this.prisma.workerProfile.findUnique({ where: { userId }, select: { id: true, gallery: true } });
    if (!profile) throw new NotFoundException('Worker profile not found');
    if (!profile.gallery.includes(url)) throw new NotFoundException('Photo not found');
    this.removePublicUpload(url);
    return this.prisma.workerProfile.update({
      where: { id: profile.id },
      data: { gallery: profile.gallery.filter((g) => g !== url) },
      select: { gallery: true },
    });
  }

  private removePublicUpload(url: string) {
    try { fs.unlinkSync(path.join(process.cwd(), 'uploads', 'workers', 'gallery', path.basename(url))); } catch { /* already gone */ }
  }

  async getProfileQr(workerId: string, baseUrl: string) {
    const worker = await this.prisma.workerProfile.findUnique({ where: { id: workerId }, select: { id: true } });
    if (!worker) throw new NotFoundException('Worker not found');
    const url = baseUrl + '/worker.html?id=' + worker.id;
    const svg = await QRCode.toString(url, { type: 'svg', margin: 1, width: 220 });
    return { url, svg };
  }

  async getWorkerById(workerId: string, viewerUserId?: string) {
    const profile = await this.prisma.workerProfile.findUnique({
      where: { id: workerId },
      include: {
        categories: { include: { category: true } },
        user: { select: { id: true, name: true, phone: true } },
        reviews: {
          select: { rating: true, comment: true, createdAt: true, user: { select: { name: true } } },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });
    if (!profile) throw new NotFoundException('Worker not found');

    // Count a profile view (not the owner's own visits)
    if (profile.userId !== viewerUserId) {
      this.prisma.workerProfile
        .update({ where: { id: workerId }, data: { profileViews: { increment: 1 } }, select: { id: true } })
        .catch(() => undefined);
    }

    const [agg, hasReviewed, hasContacted] = await Promise.all([
      this.prisma.review.aggregate({
        where: { workerId },
        _avg: { rating: true },
        _count: { rating: true },
      }),
      viewerUserId
        ? this.prisma.review.findFirst({ where: { workerId, userId: viewerUserId }, select: { id: true } }).then(Boolean)
        : Promise.resolve(false),
      viewerUserId
        ? this.prisma.contactLog.findFirst({ where: { workerId, userId: viewerUserId }, select: { id: true } }).then(Boolean)
        : Promise.resolve(false),
    ]);

    return {
      ...profile,
      averageRating: agg._avg.rating ?? 0,
      reviewCount: agg._count.rating,
      hasReviewed,
      hasContacted,
    };
  }

  async updateProfile(userId: string, dto: UpdateWorkerDto) {
    const profile = await this.prisma.workerProfile.findUnique({
      where: { userId },
    });
    if (!profile) throw new NotFoundException('Worker profile not found');

    const { categoryIds, services, ...rest } = dto;

    if (categoryIds) {
      await this.prisma.workerCategory.deleteMany({
        where: { workerId: profile.id },
      });
    }

    return this.prisma.workerProfile.update({
      where: { userId },
      data: {
        ...rest,
        ...(services && { services: services.map((s) => ({ name: s.name, price: s.price })) }),
        ...(categoryIds && {
          categories: {
            create: categoryIds.map((categoryId) => ({ categoryId })),
          },
        }),
      },
      include: {
        categories: { include: { category: true } },
      },
    });
  }

  async updateLocation(userId: string, dto: UpdateLocationDto) {
    const profile = await this.prisma.workerProfile.findUnique({
      where: { userId },
    });
    if (!profile) throw new NotFoundException('Worker profile not found');

    return this.prisma.workerProfile.update({
      where: { userId },
      data: {
        latitude: dto.latitude,
        longitude: dto.longitude,
        lastActiveAt: new Date(),
        ...(dto.city?.trim() && { city: dto.city.trim() }),
      },
      select: { id: true, latitude: true, longitude: true, updatedAt: true },
    });
  }

  async updateStatus(userId: string, dto: UpdateStatusDto) {
    const profile = await this.prisma.workerProfile.findUnique({
      where: { userId },
    });
    if (!profile) throw new NotFoundException('Worker profile not found');

    return this.prisma.workerProfile.update({
      where: { userId },
      data: { status: dto.status, lastActiveAt: new Date() },
      select: { id: true, status: true, updatedAt: true },
    });
  }

  async updatePhotoUrl(userId: string, photoUrl: string) {
    return this.prisma.workerProfile.update({
      where: { userId },
      data: { photoUrl },
      select: { id: true, photoUrl: true },
    });
  }

  async logContact(workerId: string, channel: string, userId?: string) {
    const worker = await this.prisma.workerProfile.findUnique({ where: { id: workerId }, select: { id: true } });
    if (!worker) throw new NotFoundException('Worker not found');
    return this.prisma.contactLog.create({
      data: { workerId, channel, userId: userId ?? null },
      select: { id: true, channel: true, createdAt: true },
    });
  }

  /** Contacts the customer made 24h-14d ago that they haven't answered yet. */
  async getPendingFollowUps(userId: string) {
    const now = Date.now();
    const logs = await this.prisma.contactLog.findMany({
      where: {
        userId,
        outcome: null,
        createdAt: {
          lte: new Date(now - 24 * 60 * 60 * 1000),
          gte: new Date(now - 14 * 24 * 60 * 60 * 1000),
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        channel: true,
        createdAt: true,
        worker: { select: { id: true, user: { select: { name: true } } } },
      },
    });
    return logs.map((l) => ({
      id: l.id,
      channel: l.channel,
      createdAt: l.createdAt,
      workerId: l.worker.id,
      workerName: l.worker.user?.name ?? 'the worker',
    }));
  }

  async setContactOutcome(userId: string, contactId: string, outcome: string) {
    if (outcome !== 'HIRED' && outcome !== 'NOT_HIRED') {
      throw new BadRequestException('Outcome must be HIRED or NOT_HIRED');
    }
    const log = await this.prisma.contactLog.findUnique({ where: { id: contactId } });
    if (!log || log.userId !== userId) throw new NotFoundException('Contact not found');
    return this.prisma.contactLog.update({
      where: { id: contactId },
      data: { outcome, respondedAt: new Date() },
      select: { id: true, outcome: true, workerId: true },
    });
  }

  async getContactStats(userId: string) {
    const profile = await this.prisma.workerProfile.findUnique({ where: { userId }, select: { id: true } });
    if (!profile) throw new NotFoundException('Worker profile not found');

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek  = new Date(startOfToday); startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay());
    const startOf30    = new Date(now); startOf30.setDate(now.getDate() - 30);

    const startOf7 = new Date(startOfToday); startOf7.setDate(startOfToday.getDate() - 6);

    const [total, todayCount, weekCount, monthCount, byChannel, recent, outcomes, last7, viewsRow] = await Promise.all([
      this.prisma.contactLog.count({ where: { workerId: profile.id } }),
      this.prisma.contactLog.count({ where: { workerId: profile.id, createdAt: { gte: startOfToday } } }),
      this.prisma.contactLog.count({ where: { workerId: profile.id, createdAt: { gte: startOfWeek } } }),
      this.prisma.contactLog.count({ where: { workerId: profile.id, createdAt: { gte: startOf30 } } }),
      this.prisma.contactLog.groupBy({ by: ['channel'], where: { workerId: profile.id }, _count: { channel: true } }),
      this.prisma.contactLog.findMany({
        where: { workerId: profile.id },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { id: true, channel: true, createdAt: true, outcome: true, user: { select: { name: true } } },
      }),
      this.prisma.contactLog.groupBy({ by: ['outcome'], where: { workerId: profile.id, outcome: { not: null } }, _count: { outcome: true } }),
      this.prisma.contactLog.findMany({ where: { workerId: profile.id, createdAt: { gte: startOf7 } }, select: { createdAt: true } }),
      this.prisma.workerProfile.findUnique({ where: { id: profile.id }, select: { profileViews: true } }),
    ]);

    const outcomeMap: Record<string, number> = {};
    outcomes.forEach((o) => { if (o.outcome) outcomeMap[o.outcome] = o._count.outcome; });
    const hired = outcomeMap['HIRED'] ?? 0;
    const notHired = outcomeMap['NOT_HIRED'] ?? 0;
    const answered = hired + notHired;
    const profileViews = viewsRow?.profileViews ?? 0;

    const daily: { date: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(startOfToday); d.setDate(startOfToday.getDate() - i);
      const next = new Date(d); next.setDate(d.getDate() + 1);
      daily.push({
        date: d.toISOString().slice(0, 10),
        count: last7.filter((l) => l.createdAt >= d && l.createdAt < next).length,
      });
    }

    const channelMap: Record<string, number> = {};
    byChannel.forEach(r => { channelMap[r.channel] = r._count.channel; });

    return {
      total, todayCount, weekCount, monthCount,
      calls: channelMap['call'] ?? 0,
      whatsapps: channelMap['whatsapp'] ?? 0,
      recent,
      profileViews,
      hired,
      notHired,
      hireRate: answered ? Math.round((hired / answered) * 100) : null,
      contactRate: profileViews ? Math.min(100, Math.round((total / profileViews) * 100)) : null,
      daily,
    };
  }
}
