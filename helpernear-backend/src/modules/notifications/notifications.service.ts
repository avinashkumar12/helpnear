import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private _app: any = null;

  constructor(private readonly prisma: PrismaService) {}

  private async getMessaging() {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const admin = require('firebase-admin');
      const keys = ['fcm_project_id', 'fcm_client_email', 'fcm_private_key'];
      const rows = await this.prisma.setting.findMany({ where: { key: { in: keys } } });
      const map: Record<string, string> = {};
      rows.forEach((s: any) => { map[s.key] = s.value; });

      if (!map['fcm_project_id'] || !map['fcm_client_email'] || !map['fcm_private_key']) return null;

      if (!this._app) {
        this._app = admin.apps.length === 0
          ? admin.initializeApp({
              credential: admin.credential.cert({
                projectId: map['fcm_project_id'],
                clientEmail: map['fcm_client_email'],
                privateKey: map['fcm_private_key'].replace(/\\n/g, '\n'),
              }),
            })
          : admin.app();
      }
      return admin.messaging(this._app);
    } catch (err: any) {
      this.logger.warn('FCM init failed: ' + err.message);
      return null;
    }
  }

  async sendToUser(userId: string, title: string, body: string, link = '/'): Promise<void> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { fcmToken: true },
      });
      if (!user?.fcmToken) return;

      const messaging = await this.getMessaging();
      if (!messaging) return;

      await messaging.send({
        token: user.fcmToken,
        notification: { title, body },
        webpush: {
          notification: {
            title,
            body,
            icon: '/assets/logo-icon.svg',
            badge: '/assets/logo-icon.svg',
          },
          fcmOptions: { link },
        },
      });
      this.logger.log(`Push sent to user ${userId}`);
    } catch (err: any) {
      this.logger.warn(`Push failed for ${userId}: ${err.message}`);
    }
  }
}
