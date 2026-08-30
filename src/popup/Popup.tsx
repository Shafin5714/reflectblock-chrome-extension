import { useEffect, useState } from 'react';
import {
  addBlockedSite,
  getSettings,
  isScheduleActive,
  requestProtectionDisable,
  setProtectionEnabled,
} from '../storage/storage';
import { FocusGuardLogo } from '../shared/FocusGuardLogo';

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
  const [protectionEnabled, setProtectionEnabled] = useState(true);
  const [scheduleAllowsBlocking, setScheduleAllowsBlocking] = useState(true);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void Promise.all([
      chrome.tabs.query({ active: true, currentWindow: true }),
      getSettings(),
    ]).then(([tabs, settings]) => {
      setHostname(getHostname(tabs[0]?.url));
      setTabId(tabs[0]?.id);
      setProtectionEnabled(settings.protectionEnabled);
      setScheduleAllowsBlocking(isScheduleActive(settings));
    });
  }, []);

  async function handleBlockSite() {
    if (!hostname) return;
    setSaving(true);
    const added = await addBlockedSite(hostname);
    const response = await chrome.runtime.sendMessage({ type: 'SYNC_BLOCKING_RULES' });

    if (!response?.ok) {
      setMessage(response?.error ?? 'Could not activate the blocking rule.');
      setSaving(false);
      return;
    }

    setMessage(added ? `${hostname} is now blocked.` : `${hostname} is already blocked.`);
    setSaving(false);

    if (tabId !== undefined) await chrome.tabs.reload(tabId);
  }

  async function handleProtectionToggle() {
    setSaving(true);
    try {
      if (protectionEnabled) {
        const result = await requestProtectionDisable();
        const settings = await getSettings();
        setProtectionEnabled(settings.protectionEnabled);
        setScheduleAllowsBlocking(isScheduleActive(settings));
        setMessage(result.disabled ? 'Protection is disabled.' : 'Strict Mode started a 15-minute cooldown.');
      } else {
        await setProtectionEnabled(true);
        setProtectionEnabled(true);
        setMessage('Protection is enabled.');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="popup">
      <header className="brand">
        <FocusGuardLogo />
        <div>
          <h1>FocusGuard</h1>
          <p>Control the distracting web.</p>
        </div>
      </header>

      <section className="status-card" aria-label="Protection status">
        <div>
          <div className="label">Protection</div>
          <div className="value">{protectionEnabled ? (scheduleAllowsBlocking ? 'Enabled' : 'Scheduled off') : 'Disabled'}</div>
        </div>
        <span className="badge">{protectionEnabled ? 'ON' : 'OFF'}</span>
      </section>

      <section className="status-card" aria-label="Current website">
        <div>
          <div className="label">Current website</div>
          <div className="value">{hostname ?? 'Chrome page cannot be blocked'}</div>
        </div>
      </section>

      <div className="actions">
        <button className="button button-primary" disabled={!hostname || saving} onClick={handleBlockSite}>
          {saving ? 'Adding…' : 'Block Current Website'}
        </button>
        <button className="button button-secondary" onClick={() => chrome.runtime.openOptionsPage()}>
          Open Settings
        </button>
        <button className="text-button" disabled={saving} onClick={() => void handleProtectionToggle()}>
          {protectionEnabled ? 'Turn protection off' : 'Turn protection on'}
        </button>
      </div>
      <div className="message" role="status">{message}</div>
    </main>
  );
}
