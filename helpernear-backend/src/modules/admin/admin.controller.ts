import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import * as fs from 'fs';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AdminService } from './admin.service';
import { WorkerActionDto } from './dto/worker-action.dto';
import { AdminLoginDto } from './dto/admin-login.dto';

@ApiTags('Admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('login')
  async login(@Body() dto: AdminLoginDto) {
    const data = await this.adminService.adminLogin(dto.email, dto.password);
    return { message: 'Login successful', data };
  }

  @Post('setup')
  async setup(@Body() body: { name: string; email: string; password: string }) {
    const data = await this.adminService.adminSetup(body.name, body.email, body.password);
    return { message: data.message, data };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get('stats')
  async getStats() {
    const data = await this.adminService.getStats();
    return { message: 'Stats retrieved successfully', data };
  }

  @ApiQuery({ name: 'page', type: Number, required: false })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiQuery({ name: 'limit', type: Number, required: false })
  @Get('workers')
  async getWorkers(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    const data = await this.adminService.getWorkers(
      parseInt(page),
      parseInt(limit),
    );
    return { message: 'Workers retrieved successfully', data };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch('verify-worker')
  async verifyWorker(@Body() dto: WorkerActionDto, @Request() req: any) {
    const data = await this.adminService.verifyWorker(dto, req.user?.sub, req.user?.name);
    return { message: 'Worker verified successfully', data };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post('verify-workers/bulk')
  async bulkVerifyWorkers(@Body() body: { workerIds: string[] }, @Request() req: any) {
    const results = await Promise.all(
      body.workerIds.map(id => this.adminService.verifyWorker({ workerId: id }, req.user?.sub, req.user?.name))
    );
    return { message: `${results.length} workers verified`, data: results };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch('workers/:id')
  async editWorker(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    const data = await this.adminService.adminEditWorker(id, body);
    await this.adminService.logActivity(req.user?.sub, req.user?.name || 'Admin', 'EDIT_WORKER', `worker:${id}`, JSON.stringify(Object.keys(body)));
    return { message: 'Worker profile updated', data };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get('activity-logs')
  async getActivityLogs(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '50',
  ) {
    const data = await this.adminService.getActivityLogs(parseInt(page), parseInt(limit));
    return { message: 'Activity logs retrieved', data };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get('search')
  async globalSearch(@Query('q') q: string) {
    if (!q || q.trim().length < 2) return { message: 'Query too short', data: { workers: [], users: [] } };
    const term = q.trim().toLowerCase();
    const [workers, users] = await Promise.all([
      this.adminService.getWorkers(1, 200),
      this.adminService.getUsers(1, 200),
    ]);
    const matchedWorkers = (workers.workers).filter(w =>
      (w.user?.name || '').toLowerCase().includes(term) ||
      (w.user?.phone || '').toLowerCase().includes(term)
    ).slice(0, 8);
    const matchedUsers = (users.users).filter(u =>
      (u.name || '').toLowerCase().includes(term) ||
      (u.phone || '').toLowerCase().includes(term)
    ).slice(0, 8);
    return { message: 'Search results', data: { workers: matchedWorkers, users: matchedUsers } };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch('block-worker')
  async blockWorker(@Body() dto: WorkerActionDto) {
    const data = await this.adminService.blockWorker(dto);
    return { message: 'Worker blocked successfully', data };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiQuery({ name: 'page', type: Number, required: false })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  @Get('users')
  async getUsers(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    const data = await this.adminService.getUsers(
      parseInt(page),
      parseInt(limit),
    );
    return { message: 'Users retrieved successfully', data };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch('users/:id/toggle-active')
  async toggleUserActive(@Param('id') id: string) {
    const data = await this.adminService.toggleUserActive(id);
    return { message: 'User status updated', data };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiQuery({ name: 'page', type: Number, required: false })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  @Get('complaints')
  async getComplaints(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    const data = await this.adminService.getComplaints(
      parseInt(page),
      parseInt(limit),
    );
    return { message: 'Complaints retrieved successfully', data };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch('complaints/:id')
  async updateComplaintStatus(
    @Param('id') id: string,
    @Body() body: { status: string; adminNote?: string },
    @Request() req: any,
  ) {
    const data = await this.adminService.updateComplaintStatus(id, body.status, body.adminNote);
    await this.adminService.logActivity(req.user?.sub, req.user?.name || 'Admin', 'UPDATE_COMPLAINT', `complaint:${id}`, body.status);
    return { message: 'Complaint updated', data };
  }

  // ── Reviews ──
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiQuery({ name: 'page', type: Number, required: false })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  @Get('reviews')
  async getReviews(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '50',
  ) {
    const data = await this.adminService.getReviews(parseInt(page), parseInt(limit));
    return { message: 'Reviews retrieved', data };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Delete('reviews/:id')
  async deleteReview(@Param('id') id: string, @Request() req: any) {
    const data = await this.adminService.deleteReview(id);
    await this.adminService.logActivity(req.user?.sub, req.user?.name || 'Admin', 'DELETE_REVIEW', `review:${id}`);
    return { message: 'Review deleted', data };
  }

  // ── Trends ──
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get('stats/trends')
  async getTrends() {
    const data = await this.adminService.getTrends();
    return { message: 'Trends retrieved', data };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get('stats/complaints-trends')
  async getComplaintsTrends() {
    const data = await this.adminService.getComplaintsTrends();
    return { message: 'Complaints trends retrieved', data };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get('stats/workers-by-category')
  async getWorkersByCategory() {
    const data = await this.adminService.getWorkersByCategory();
    return { message: 'Workers by category retrieved', data };
  }

  // ── Banners ──
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get('banners')
  async getBanners() {
    const data = await this.adminService.getBanners();
    return { message: 'Banners retrieved', data };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post('banners')
  async createBanner(@Body() body: { title: string; subtitle?: string; imageUrl?: string; linkUrl?: string; sortOrder?: number }) {
    const data = await this.adminService.createBanner(body);
    return { message: 'Banner created', data };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch('banners/:id')
  async updateBanner(@Param('id') id: string, @Body() body: { title?: string; subtitle?: string; imageUrl?: string; linkUrl?: string; isActive?: boolean; sortOrder?: number }) {
    const data = await this.adminService.updateBanner(id, body);
    return { message: 'Banner updated', data };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Delete('banners/:id')
  async deleteBanner(@Param('id') id: string) {
    const data = await this.adminService.deleteBanner(id);
    return { message: 'Banner deleted', data };
  }

  // ── Testimonials ──
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get('testimonials')
  async getTestimonials() {
    const data = await this.adminService.getTestimonials();
    return { message: 'Testimonials retrieved', data };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post('testimonials')
  async createTestimonial(@Body() body: { name: string; role?: string; quote: string; rating?: number; photoUrl?: string; sortOrder?: number }) {
    const data = await this.adminService.createTestimonial(body);
    return { message: 'Testimonial created', data };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch('testimonials/:id')
  async updateTestimonial(@Param('id') id: string, @Body() body: { name?: string; role?: string; quote?: string; rating?: number; photoUrl?: string; isActive?: boolean; sortOrder?: number }) {
    const data = await this.adminService.updateTestimonial(id, body);
    return { message: 'Testimonial updated', data };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Delete('testimonials/:id')
  async deleteTestimonial(@Param('id') id: string) {
    const data = await this.adminService.deleteTestimonial(id);
    return { message: 'Testimonial deleted', data };
  }

  // ── FAQs ──
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get('faqs')
  async getFaqs() {
    const data = await this.adminService.getFaqs();
    return { message: 'FAQs retrieved', data };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post('faqs')
  async createFaq(@Body() body: { question: string; answer: string; sortOrder?: number }) {
    const data = await this.adminService.createFaq(body);
    return { message: 'FAQ created', data };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch('faqs/:id')
  async updateFaq(@Param('id') id: string, @Body() body: { question?: string; answer?: string; isActive?: boolean; sortOrder?: number }) {
    const data = await this.adminService.updateFaq(id, body);
    return { message: 'FAQ updated', data };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Delete('faqs/:id')
  async deleteFaq(@Param('id') id: string) {
    const data = await this.adminService.deleteFaq(id);
    return { message: 'FAQ deleted', data };
  }

  // ── Admin Profile ──
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch('profile')
  async updateProfile(@Body() body: { name?: string }, @Request() req: any) {
    const data = await this.adminService.updateAdminProfile(req.user.sub, body);
    return { message: 'Profile updated', data };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post('change-password')
  async changePassword(@Body() body: { currentPassword: string; newPassword: string }, @Request() req: any) {
    const data = await this.adminService.changeAdminPassword(req.user.sub, body.currentPassword, body.newPassword);
    await this.adminService.logActivity(req.user.sub, req.user?.name || 'Admin', 'CHANGE_PASSWORD');
    return { message: 'Password changed successfully', data };
  }

  // ── Worker Rating Analytics ──
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get('workers/:id/analytics')
  async getWorkerAnalytics(@Param('id') id: string) {
    const data = await this.adminService.getWorkerRatingAnalytics(id);
    return { message: 'Analytics retrieved', data };
  }

  // ── Announcements ──
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get('announcements')
  async getAnnouncements() {
    const data = await this.adminService.getAnnouncements();
    return { message: 'Announcements retrieved', data };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post('announcements')
  async createAnnouncement(@Body() body: { title: string; message: string; type?: string; targetAudience?: string }, @Request() req: any) {
    const data = await this.adminService.createAnnouncement(body);
    await this.adminService.logActivity(req.user.sub, req.user?.name || 'Admin', 'CREATE_ANNOUNCEMENT', undefined, body.title);
    return { message: 'Announcement created', data };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch('announcements/:id')
  async updateAnnouncement(@Param('id') id: string, @Body() body: any) {
    const data = await this.adminService.updateAnnouncement(id, body);
    return { message: 'Announcement updated', data };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Delete('announcements/:id')
  async deleteAnnouncement(@Param('id') id: string, @Request() req: any) {
    const data = await this.adminService.deleteAnnouncement(id);
    await this.adminService.logActivity(req.user.sub, req.user?.name || 'Admin', 'DELETE_ANNOUNCEMENT', `announcement:${id}`);
    return { message: 'Announcement deleted', data };
  }

  // ── Coupons ──
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get('coupons')
  async getCoupons() {
    const data = await this.adminService.getCoupons();
    return { message: 'Coupons retrieved', data };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post('coupons')
  async createCoupon(@Body() body: any, @Request() req: any) {
    const data = await this.adminService.createCoupon(body);
    await this.adminService.logActivity(req.user.sub, req.user?.name || 'Admin', 'CREATE_COUPON', undefined, body.code);
    return { message: 'Coupon created', data };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch('coupons/:id')
  async updateCoupon(@Param('id') id: string, @Body() body: any) {
    const data = await this.adminService.updateCoupon(id, body);
    return { message: 'Coupon updated', data };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Delete('coupons/:id')
  async deleteCoupon(@Param('id') id: string, @Request() req: any) {
    const data = await this.adminService.deleteCoupon(id);
    await this.adminService.logActivity(req.user.sub, req.user?.name || 'Admin', 'DELETE_COUPON', `coupon:${id}`);
    return { message: 'Coupon deleted', data };
  }

  // ── Notification Templates ──
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get('notification-templates')
  async getNotificationTemplates() {
    const data = await this.adminService.getNotificationTemplates();
    return { message: 'Templates retrieved', data };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post('notification-templates')
  async upsertNotificationTemplate(@Body() body: any, @Request() req: any) {
    const data = await this.adminService.upsertNotificationTemplate(body);
    await this.adminService.logActivity(req.user.sub, req.user?.name || 'Admin', 'UPSERT_TEMPLATE', undefined, body.name);
    return { message: 'Template saved', data };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Delete('notification-templates/:id')
  async deleteNotificationTemplate(@Param('id') id: string) {
    const data = await this.adminService.deleteNotificationTemplate(id);
    return { message: 'Template deleted', data };
  }

  // ── Settings ──
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get('settings')
  async getSettings() {
    const data = await this.adminService.getSettings();
    return { message: 'Settings retrieved', data };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Put('settings')
  async updateSettings(@Body() body: { updates: { key: string; value: string }[] }, @Request() req: any) {
    const data = await this.adminService.updateSettings(body.updates || []);
    await this.adminService.logActivity(req.user.sub, req.user?.name || 'Admin', 'UPDATE_SETTINGS', undefined, `${body.updates?.length} keys`);
    return { message: 'Settings updated', data };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post('settings/upload-logo')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: (_req, _file, cb) => {
        const dir = join(process.cwd(), 'uploads', 'logos');
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
      },
      filename: (req, file, cb) => {
        const type = ((req.body as any).type || 'logo').replace(/[^a-z-]/g, '');
        cb(null, `${type}${extname(file.originalname)}`);
      },
    }),
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (/\.(svg|png|jpg|jpeg|webp)$/i.test(file.originalname)) {
        cb(null, true);
      } else {
        cb(new BadRequestException('Only image files are allowed'), false);
      }
    },
  }))
  async uploadLogo(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { type: string },
    @Request() req: any,
  ) {
    const type = (body.type || 'logo').replace(/[^a-z-]/g, '');
    const keyMap: Record<string, string> = {
      logo: 'logo_url',
      'logo-light': 'logo_light_url',
      'logo-icon': 'logo_icon_url',
    };
    const key = keyMap[type] ?? 'logo_url';
    const url = `/uploads/logos/${file.filename}`;
    await this.adminService.upsertLogoSetting(key, url);
    await this.adminService.logActivity(req.user.sub, req.user?.name || 'Admin', 'UPDATE_SETTINGS', undefined, `Uploaded ${type}`);
    return { message: 'Logo uploaded', data: { url } };
  }

  // ── Pages ──
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get('pages')
  async getPages() {
    const data = await this.adminService.getPages();
    return { message: 'Pages retrieved', data };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post('pages')
  async upsertPage(@Body() body: { slug: string; title: string; content: string; isActive?: boolean }, @Request() req: any) {
    const data = await this.adminService.upsertPage(body);
    await this.adminService.logActivity(req.user.sub, req.user?.name || 'Admin', 'UPSERT_PAGE', body.slug);
    return { message: 'Page saved', data };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Delete('pages/:id')
  async deletePage(@Param('id') id: string, @Request() req: any) {
    const data = await this.adminService.deletePage(id);
    await this.adminService.logActivity(req.user.sub, req.user?.name || 'Admin', 'DELETE_PAGE', id);
    return { message: 'Page deleted', data };
  }

  // ── Blog ──
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get('blog')
  async getBlogPosts() {
    const data = await this.adminService.getBlogPosts();
    return { message: 'Blog posts retrieved', data };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post('blog')
  async createBlogPost(@Body() body: any, @Request() req: any) {
    const data = await this.adminService.createBlogPost(body);
    await this.adminService.logActivity(req.user.sub, req.user?.name || 'Admin', 'CREATE_BLOG_POST', body.slug);
    return { message: 'Blog post created', data };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch('blog/:id')
  async updateBlogPost(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    const data = await this.adminService.updateBlogPost(id, body);
    await this.adminService.logActivity(req.user.sub, req.user?.name || 'Admin', 'UPDATE_BLOG_POST', id);
    return { message: 'Blog post updated', data };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Delete('blog/:id')
  async deleteBlogPost(@Param('id') id: string, @Request() req: any) {
    const data = await this.adminService.deleteBlogPost(id);
    await this.adminService.logActivity(req.user.sub, req.user?.name || 'Admin', 'DELETE_BLOG_POST', id);
    return { message: 'Blog post deleted', data };
  }

  // ── Contact Submissions ──
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get('contact')
  async getContactSubmissions(@Query('page') page = '1', @Query('limit') limit = '20') {
    const data = await this.adminService.getContactSubmissions(parseInt(page), parseInt(limit));
    return { message: 'Contact submissions retrieved', data };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch('contact/:id/read')
  async markContactRead(@Param('id') id: string, @Body() body: { isRead: boolean }) {
    const data = await this.adminService.markContactRead(id, body.isRead ?? true);
    return { message: 'Updated', data };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Delete('contact/:id')
  async deleteContactSubmission(@Param('id') id: string, @Request() req: any) {
    const data = await this.adminService.deleteContactSubmission(id);
    await this.adminService.logActivity(req.user.sub, req.user?.name || 'Admin', 'DELETE_CONTACT', id);
    return { message: 'Deleted', data };
  }
}
