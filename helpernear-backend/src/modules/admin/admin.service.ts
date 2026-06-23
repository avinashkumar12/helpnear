import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkerActionDto } from './dto/worker-action.dto';
import { EmailService } from '../email/email.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly email: EmailService,
    private readonly notifications: NotificationsService,
  ) {}

  async adminLogin(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.role !== 'ADMIN') throw new UnauthorizedException('Invalid credentials');
    if (!user.passwordHash) throw new UnauthorizedException('Admin password not set. Use /admin/setup first.');
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const payload = { sub: user.id, phone: user.phone, role: user.role };
    const secret = this.config.get<string>('jwt.secret') ?? 'secret';
    const accessToken = await this.jwt.signAsync(payload, { secret, expiresIn: '7d' });
    return { accessToken, user: { id: user.id, name: user.name, email: user.email, role: user.role } };
  }

  async adminSetup(name: string, email: string, password: string) {
    const existing = await this.prisma.user.findFirst({ where: { role: 'ADMIN' } });
    if (existing && existing.email && existing.passwordHash) {
      throw new ConflictException('Admin account already configured.');
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const dummyPhone = '+910000000000';
    const user = await this.prisma.user.upsert({
      where: { email },
      create: { name, email, passwordHash, phone: dummyPhone, role: 'ADMIN' },
      update: { name, passwordHash, role: 'ADMIN' },
    });
    return { message: 'Admin account created. You can now log in.', email: user.email };
  }

  async getStats() {
    const [totalUsers, totalWorkers, verifiedWorkers, totalCategories, pendingComplaints] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.workerProfile.count(),
        this.prisma.workerProfile.count({ where: { isVerified: true } }),
        this.prisma.category.count(),
        this.prisma.complaint.count({ where: { status: 'PENDING' } }),
      ]);

    return {
      totalUsers,
      totalWorkers,
      verifiedWorkers,
      totalCategories,
      pendingComplaints,
    };
  }

  async getWorkers(page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [workers, total] = await Promise.all([
      this.prisma.workerProfile.findMany({
        skip,
        take: limit,
        include: {
          user: { select: { id: true, name: true, phone: true, role: true, isActive: true } },
          categories: { include: { category: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.workerProfile.count(),
    ]);
    return { workers, total, page, limit };
  }

  async verifyWorker(dto: WorkerActionDto, adminId?: string, adminName?: string) {
    const worker = await this.prisma.workerProfile.findUnique({
      where: { id: dto.workerId },
      include: { user: { select: { name: true } } },
    });
    if (!worker) throw new NotFoundException('Worker not found');
    const result = await this.prisma.workerProfile.update({
      where: { id: dto.workerId },
      data: { isVerified: true },
      include: { user: { select: { id: true, name: true, phone: true } } },
    });
    if (adminId) await this.logActivity(adminId, adminName || 'Admin', 'VERIFY_WORKER', `worker:${dto.workerId}`, worker.user?.name || '');
    const workerEmail = (result.user as any)?.email;
    if (workerEmail) this.email.sendWorkerVerified(workerEmail, result.user.name || 'Worker').catch(() => {});
    this.notifications.sendToUser(result.user.id, '🎉 Profile Verified!', 'Congratulations! Your HelperNear profile has been verified. You can now receive job requests.', '/app').catch(() => {});
    return result;
  }

  async blockWorker(dto: WorkerActionDto) {
    const worker = await this.prisma.workerProfile.findUnique({
      where: { id: dto.workerId },
      include: { user: true },
    });
    if (!worker) throw new NotFoundException('Worker not found');

    const result = await this.prisma.user.update({
      where: { id: worker.userId },
      data: { isActive: false },
      select: { id: true, name: true, email: true, phone: true, isActive: true },
    });
    if (result.email) this.email.sendWorkerBlocked(result.email, result.name || 'Worker', dto.reason || 'Policy violation').catch(() => {});
    this.notifications.sendToUser(result.id, 'Account Suspended', `Your HelperNear account has been suspended. Reason: ${dto.reason || 'Policy violation'}.`).catch(() => {});
    return result;
  }

  async getUsers(page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          phone: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count(),
    ]);
    return { users, total, page, limit };
  }

  async toggleUserActive(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return this.prisma.user.update({
      where: { id: userId },
      data: { isActive: !user.isActive },
      select: { id: true, name: true, phone: true, isActive: true },
    });
  }

  // ── Activity log helper ──
  async logActivity(adminId: string, adminName: string, action: string, target?: string, details?: string) {
    try {
      await this.prisma.activityLog.create({ data: { adminId, adminName, action, target, details } });
    } catch {}
  }

  async getActivityLogs(page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [logs, total] = await Promise.all([
      this.prisma.activityLog.findMany({ skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.activityLog.count(),
    ]);
    return { logs, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ── Worker profile edit (admin) ──
  async adminEditWorker(workerId: string, dto: {
    bio?: string; experienceYears?: number; priceRange?: string;
    photoUrl?: string; isVerified?: boolean; status?: string; categoryIds?: string[];
  }) {
    const profile = await this.prisma.workerProfile.findUnique({ where: { id: workerId } });
    if (!profile) throw new NotFoundException('Worker not found');
    const { categoryIds, status, ...rest } = dto;
    if (categoryIds) {
      await this.prisma.workerCategory.deleteMany({ where: { workerId } });
    }
    return this.prisma.workerProfile.update({
      where: { id: workerId },
      data: {
        ...rest,
        ...(status && { status: status as any }),
        ...(categoryIds && { categories: { create: categoryIds.map(cid => ({ categoryId: cid })) } }),
      },
      include: {
        categories: { include: { category: true } },
        user: { select: { id: true, name: true, phone: true, isActive: true } },
      },
    });
  }

  async getComplaints(page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [complaints, total] = await Promise.all([
      this.prisma.complaint.findMany({
        skip,
        take: limit,
        include: {
          reporter: { select: { id: true, name: true, phone: true } },
          worker: {
            include: {
              user: { select: { id: true, name: true, phone: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.complaint.count(),
    ]);
    return { complaints, total, page, limit };
  }

  // ── Complaint status update ──
  async updateComplaintStatus(id: string, status: string, adminNote?: string) {
    const complaint = await this.prisma.complaint.findUnique({ where: { id } });
    if (!complaint) throw new NotFoundException('Complaint not found');
    const resolvedAt = status === 'RESOLVED' ? new Date() : undefined;
    const result = await this.prisma.complaint.update({
      where: { id },
      data: {
        status: status as any,
        ...(adminNote !== undefined && { adminNote }),
        ...(resolvedAt && { resolvedAt }),
      },
      include: {
        reporter: { select: { id: true, name: true, email: true, phone: true } },
        worker: { include: { user: { select: { id: true, name: true, email: true } } } },
      },
    });
    const reporterEmail = (result.reporter as any)?.email;
    if (reporterEmail) this.email.sendComplaintResolved(reporterEmail, result.reporter?.name || 'User', status).catch(() => {});
    return result;
  }

  // ── Reviews ──
  async getReviews(page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        skip,
        take: limit,
        include: {
          user: { select: { id: true, name: true, phone: true } },
          worker: { include: { user: { select: { id: true, name: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.review.count(),
    ]);
    return { reviews, total, page, limit };
  }

  async deleteReview(id: string) {
    const existing = await this.prisma.review.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Review not found');
    await this.prisma.review.delete({ where: { id } });
    return { deleted: true };
  }

  // ── Dashboard trends (last 7 days signups) ──
  async getTrends() {
    const days = 7;
    const results: { date: string; users: number; workers: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const start = new Date();
      start.setDate(start.getDate() - i);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setHours(23, 59, 59, 999);
      const [users, workers] = await Promise.all([
        this.prisma.user.count({ where: { createdAt: { gte: start, lte: end } } }),
        this.prisma.workerProfile.count({ where: { createdAt: { gte: start, lte: end } } }),
      ]);
      results.push({
        date: start.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
        users,
        workers,
      });
    }
    return results;
  }

  // ── Complaints trend (last 7 days) ──
  async getComplaintsTrends() {
    const days = 7;
    const results: { date: string; complaints: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const start = new Date();
      start.setDate(start.getDate() - i);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setHours(23, 59, 59, 999);
      const complaints = await this.prisma.complaint.count({
        where: { createdAt: { gte: start, lte: end } },
      });
      results.push({
        date: start.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
        complaints,
      });
    }
    return results;
  }

  // ── Active workers by category ──
  async getWorkersByCategory() {
    const categories = await this.prisma.category.findMany({
      include: {
        workers: {
          include: { worker: { select: { status: true, isVerified: true } } },
        },
      },
      orderBy: { name: 'asc' },
    });
    return categories.map(cat => ({
      name: cat.name,
      total: cat.workers.length,
      active: cat.workers.filter(w => w.worker.status !== 'OFFLINE').length,
      verified: cat.workers.filter(w => w.worker.isVerified).length,
    }));
  }

  // ── Banners ──
  async getBanners() {
    return this.prisma.banner.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }] });
  }

  async createBanner(dto: { title: string; subtitle?: string; imageUrl?: string; linkUrl?: string; sortOrder?: number }) {
    return this.prisma.banner.create({ data: { ...dto, sortOrder: dto.sortOrder ?? 0 } });
  }

  async updateBanner(id: string, dto: { title?: string; subtitle?: string; imageUrl?: string; linkUrl?: string; isActive?: boolean; sortOrder?: number }) {
    const existing = await this.prisma.banner.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Banner not found');
    return this.prisma.banner.update({ where: { id }, data: dto });
  }

  async deleteBanner(id: string) {
    const existing = await this.prisma.banner.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Banner not found');
    await this.prisma.banner.delete({ where: { id } });
    return { deleted: true };
  }

  // ── Testimonials ──
  async getTestimonials() {
    return this.prisma.testimonial.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }] });
  }

  async createTestimonial(dto: { name: string; role?: string; quote: string; rating?: number; photoUrl?: string; sortOrder?: number; translations?: Record<string, any> }) {
    return this.prisma.testimonial.create({ data: { ...dto, rating: dto.rating ?? 5, sortOrder: dto.sortOrder ?? 0 } });
  }

  async updateTestimonial(id: string, dto: { name?: string; role?: string; quote?: string; rating?: number; photoUrl?: string; isActive?: boolean; sortOrder?: number; translations?: Record<string, any> }) {
    const existing = await this.prisma.testimonial.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Testimonial not found');
    return this.prisma.testimonial.update({ where: { id }, data: dto });
  }

  async deleteTestimonial(id: string) {
    const existing = await this.prisma.testimonial.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Testimonial not found');
    await this.prisma.testimonial.delete({ where: { id } });
    return { deleted: true };
  }

  // ── FAQs ──
  async getFaqs() {
    return this.prisma.faq.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }] });
  }

  async createFaq(dto: { question: string; answer: string; sortOrder?: number; translations?: Record<string, any> }) {
    return this.prisma.faq.create({ data: { ...dto, sortOrder: dto.sortOrder ?? 0 } });
  }

  async updateFaq(id: string, dto: { question?: string; answer?: string; isActive?: boolean; sortOrder?: number; translations?: Record<string, any> }) {
    const existing = await this.prisma.faq.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('FAQ not found');
    return this.prisma.faq.update({ where: { id }, data: dto });
  }

  async deleteFaq(id: string) {
    const existing = await this.prisma.faq.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('FAQ not found');
    await this.prisma.faq.delete({ where: { id } });
    return { deleted: true };
  }

  // ── Admin profile ──
  async updateAdminProfile(adminId: string, dto: { name?: string }) {
    const user = await this.prisma.user.findUnique({ where: { id: adminId } });
    if (!user || user.role !== 'ADMIN') throw new NotFoundException('Admin not found');
    return this.prisma.user.update({
      where: { id: adminId },
      data: { name: dto.name },
      select: { id: true, name: true, email: true, role: true },
    });
  }

  async changeAdminPassword(adminId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: adminId } });
    if (!user || user.role !== 'ADMIN') throw new NotFoundException('Admin not found');
    if (!user.passwordHash) throw new BadRequestException('No password set');
    const valid = await (await import('bcryptjs')).compare(currentPassword, user.passwordHash);
    if (!valid) throw new BadRequestException('Current password is incorrect');
    const hash = await (await import('bcryptjs')).hash(newPassword, 10);
    await this.prisma.user.update({ where: { id: adminId }, data: { passwordHash: hash } });
    return { updated: true };
  }

  // ── Worker rating analytics ──
  async getWorkerRatingAnalytics(workerId: string) {
    const profile = await this.prisma.workerProfile.findUnique({
      where: { id: workerId },
      include: { user: { select: { name: true } }, reviews: { orderBy: { createdAt: 'asc' } } },
    });
    if (!profile) throw new NotFoundException('Worker not found');
    const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    profile.reviews.forEach(r => { if (dist[r.rating] !== undefined) dist[r.rating]++; });
    const avg = profile.reviews.length ? profile.reviews.reduce((s, r) => s + r.rating, 0) / profile.reviews.length : 0;
    return { workerName: profile.user?.name, total: profile.reviews.length, average: avg, distribution: dist, recent: profile.reviews.slice(-10).reverse() };
  }

  // ── Announcements ──
  async getAnnouncements() {
    return this.prisma.announcement.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async createAnnouncement(dto: { title: string; message: string; type?: string; targetAudience?: string; translations?: Record<string, any> }) {
    return this.prisma.announcement.create({ data: { title: dto.title, message: dto.message, type: dto.type || 'INFO', targetAudience: dto.targetAudience || 'ALL', translations: dto.translations } });
  }

  async updateAnnouncement(id: string, dto: { title?: string; message?: string; type?: string; targetAudience?: string; isActive?: boolean; translations?: Record<string, any> }) {
    const ex = await this.prisma.announcement.findUnique({ where: { id } });
    if (!ex) throw new NotFoundException('Announcement not found');
    return this.prisma.announcement.update({ where: { id }, data: dto });
  }

  async deleteAnnouncement(id: string) {
    const ex = await this.prisma.announcement.findUnique({ where: { id } });
    if (!ex) throw new NotFoundException('Announcement not found');
    await this.prisma.announcement.delete({ where: { id } });
    return { deleted: true };
  }

  // ── Coupons ──
  async getCoupons() {
    return this.prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async createCoupon(dto: { code: string; description?: string; discountType?: string; discountValue: number; maxUses?: number; expiresAt?: string }) {
    const existing = await this.prisma.coupon.findUnique({ where: { code: dto.code.toUpperCase() } });
    if (existing) throw new BadRequestException('Coupon code already exists');
    return this.prisma.coupon.create({
      data: {
        code: dto.code.toUpperCase(),
        description: dto.description,
        discountType: dto.discountType || 'PERCENTAGE',
        discountValue: dto.discountValue,
        maxUses: dto.maxUses ?? null,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
    });
  }

  async updateCoupon(id: string, dto: { description?: string; discountType?: string; discountValue?: number; maxUses?: number; expiresAt?: string; isActive?: boolean }) {
    const ex = await this.prisma.coupon.findUnique({ where: { id } });
    if (!ex) throw new NotFoundException('Coupon not found');
    return this.prisma.coupon.update({
      where: { id },
      data: { ...dto, expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined },
    });
  }

  async deleteCoupon(id: string) {
    const ex = await this.prisma.coupon.findUnique({ where: { id } });
    if (!ex) throw new NotFoundException('Coupon not found');
    await this.prisma.coupon.delete({ where: { id } });
    return { deleted: true };
  }

  // ── Notification Templates ──
  async getNotificationTemplates() {
    return this.prisma.notificationTemplate.findMany({ orderBy: { name: 'asc' } });
  }

  async upsertNotificationTemplate(dto: { name: string; type?: string; subject?: string; body: string; variables?: string; translations?: Record<string, any> }) {
    return this.prisma.notificationTemplate.upsert({
      where: { name: dto.name },
      create: { ...dto, type: dto.type || 'SMS' },
      update: { type: dto.type, subject: dto.subject, body: dto.body, variables: dto.variables, translations: dto.translations },
    });
  }

  async deleteNotificationTemplate(id: string) {
    const ex = await this.prisma.notificationTemplate.findUnique({ where: { id } });
    if (!ex) throw new NotFoundException('Template not found');
    await this.prisma.notificationTemplate.delete({ where: { id } });
    return { deleted: true };
  }

  // ── Settings ──
  async getSettings() {
    return this.prisma.setting.findMany({ orderBy: [{ group: 'asc' }, { key: 'asc' }] });
  }

  async updateSettings(updates: { key: string; value: string }[]) {
    const results = await Promise.all(
      updates.map(({ key, value }) =>
        this.prisma.setting.updateMany({ where: { key }, data: { value } }),
      ),
    );
    return { updated: results.reduce((sum, r) => sum + r.count, 0) };
  }

  async getSettingByKey(key: string) {
    const s = await this.prisma.setting.findUnique({ where: { key } });
    if (!s) throw new NotFoundException(`Setting "${key}" not found`);
    return s;
  }

  async upsertLogoSetting(key: string, value: string) {
    return this.prisma.setting.upsert({
      where: { key },
      create: { key, value, label: key.replace(/_/g, ' '), group: 'branding' },
      update: { value },
    });
  }

  // ── Pages ──
  async getPages() {
    return this.prisma.page.findMany({ orderBy: { createdAt: 'asc' } });
  }

  async upsertPage(dto: { slug: string; title: string; content: string; isActive?: boolean; translations?: Record<string, any> }) {
    return this.prisma.page.upsert({
      where: { slug: dto.slug },
      update: { title: dto.title, content: dto.content, isActive: dto.isActive ?? true, translations: dto.translations },
      create: { slug: dto.slug, title: dto.title, content: dto.content, isActive: dto.isActive ?? true, translations: dto.translations },
    });
  }

  async deletePage(id: string) {
    const p = await this.prisma.page.findUnique({ where: { id } });
    if (!p) throw new NotFoundException('Page not found');
    await this.prisma.page.delete({ where: { id } });
    return { deleted: true };
  }

  // ── Blog ──
  async getBlogPosts() {
    return this.prisma.blogPost.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async createBlogPost(dto: { slug: string; title: string; excerpt?: string; content: string; coverImage?: string; author?: string; isPublished?: boolean; translations?: Record<string, any> }) {
    const existing = await this.prisma.blogPost.findUnique({ where: { slug: dto.slug } });
    if (existing) throw new BadRequestException('Slug already exists');
    return this.prisma.blogPost.create({
      data: { ...dto, publishedAt: dto.isPublished ? new Date() : null },
    });
  }

  async updateBlogPost(id: string, dto: { slug?: string; title?: string; excerpt?: string; content?: string; coverImage?: string; author?: string; isPublished?: boolean; translations?: Record<string, any> }) {
    const post = await this.prisma.blogPost.findUnique({ where: { id } });
    if (!post) throw new NotFoundException('Post not found');
    const publishedAt = dto.isPublished && !post.isPublished ? new Date() : post.publishedAt;
    return this.prisma.blogPost.update({ where: { id }, data: { ...dto, publishedAt } });
  }

  async deleteBlogPost(id: string) {
    const post = await this.prisma.blogPost.findUnique({ where: { id } });
    if (!post) throw new NotFoundException('Post not found');
    await this.prisma.blogPost.delete({ where: { id } });
    return { deleted: true };
  }

  // ── Contact Submissions ──
  async getContactSubmissions(page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.contactSubmission.findMany({ skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.contactSubmission.count(),
    ]);
    return { items, total, page, totalPages: Math.ceil(total / limit) };
  }

  async markContactRead(id: string, isRead: boolean) {
    const item = await this.prisma.contactSubmission.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Submission not found');
    return this.prisma.contactSubmission.update({ where: { id }, data: { isRead } });
  }

  async deleteContactSubmission(id: string) {
    const item = await this.prisma.contactSubmission.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Submission not found');
    await this.prisma.contactSubmission.delete({ where: { id } });
    return { deleted: true };
  }
}
