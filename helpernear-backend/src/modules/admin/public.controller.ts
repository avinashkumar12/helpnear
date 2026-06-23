import { Body, Controller, Get, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../email/email.service';

function applyLang<T extends { translations?: any }>(item: T, lang: string): Omit<T, 'translations'> {
  if (!lang || lang === 'en' || !item.translations) return item;
  const tr = (typeof item.translations === 'string' ? JSON.parse(item.translations) : item.translations) as Record<string, any>;
  const langTr = tr[lang];
  if (!langTr) return item;
  return { ...item, ...langTr };
}

function applyLangMany<T extends { translations?: any }>(items: T[], lang: string): Omit<T, 'translations'>[] {
  return items.map(i => applyLang(i, lang));
}

@ApiTags('Public')
@Controller('public')
export class PublicController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  @Get('branding')
  async getBranding() {
    const keys = ['logo_url', 'logo_light_url', 'logo_icon_url'];
    const settings = await this.prisma.setting.findMany({ where: { key: { in: keys } } });
    const map: Record<string, string> = {};
    settings.forEach(s => { map[s.key] = s.value; });
    return {
      message: 'Branding retrieved',
      data: {
        logoUrl: map['logo_url'] || null,
        logoLightUrl: map['logo_light_url'] || null,
        logoIconUrl: map['logo_icon_url'] || null,
      },
    };
  }

  @Get('stats')
  async getStats() {
    const [totalUsers, verifiedWorkers, totalCategories] = await Promise.all([
      this.prisma.user.count({ where: { role: { not: 'ADMIN' }, isActive: true } }),
      this.prisma.workerProfile.count({ where: { isVerified: true } }),
      this.prisma.category.count(),
    ]);
    return { message: 'Stats retrieved', data: { totalUsers, verifiedWorkers, totalCategories } };
  }

  @Get('banners')
  async getBanners() {
    const data = await this.prisma.banner.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
    return { message: 'Banners retrieved', data };
  }

  @Get('testimonials')
  async getTestimonials(@Query('lang') lang = 'en') {
    const data = await this.prisma.testimonial.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
    return { message: 'Testimonials retrieved', data: applyLangMany(data, lang) };
  }

  @Get('announcements')
  async getAnnouncements(@Query('lang') lang = 'en') {
    const data = await this.prisma.announcement.findMany({
      where: { isActive: true, targetAudience: { in: ['ALL', 'CUSTOMERS'] } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    return { message: 'Announcements retrieved', data: applyLangMany(data, lang) };
  }

  @Get('faqs')
  async getFaqs(@Query('lang') lang = 'en') {
    const data = await this.prisma.faq.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
    return { message: 'FAQs retrieved', data: applyLangMany(data, lang) };
  }

  @Get('pages')
  async getPages(@Query('lang') lang = 'en') {
    const data = await this.prisma.page.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    return { message: 'Pages retrieved', data: applyLangMany(data, lang).map(({ slug, title }: any) => ({ slug, title })) };
  }

  @Get('pages/:slug')
  async getPage(@Param('slug') slug: string, @Query('lang') lang = 'en') {
    const page = await this.prisma.page.findUnique({ where: { slug } });
    if (!page || !page.isActive) throw new NotFoundException('Page not found');
    return { message: 'Page retrieved', data: applyLang(page, lang) };
  }

  @Get('blog')
  async getBlogPosts(@Query('lang') lang = 'en', @Query('page') page = '1', @Query('limit') limit = '9') {
    const take = Math.min(50, Math.max(1, parseInt(limit) || 9));
    const skip = (Math.max(1, parseInt(page) || 1) - 1) * take;
    const [posts, total] = await Promise.all([
      this.prisma.blogPost.findMany({
        where: { isPublished: true },
        orderBy: { publishedAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.blogPost.count({ where: { isPublished: true } }),
    ]);
    const translated = applyLangMany(posts, lang).map(({ id, slug, title, excerpt, coverImage, author, publishedAt, createdAt }: any) =>
      ({ id, slug, title, excerpt, coverImage, author, publishedAt, createdAt }));
    return { message: 'Blog posts retrieved', data: { posts: translated, total, page: parseInt(page) || 1, limit: take } };
  }

  @Get('blog/:slug')
  async getBlogPost(@Param('slug') slug: string, @Query('lang') lang = 'en') {
    const post = await this.prisma.blogPost.findUnique({ where: { slug } });
    if (!post || !post.isPublished) throw new NotFoundException('Post not found');
    return { message: 'Blog post retrieved', data: applyLang(post, lang) };
  }

  @Get('fcm-config')
  async getFcmConfig() {
    const keys = ['fcm_api_key', 'fcm_auth_domain', 'fcm_project_id', 'fcm_messaging_sender_id', 'fcm_app_id', 'fcm_vapid_key'];
    const settings = await this.prisma.setting.findMany({ where: { key: { in: keys } } });
    const map: Record<string, string> = {};
    settings.forEach(s => { map[s.key] = s.value; });
    return {
      message: 'FCM config retrieved',
      data: {
        apiKey: map['fcm_api_key'] || null,
        authDomain: map['fcm_auth_domain'] || null,
        projectId: map['fcm_project_id'] || null,
        messagingSenderId: map['fcm_messaging_sender_id'] || null,
        appId: map['fcm_app_id'] || null,
        vapidKey: map['fcm_vapid_key'] || null,
      },
    };
  }

  @Get('workers/:id')
  async getWorkerProfile(@Param('id') id: string) {
    const profile = await this.prisma.workerProfile.findUnique({
      where: { id },
      include: {
        user: { select: { name: true, phone: true } },
        categories: { include: { category: { select: { id: true, name: true, icon: true } } } },
        reviews: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: { user: { select: { name: true } } },
        },
      },
    });
    if (!profile || !profile.isVerified) throw new NotFoundException('Worker not found');
    return { message: 'Worker profile retrieved', data: profile };
  }

  // Max 5 contact submissions per 15 minutes
  @Throttle({ default: { ttl: 900000, limit: 5 } })
  @Post('contact')
  async submitContact(@Body() body: { name: string; email: string; phone?: string; subject: string; message: string }) {
    const { name, email, phone, subject, message } = body;
    if (!name || !email || !subject || !message) {
      throw new NotFoundException('All fields required');
    }
    const data = await this.prisma.contactSubmission.create({ data: { name, email, phone, subject, message } });
    this.email.sendContactFormAck(email, name).catch(() => {});
    return { message: 'Message received! We will get back to you soon.', data: { id: data.id } };
  }
}
