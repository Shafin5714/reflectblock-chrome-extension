export type BlockRuleType = 'domain' | 'url-prefix' | 'keyword';

export interface BlockedSite {
  id: string;
  pattern: string;
  enabled: boolean;
  type: BlockRuleType;
}

export interface BlockingSchedule {
  enabled: boolean;
  /** Sunday is 0, Saturday is 6. */
  days: number[];
  startTime: string;
  endTime: string;
}

export interface SelectiveBlockingSettings {
  youtubeShorts: boolean;
  facebookFeedReels: boolean;
  instagramReels: boolean;
}

export interface StrictModeSettings {
  enabled: boolean;
  /** A future epoch time while a requested disable is intentionally delayed. */
  disableRequestedAt: number | null;
  /** A future epoch time while switching Strict Mode off is intentionally delayed. */
  unlockRequestedAt: number | null;
}

export interface UninstallReminderSettings {
  enabled: boolean;
  /** Must be an https page that remains available after the extension is removed. */
  hostedPageUrl: string;
}

export interface AdultContentShieldSettings {
  enabled: boolean;
}

export interface FocusGuardSettings {
  protectionEnabled: boolean;
  blockedSites: BlockedSite[];
  schedule: BlockingSchedule;
  selectiveBlocking: SelectiveBlockingSettings;
  strictMode: StrictModeSettings;
  uninstallReminder: UninstallReminderSettings;
  adultContentShield: AdultContentShieldSettings;
}
