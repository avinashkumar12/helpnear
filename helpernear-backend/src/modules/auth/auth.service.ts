import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import Twilio from 'twilio';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private settings: SettingsService,
  ) {}

  private getTwilioClient() {
    const sid = this.config.get<string>('twilio.accountSid') ?? '';
    const token = this.config.get<string>('twilio.authToken') ?? '';
    return Twilio(sid, token);
  }

  async sendOtp(dto: SendOtpDto) {
    const expiryMinutes = this.config.get<number>('otp.expiryMinutes') ?? 30;
    const maxRetries = this.config.get<number>('otp.maxRetries') ?? 10;

    const recentAttempts = await this.prisma.otpLog.count({
      where: {
        phone: dto.phone,
        createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) },
      },
    });

    if (recentAttempts >= maxRetries) {
      throw new ForbiddenException('Too many OTP requests. Please wait 10 minutes.');
    }

    // Check static OTP setting
    const staticEnabled = await this.settings.getValue('static_otp_enabled');
    const staticOtpValue = await this.settings.getValue('static_otp_value');
    const useStaticOtp = staticEnabled === 'true';
    const otp = useStaticOtp
      ? (staticOtpValue || '8989')
      : Math.floor(100000 + Math.random() * 900000).toString();

    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

    await this.prisma.otpLog.create({
      data: { phone: dto.phone, otp, expiresAt },
    });

    // Resolve Twilio creds: DB settings take priority over env vars
    const dbSid = await this.settings.getValue('twilio_account_sid');
    const dbToken = await this.settings.getValue('twilio_auth_token');
    const dbPhone = await this.settings.getValue('twilio_phone_number');
    const accountSid = dbSid || this.config.get<string>('twilio.accountSid') || '';
    const authToken = dbToken || this.config.get<string>('twilio.authToken') || '';
    const fromPhone = dbPhone || this.config.get<string>('twilio.phoneNumber') || '';

    const isDevMode = useStaticOtp || !accountSid || accountSid === 'your_twilio_account_sid';

    if (!isDevMode) {
      const client = Twilio(accountSid, authToken);
      await client.messages.create({
        body: `Your HelperNear OTP is: ${otp}. Valid for ${expiryMinutes} minutes.`,
        from: fromPhone,
        to: dto.phone,
      });
    } else {
      console.log(`[DEV MODE] OTP for ${dto.phone}: ${otp}`);
    }

    return {
      message: 'OTP sent successfully',
      ...(isDevMode && { devOtp: otp }),
    };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const otpRecord = await this.prisma.otpLog.findFirst({
      where: {
        phone: dto.phone,
        otp: dto.otp,
        used: false,
        expiresAt: { gte: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    await this.prisma.otpLog.update({
      where: { id: otpRecord.id },
      data: { used: true },
    });

    const user = await this.prisma.user.upsert({
      where: { phone: dto.phone },
      create: { phone: dto.phone },
      update: {},
    });

    const tokens = await this.generateTokens(user.id, user.phone, user.role);
    return { message: 'Login successful', data: { user, ...tokens } };
  }

  async refresh(dto: RefreshTokenDto) {
    try {
      const payload = this.jwt.verify(dto.refreshToken, {
        secret: this.config.get<string>('jwt.refreshSecret'),
      });

      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user || !user.isActive) throw new UnauthorizedException();

      const tokens = await this.generateTokens(user.id, user.phone, user.role);
      return { message: 'Token refreshed', data: tokens };
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, phone: true, role: true, isActive: true },
    });
    if (!user) throw new UnauthorizedException('User not found');
    return { message: 'OK', data: user };
  }

  async logout(_userId: string) {
    return { message: 'Logged out successfully' };
  }

  private async generateTokens(userId: string, phone: string, role: string) {
    const payload = { sub: userId, phone, role };
    const jwtSecret = this.config.get<string>('jwt.secret') ?? 'secret';
    const jwtRefreshSecret = this.config.get<string>('jwt.refreshSecret') ?? 'refresh-secret';

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, { secret: jwtSecret, expiresIn: '7d' }),
      this.jwt.signAsync(payload, { secret: jwtRefreshSecret, expiresIn: '30d' }),
    ]);

    return { accessToken, refreshToken };
  }
}
