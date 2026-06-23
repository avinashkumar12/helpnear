import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  async getAll() {
    return this.prisma.setting.findMany({ orderBy: [{ group: 'asc' }, { key: 'asc' }] });
  }

  async updateMany(updates: { key: string; value: string }[]) {
    await Promise.all(
      updates.map(u =>
        this.prisma.setting.update({ where: { key: u.key }, data: { value: u.value } }),
      ),
    );
    return this.getAll();
  }

  async getValue(key: string): Promise<string> {
    const s = await this.prisma.setting.findUnique({ where: { key } });
    return s?.value ?? '';
  }

  async getGroup(group: string) {
    const rows = await this.prisma.setting.findMany({ where: { group } });
    return Object.fromEntries(rows.map(r => [r.key, r.value]));
  }
}
