import { getSettings, isScheduleActive, resolveExpiredDisableRequest } from '../storage/storage';
import { ADULT_RULESETS } from './adult-rulesets';

const SELECTIVE_RULE_ID_START = 10_000;
const SITE_RULE_ID_START = 20_000;
const TICK_ALARM = 'focusguard-protection-tick';

function isDomain(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

function isSelectiveRouteBlocked(
  urlValue: string,
  settings: Awaited<ReturnType<typeof getSettings>>,
): boolean {
  if (!settings.protectionEnabled) return false;

  try {
    const url = new URL(urlValue);
    return (settings.selectiveBlocking.youtubeShorts
      && isDomain(url.hostname, 'youtube.com')
      && /^\/shorts(?:\/|$)/i.test(url.pathname))
      || (settings.selectiveBlocking.facebookFeedReels
        && isDomain(url.hostname, 'facebook.com')
        && /^\/(?:reels?|share\/r)(?:\/|$)/i.test(url.pathname))
      || (settings.selectiveBlocking.instagramReels
        && isDomain(url.hostname, 'instagram.com')
        && /^\/reels?(?:\/|$)/i.test(url.pathname));
  } catch {
    return false;
  }
}

function getSelectiveBlockingRules(
  settings: Awaited<ReturnType<typeof getSettings>>,
): chrome.declarativeNetRequest.Rule[] {
  if (!settings.protectionEnabled) return [];

  const rules: chrome.declarativeNetRequest.Rule[] = [];
  const redirectAction: chrome.declarativeNetRequest.RuleAction = {
    type: chrome.declarativeNetRequest.RuleActionType.REDIRECT,
    redirect: { extensionPath: '/blocked.html' },
  };

  if (settings.selectiveBlocking.youtubeShorts) {
    rules.push({
      id: SELECTIVE_RULE_ID_START,
      priority: 2,
      action: redirectAction,
      condition: {
        regexFilter: '^https://([a-z0-9-]+\\.)*youtube\\.com/shorts(/|\\?|#|$)',
        resourceTypes: [chrome.declarativeNetRequest.ResourceType.MAIN_FRAME],
      },
    });
  }

  if (settings.selectiveBlocking.facebookFeedReels) {
    rules.push({
      id: SELECTIVE_RULE_ID_START + 1,
      priority: 2,
      action: redirectAction,
      condition: {
        regexFilter: '^https://([a-z0-9-]+\\.)*facebook\\.com/(reels?|share/r)(/|\\?|#|$)',
        resourceTypes: [chrome.declarativeNetRequest.ResourceType.MAIN_FRAME],
      },
    });
  }

  if (settings.selectiveBlocking.instagramReels) {
    rules.push({
      id: SELECTIVE_RULE_ID_START + 2,
      priority: 2,
      action: redirectAction,
      condition: {
        regexFilter: '^https://([a-z0-9-]+\\.)*instagram\\.com/reels?(/|\\?|#|$)',
        resourceTypes: [chrome.declarativeNetRequest.ResourceType.MAIN_FRAME],
      },
    });
  }

  return rules;
}

async function syncAdultContentRules(enabled: boolean): Promise<void> {
  const adultRulesetIds = ADULT_RULESETS.map((ruleset) => ruleset.id);
  const currentlyEnabled = await chrome.declarativeNetRequest.getEnabledRulesets();
  const currentlyEnabledAdultRulesets = ADULT_RULESETS.filter((ruleset) => currentlyEnabled.includes(ruleset.id));

  if (!enabled) {
    if (currentlyEnabledAdultRulesets.length > 0) {
      await chrome.declarativeNetRequest.updateEnabledRulesets({
        disableRulesetIds: currentlyEnabledAdultRulesets.map((ruleset) => ruleset.id),
      });
    }
    return;
  }

  const availableRuleCount = await chrome.declarativeNetRequest.getAvailableStaticRuleCount();
  let remainingRuleCount = availableRuleCount;
  const rulesetIdsToEnable: string[] = [];

  for (const ruleset of ADULT_RULESETS) {
    if (currentlyEnabled.includes(ruleset.id)) continue;
    if (ruleset.count > remainingRuleCount) continue;
    rulesetIdsToEnable.push(ruleset.id);
    remainingRuleCount -= ruleset.count;
  }

  if (rulesetIdsToEnable.length > 0) {
    await chrome.declarativeNetRequest.updateEnabledRulesets({ enableRulesetIds: rulesetIdsToEnable });
  }

  // Keep the declared IDs referenced here so a browser's manifest validation cannot
  // accidentally treat the generated rulesets as unused build output.
  void adultRulesetIds;
}

function getRuleFilter(site: { pattern: string; type: string }): string {
  if (site.type === 'url-prefix' || site.type === 'keyword') return site.pattern;
  return `||${site.pattern}^`;
}

function isSavedRuleBlocked(
  urlValue: string,
  settings: Awaited<ReturnType<typeof getSettings>>,
): boolean {
  if (!settings.protectionEnabled || !isScheduleActive(settings)) return false;

  try {
    const url = new URL(urlValue);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    const normalizedUrl = url.href.toLowerCase();
    return settings.blockedSites.some((site) => {
      if (!site.enabled) return false;
      if (site.type === 'keyword') return normalizedUrl.includes(site.pattern.toLowerCase());
      if (site.type === 'url-prefix') return normalizedUrl.startsWith(site.pattern.replace(/^\|/, '').toLowerCase());
      return isDomain(url.hostname, site.pattern);
    });
  } catch {
    return false;
  }
}

function getReminderUrl(settings: Awaited<ReturnType<typeof getSettings>>): string {
  const { enabled, hostedPageUrl } = settings.uninstallReminder;
  if (!enabled) return '';

  try {
    const url = new URL(hostedPageUrl);
    return url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
}

async function syncBlockingRules(): Promise<void> {
  const [settings, existingRules] = await Promise.all([
    getSettings(),
    chrome.declarativeNetRequest.getDynamicRules(),
  ]);

  const removeRuleIds = existingRules
    .map((rule) => rule.id)
    .filter((id) => id >= SELECTIVE_RULE_ID_START);

  const siteRules: chrome.declarativeNetRequest.Rule[] = settings.protectionEnabled && isScheduleActive(settings)
    ? settings.blockedSites
        .filter((site) => site.enabled)
        .map((site, index) => ({
          id: SITE_RULE_ID_START + index,
          priority: 1,
          action: {
            type: chrome.declarativeNetRequest.RuleActionType.REDIRECT,
            redirect: { extensionPath: '/blocked.html' },
          },
          condition: {
            urlFilter: getRuleFilter(site),
            resourceTypes: [chrome.declarativeNetRequest.ResourceType.MAIN_FRAME],
          },
        }))
    : [];
  const addRules = [...getSelectiveBlockingRules(settings), ...siteRules];

  await Promise.all([
    chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds, addRules }),
    syncAdultContentRules(settings.protectionEnabled && settings.adultContentShield.enabled),
    chrome.runtime.setUninstallURL(getReminderUrl(settings)),
  ]);
}

