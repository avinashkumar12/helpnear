import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly prisma: PrismaService) {}

  private async getTransporter() {
    const settings = await this.prisma.setting.findMany({
      where: { key: { in: ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_from'] } },
    });
    const map: Record<string, string> = {};
    settings.forEach(s => { map[s.key] = s.value; });

    if (!map['smtp_host'] || !map['smtp_user'] || !map['smtp_pass']) return null;

    return nodemailer.createTransport({
      host: map['smtp_host'],
      port: parseInt(map['smtp_port'] || '587'),
      secure: map['smtp_port'] === '465',
      auth: { user: map['smtp_user'], pass: map['smtp_pass'] },
    });
  }

  async sendMail(to: string, subject: string, html: string) {
    const transporter = await this.getTransporter();
    if (!transporter) {
      this.logger.warn(`[EMAIL SKIP] SMTP not configured. To: ${to} | Subject: ${subject}`);
      return;
    }
    const settings = await this.prisma.setting.findMany({
      where: { key: { in: ['smtp_from', 'smtp_user'] } },
    });
    const map: Record<string, string> = {};
    settings.forEach(s => { map[s.key] = s.value; });
    const from = map['smtp_from'] || map['smtp_user'];

    try {
      await transporter.sendMail({ from, to, subject, html });
      this.logger.log(`Email sent to ${to}: ${subject}`);
    } catch (err) {
      this.logger.error(`Email failed to ${to}: ${err.message}`);
    }
  }

  // ── Pre-built email templates ──────────────────

  async sendWorkerVerified(to: string, name: string) {
    await this.sendMail(to, '🎉 Your HelperNear profile is verified!', `
      <h2>Congratulations, ${name}!</h2>
      <p>Your worker profile on <strong>HelperNear</strong> has been verified.</p>
      <p>Customers can now find you in nearby searches. Make sure your status is set to <strong>Available</strong>.</p>
      <br/><p>— The HelperNear Team</p>
    `);
  }

  async sendWorkerBlocked(to: string, name: string, reason: string) {
    await this.sendMail(to, 'HelperNear — Account Update', `
      <h2>Hi ${name},</h2>
      <p>Your HelperNear worker account has been suspended.</p>
      <p><strong>Reason:</strong> ${reason}</p>
      <p>If you believe this is a mistake, please contact our support team.</p>
      <br/><p>— The HelperNear Team</p>
    `);
  }

  async sendComplaintReceived(to: string, workerName: string) {
    await this.sendMail(to, 'HelperNear — Complaint Submitted', `
      <h2>Hi ${workerName},</h2>
      <p>A complaint has been submitted against your profile on HelperNear.</p>
      <p>Our team will review it within 24 hours. If any action is taken, you will be notified.</p>
      <br/><p>— The HelperNear Team</p>
    `);
  }

  async sendComplaintResolved(to: string, userName: string, status: string) {
    await this.sendMail(to, 'HelperNear — Complaint Update', `
      <h2>Hi ${userName},</h2>
      <p>Your complaint has been updated to: <strong>${status}</strong>.</p>
      <p>Thank you for helping us keep HelperNear safe and reliable.</p>
      <br/><p>— The HelperNear Team</p>
    `);
  }

  async sendContactFormAck(to: string, name: string) {
    await this.sendMail(to, 'HelperNear — We received your message', `
      <h2>Hi ${name},</h2>
      <p>Thank you for reaching out! We've received your message and will get back to you within 24 hours.</p>
      <br/><p>— The HelperNear Team</p>
    `);
  }
}
