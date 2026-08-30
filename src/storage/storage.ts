import type { BlockedSite, BlockRuleType, FocusGuardSettings } from './types';

export const DEFAULT_SETTINGS: FocusGuardSettings = {
  protectionEnabled: true,
  blockedSites: [],
  schedule: {
    enabled: false,
    days: [1, 2, 3, 4, 5],
    startTime: '09:00',
    endTime: '17:00',
  },
  selectiveBlocking: {
    youtubeShorts: false,
    facebookFeedReels: false,
    instagramReels: false,
  },
  strictMode: {
    enabled: false,
    disableRequestedAt: null,
    unlockRequestedAt: null,
  },
  uninstallReminder: {
    enabled: false,
    hostedPageUrl: '',
  },
  adultContentShield: {
    enabled: true,
  },
};

const SETTINGS_KEY = 'focusGuardSettings';

export async function getSettings(): Promise<FocusGuardSettings> {
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  const saved = result[SETTINGS_KEY] as Partial<FocusGuardSettings> | undefined;

  return {
    ...DEFAULT_SETTINGS,
    ...saved,
    blockedSites: (saved?.blockedSites ?? []).map((site) => ({
      ...site,
      type: site.type ?? 'domain',
    })),
    schedule: { ...DEFAULT_SETTINGS.schedule, ...saved?.schedule },
    selectiveBlocking: { ...DEFAULT_SETTINGS.selectiveBlocking, ...saved?.selectiveBlocking },
    strictMode: { ...DEFAULT_SETTINGS.strictMode, ...saved?.strictMode },
    uninstallReminder: { ...DEFAULT_SETTINGS.uninstallReminder, ...saved?.uninstallReminder },
    adultContentShield: { ...DEFAULT_SETTINGS.adultContentShield, ...saved?.adultContentShield },
  };
}

export async function saveSettings(settings: FocusGuardSettings): Promise<void> {
  await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
}

export function normalizeDomain(value: string): string | null {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) return null;
    return url.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

export function normalizeUrlPrefix(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    return `|${url.href}`;
  } catch {
    return null;
  }
}

async function addRule(pattern: string, type: BlockRuleType): Promise<boolean> {
  const settings = await getSettings();
  const exists = settings.blockedSites.some((site) => site.pattern === pattern && site.type === type);

  if (exists) return false;

  settings.blockedSites.push({
    id: crypto.randomUUID(),
    pattern,
    enabled: true,
    type,
  });
  await saveSettings(settings);
  return true;
}

export async function addBlockedSite(hostname: string): Promise<boolean> {
  const domain = normalizeDomain(hostname);
  if (!domain) throw new Error('Enter a valid website, such as example.com.');
  return addRule(domain, 'domain');
}

export async function addBlockedUrlPrefix(url: string): Promise<boolean> {
  const prefix = normalizeUrlPrefix(url);
  if (!prefix) throw new Error('Enter a full http or https URL.');
  return addRule(prefix, 'url-prefix');
}

export async function removeBlockedSite(id: string): Promise<void> {
  const settings = await getSettings();
  settings.blockedSites = settings.blockedSites.filter((site) => site.id !== id);
  await saveSettings(settings);
}

export async function setProtectionEnabled(enabled: boolean): Promise<void> {
  const settings = await getSettings();
  settings.protectionEnabled = enabled;
  if (enabled) settings.strictMode.disableRequestedAt = null;
  await saveSettings(settings);
}

export async function requestProtectionDisable(): Promise<{ disabled: boolean; availableAt: number | null }> {
  const settings = await getSettings();
  if (!settings.protectionEnabled) return { disabled: true, availableAt: null };

  if (!settings.strictMode.enabled) {
    settings.protectionEnabled = false;
    await saveSettings(settings);
    return { disabled: true, availableAt: null };
  }

  const now = Date.now();
  const availableAt = settings.strictMode.disableRequestedAt;
  if (availableAt && availableAt <= now) {
    settings.protectionEnabled = false;
    settings.strictMode.disableRequestedAt = null;
    await saveSettings(settings);
    return { disabled: true, availableAt: null };
  }

  if (!availableAt) {
    settings.strictMode.disableRequestedAt = now + 15 * 60 * 1000;
    await saveSettings(settings);
  }

  return { disabled: false, availableAt: settings.strictMode.disableRequestedAt };
}

export async function resolveExpiredDisableRequest(): Promise<boolean> {
  const settings = await getSettings();
  const now = Date.now();
  let changed = false;

  if (settings.strictMode.disableRequestedAt && settings.strictMode.disableRequestedAt <= now) {
    settings.protectionEnabled = false;
    settings.strictMode.disableRequestedAt = null;
    changed = true;
  }

  if (settings.strictMode.unlockRequestedAt && settings.strictMode.unlockRequestedAt <= now) {
    settings.strictMode.enabled = false;
    settings.strictMode.unlockRequestedAt = null;
    changed = true;
  }

  if (!changed) return false;
  await saveSettings(settings);
  return true;
}

export async function requestStrictModeDisable(): Promise<{ disabled: boolean; availableAt: number | null }> {
  const settings = await getSettings();
  if (!settings.strictMode.enabled) return { disabled: true, availableAt: null };

  const now = Date.now();
  const availableAt = settings.strictMode.unlockRequestedAt;
  if (availableAt && availableAt <= now) {
    settings.strictMode.enabled = false;
    settings.strictMode.unlockRequestedAt = null;
    await saveSettings(settings);
    return { disabled: true, availableAt: null };
  }

  if (!availableAt) {
    settings.strictMode.unlockRequestedAt = now + 15 * 60 * 1000;
    await saveSettings(settings);
  }

  return { disabled: false, availableAt: settings.strictMode.unlockRequestedAt };
}

export function isScheduleActive(settings: FocusGuardSettings, now = new Date()): boolean {
  const { schedule } = settings;
  if (!schedule.enabled) return true;
  if (schedule.days.length === 0) return false;

  const [startHour, startMinute] = schedule.startTime.split(':').map(Number);
  const [endHour, endMinute] = schedule.endTime.split(':').map(Number);
  if ([startHour, startMinute, endHour, endMinute].some(Number.isNaN)) return true;

  const currentMinute = now.getHours() * 60 + now.getMinutes();
  const startMinuteOfDay = startHour * 60 + startMinute;
  const endMinuteOfDay = endHour * 60 + endMinute;
  const today = now.getDay();

  if (startMinuteOfDay <= endMinuteOfDay) {
    return schedule.days.includes(today)
      && currentMinute >= startMinuteOfDay
      && currentMinute < endMinuteOfDay;
  }

  const yesterday = (today + 6) % 7;
  return (schedule.days.includes(today) && currentMinute >= startMinuteOfDay)
    || (schedule.days.includes(yesterday) && currentMinute < endMinuteOfDay);
}