let syncQueue: Promise<void> = Promise.resolve();

function queueRuleSync(): Promise<void> {
  syncQueue = syncQueue.then(syncBlockingRules, syncBlockingRules);
  return syncQueue;
}

function ensureProtectionAlarm(): void {
  chrome.alarms.create(TICK_ALARM, { periodInMinutes: 1 });
}

chrome.runtime.onInstalled.addListener(() => {
  ensureProtectionAlarm();
  void queueRuleSync();
});

chrome.runtime.onStartup.addListener(() => {
  ensureProtectionAlarm();
  void queueRuleSync();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== TICK_ALARM) return;
  void resolveExpiredDisableRequest().finally(() => void queueRuleSync());
});

chrome.storage.onChanged.addListener((_changes, areaName) => {
  if (areaName === 'local') void queueRuleSync();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (!changeInfo.url) return;

  void getSettings().then((settings) => {
    if (!isSelectiveRouteBlocked(changeInfo.url!, settings)
      && !isSavedRuleBlocked(changeInfo.url!, settings)) return;
    return chrome.tabs.update(tabId, { url: chrome.runtime.getURL('blocked.html') });
  });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'SYNC_BLOCKING_RULES') return false;

  void queueRuleSync()
    .then(() => sendResponse({ ok: true }))
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'Unable to update blocking rules.';
      sendResponse({ ok: false, error: message });
    });

  return true;
});
