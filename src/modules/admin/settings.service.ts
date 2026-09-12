import prisma from '../../lib/prisma';

export const DEFAULT_SETTINGS: Record<string, string> = {
  platform_commission_percent: '0',
  min_withdrawal_amount: '100',
  payout_gateway_mode: 'SANDBOX',
  auto_complete_days: '3',
};

export class SettingsService {
  private cache = new Map<string, { value: string; expiry: number }>();
  private readonly TTL_MS = 60 * 1000;

  async getSetting(key: string, defaultValue = ''): Promise<string> {
    const cached = this.cache.get(key);
    if (cached && cached.expiry > Date.now()) {
      return cached.value;
    }

    try {
      const setting = await prisma.systemSetting.findUnique({
        where: { key },
      });
      const resolved =
        setting && setting.value !== undefined
          ? setting.value
          : DEFAULT_SETTINGS[key] !== undefined
          ? DEFAULT_SETTINGS[key]
          : defaultValue;

      this.cache.set(key, { value: resolved, expiry: Date.now() + this.TTL_MS });
      return resolved;
    } catch {
      return DEFAULT_SETTINGS[key] !== undefined ? DEFAULT_SETTINGS[key] : defaultValue;
    }
  }

  async getPlatformCommissionRate(): Promise<number> {
    const value = await this.getSetting('platform_commission_percent', '0');
    const parsed = parseFloat(value);
    if (isNaN(parsed) || parsed < 0) {
      return 0;
    }
    return parsed / 100;
  }

  async getMinWithdrawalAmount(): Promise<number> {
    const value = await this.getSetting('min_withdrawal_amount', '100');
    const parsed = parseFloat(value);
    if (isNaN(parsed) || parsed <= 0) {
      return 100;
    }
    return parsed;
  }

  async getPayoutGatewayMode(): Promise<'SANDBOX' | 'LIVE'> {
    const value = await this.getSetting('payout_gateway_mode', 'SANDBOX');
    return value.toUpperCase() === 'LIVE' ? 'LIVE' : 'SANDBOX';
  }

  async getAllSettings(): Promise<Record<string, string>> {
    const rows = await prisma.systemSetting.findMany();
    const result: Record<string, string> = { ...DEFAULT_SETTINGS };
    for (const row of rows) {
      result[row.key] = row.value;
    }
    return result;
  }

  async updateSettings(updates: Record<string, string>): Promise<Record<string, string>> {
    this.cache.clear();
    for (const [key, value] of Object.entries(updates)) {
      await prisma.systemSetting.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      });
    }
    return this.getAllSettings();
  }

  async seedDefaultSettings(): Promise<void> {
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      const existing = await prisma.systemSetting.findUnique({ where: { key } });
      if (!existing) {
        await prisma.systemSetting.create({
          data: { key, value },
        });
      }
    }
  }
}

export const settingsService = new SettingsService();
export const getPlatformCommissionRate = () => settingsService.getPlatformCommissionRate();
export const getMinWithdrawalAmount = () => settingsService.getMinWithdrawalAmount();
