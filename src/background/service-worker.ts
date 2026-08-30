import { getSettings, isScheduleActive, resolveExpiredDisableRequest } from '../storage/storage';
import { ADULT_RULESETS } from './adult-rulesets';

const RULE_ID_START = 10_000;
const TICK_ALARM = 'focusguard-protection-tick';

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
  return site.type === 'url-prefix' ? site.pattern : `||${site.pattern}^`;
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
    .filter((id) => id >= RULE_ID_START);

  const addRules: chrome.declarativeNetRequest.Rule[] = settings.protectionEnabled && isScheduleActive(settings)
    ? settings.blockedSites
        .filter((site) => site.enabled)
        .map((site, index) => ({
          id: RULE_ID_START + index,
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
