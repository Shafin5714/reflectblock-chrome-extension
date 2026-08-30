import { useEffect, useState } from 'react';
import {
  addBlockedSite,
  DEFAULT_SETTINGS,
  getSettings,
  isScheduleActive,
  requestProtectionDisable,
  setProtectionEnabled,
} from '../storage/storage';
import { FocusGuardLogo } from '../shared/FocusGuardLogo';
import { UiIcon } from '../shared/UiIcon';

function getHostname(url?: string): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.hostname : null;
  } catch {
    return null;
  }
}

export function Popup() {
  const [hostname, setHostname] = useState<string | null>(null);
  const [tabId, setTabId] = useState<number | undefined>();
  const [protectionEnabled, setProtectionState] = useState(true);
  const [scheduleAllowsBlocking, setScheduleAllowsBlocking] = useState(true);
  const [focusSettings, setFocusSettings] = useState(DEFAULT_SETTINGS);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void Promise.all([
      chrome.tabs.query({ active: true, currentWindow: true }),
      getSettings(),
    ]).then(([tabs, settings]) => {
      setHostname(getHostname(tabs[0]?.url));
      setTabId(tabs[0]?.id);
      setProtectionState(settings.protectionEnabled);
      setScheduleAllowsBlocking(isScheduleActive(settings));
      setFocusSettings(settings);
    });
  }, []);

  async function handleBlockSite() {
    if (!hostname) return;
    setSaving(true);
    try {
      const added = await addBlockedSite(hostname);
      const response = await chrome.runtime.sendMessage({ type: 'SYNC_BLOCKING_RULES' });
      if (!response?.ok) {
        setMessage(response?.error ?? 'Could not activate the blocking rule.');
        return;
      }
      setMessage(added ? `${hostname} is now blocked.` : `${hostname} is already blocked.`);
      if (tabId !== undefined) await chrome.tabs.reload(tabId);
    } finally {
      setSaving(false);
    }
  }

  async function handleProtectionToggle(nextEnabled: boolean) {
    setSaving(true);
    try {
      if (!nextEnabled) {
        const result = await requestProtectionDisable();
        const settings = await getSettings();
        setProtectionState(settings.protectionEnabled);
        setScheduleAllowsBlocking(isScheduleActive(settings));
        setFocusSettings(settings);
        setMessage(result.disabled ? 'Protection is disabled.' : 'Strict Mode started a 15-minute cooldown.');
      } else {
        await setProtectionEnabled(true);
        const response = await chrome.runtime.sendMessage({ type: 'SYNC_BLOCKING_RULES' });
        if (!response?.ok) throw new Error(response?.error ?? 'Could not restore blocking rules.');
        const settings = await getSettings();
        setProtectionState(settings.protectionEnabled);
        setScheduleAllowsBlocking(isScheduleActive(settings));
        setFocusSettings(settings);
        setMessage('Protection is enabled.');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not update protection.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="popup">
      <header className="popup-header">
        <div className="brand"><FocusGuardLogo /><h1>FocusGuard</h1></div>
        <button className="icon-button popup-settings" onClick={() => chrome.runtime.openOptionsPage()} aria-label="Open settings"><UiIcon name="settings" size={23} /></button>
      </header>

      <section className="popup-protection" aria-label="Protection status">
        <div className="popup-section-label">PROTECTION STATUS</div>
        <div className="popup-protection-title">
          <div><h2>{protectionEnabled ? (scheduleAllowsBlocking ? 'Protected' : 'Scheduled off') : 'Protection off'}</h2><p><span className={protectionEnabled ? 'status-dot' : 'status-dot off'} />{protectionEnabled ? (scheduleAllowsBlocking ? 'Blocking is active' : 'Waiting for your schedule') : 'Blocking is paused'}</p></div>
          <label className="fg-switch" aria-label="Toggle protection"><input type="checkbox" checked={protectionEnabled} disabled={saving} onChange={(event) => void handleProtectionToggle(event.target.checked)} /><span /></label>
        </div>
      </section>

      <section className="popup-site" aria-label="Current website">
        <div className="popup-section-label">THIS WEBSITE</div>
        <div className="site-summary"><span className="site-icon"><UiIcon name="globe" size={21} /></span><div><strong>{hostname ?? 'Chrome page'}</strong><small>{hostname ? 'Add it to your block list when you need space.' : 'Chrome pages cannot be blocked.'}</small></div></div>
        {hostname && <button className="button button-quiet site-block-button" disabled={saving} onClick={handleBlockSite}>{saving ? 'Adding…' : 'Block site'}</button>}
      </section>

      <section className="popup-focus">
        <div className="popup-section-label">YOUR FOCUS</div>
        <button className="popup-focus-row" onClick={() => chrome.runtime.openOptionsPage()}><span className="feature-icon"><UiIcon name="shield" /></span><span><strong>Adult content shield</strong><small>{focusSettings.adultContentShield.enabled ? 'Known adult sites are blocked' : 'Currently off'}</small></span><em>{focusSettings.adultContentShield.enabled ? 'On' : 'Off'}</em><UiIcon name="chevron" /></button>
        <button className="popup-focus-row" onClick={() => chrome.runtime.openOptionsPage()}><span className="feature-icon"><UiIcon name="calendar" /></span><span><strong>Schedule</strong><small>{focusSettings.schedule.enabled ? `${focusSettings.schedule.startTime} – ${focusSettings.schedule.endTime}` : 'Always active'}</small></span><UiIcon name="chevron" /></button>
      </section>

      <button className="button button-primary popup-dashboard-button" onClick={() => chrome.runtime.openOptionsPage()}>Open dashboard</button>
      {message && <div className="popup-message" role="status">{message}</div>}
    </main>
  );
}
