import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  addBlockedSite,
  addBlockedUrlPrefix,
  DEFAULT_SETTINGS,
  getSettings,
  removeBlockedSite,
  requestProtectionDisable,
  requestStrictModeDisable,
  saveSettings,
  setProtectionEnabled,
} from '../storage/storage';
import type { FocusGuardSettings } from '../storage/types';
import { ADULT_DOMAIN_COUNT } from '../background/adult-rulesets';
import { FocusGuardLogo } from '../shared/FocusGuardLogo';

const WEEK_DAYS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
];

async function syncRules(): Promise<void> {
  const response = await chrome.runtime.sendMessage({ type: 'SYNC_BLOCKING_RULES' });
  if (!response?.ok) throw new Error(response?.error ?? 'Could not update FocusGuard rules.');
}

function formatRemaining(availableAt: number | null): string {
  if (!availableAt) return '';
  const minutes = Math.max(1, Math.ceil((availableAt - Date.now()) / 60_000));
  return `${minutes} minute${minutes === 1 ? '' : 's'} remaining`;
}

export function Options() {
  const [settings, setSettings] = useState<FocusGuardSettings>(DEFAULT_SETTINGS);
  const [domain, setDomain] = useState('');
  const [urlPrefix, setUrlPrefix] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const disableCountdown = useMemo(
    () => formatRemaining(settings.strictMode.disableRequestedAt),
    [settings.strictMode.disableRequestedAt],
  );
  const strictModeCountdown = useMemo(
    () => formatRemaining(settings.strictMode.unlockRequestedAt),
    [settings.strictMode.unlockRequestedAt],
  );

  async function refresh(): Promise<void> {
    setSettings(await getSettings());
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function save(nextSettings: FocusGuardSettings, successMessage?: string): Promise<void> {
    setBusy(true);
    try {
      await saveSettings(nextSettings);
      await syncRules();
      setSettings(nextSettings);
      if (successMessage) setMessage(successMessage);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save the setting.');
    } finally {
      setBusy(false);
    }
  }

  async function handleAddDomain(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setBusy(true);
    try {
      const added = await addBlockedSite(domain);
      await syncRules();
      await refresh();
      setDomain('');
      setMessage(added ? 'Website added to the block list.' : 'That website is already blocked.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not add the website.');
    } finally {
      setBusy(false);
    }
  }

  async function handleAddUrlPrefix(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setBusy(true);
    try {
      const added = await addBlockedUrlPrefix(urlPrefix);
      await syncRules();
      await refresh();
      setUrlPrefix('');
      setMessage(added ? 'URL path added to the block list.' : 'That URL path is already blocked.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not add the URL path.');
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(id: string): Promise<void> {
    setBusy(true);
    try {
      await removeBlockedSite(id);
      await syncRules();
      await refresh();
      setMessage('Block rule removed.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not remove the rule.');
    } finally {
      setBusy(false);
    }
  }

  async function handleProtectionToggle(): Promise<void> {
    setBusy(true);
    try {
      if (!settings.protectionEnabled) {
        await setProtectionEnabled(true);
        await syncRules();
        await refresh();
        setMessage('Protection is enabled.');
        return;
      }

      const result = await requestProtectionDisable();
      await syncRules();
      await refresh();
      setMessage(result.disabled
        ? 'Protection is disabled.'
        : `Strict Mode started a 15-minute cooldown (${formatRemaining(result.availableAt)}).`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not update protection.');
    } finally {
      setBusy(false);
    }
  }

  function updateSchedule<K extends keyof FocusGuardSettings['schedule']>(
    key: K,
    value: FocusGuardSettings['schedule'][K],
  ): void {
    void save({ ...settings, schedule: { ...settings.schedule, [key]: value } });
  }

  function toggleDay(day: number): void {
    const days = settings.schedule.days.includes(day)
      ? settings.schedule.days.filter((savedDay) => savedDay !== day)
      : [...settings.schedule.days, day];
    updateSchedule('days', days);
  }

  async function handleStrictModeToggle(enabled: boolean): Promise<void> {
    if (enabled) {
      await save({
        ...settings,
        strictMode: { ...settings.strictMode, enabled: true, unlockRequestedAt: null },
      }, 'Strict Mode is on. Changes will require a 15-minute cooldown.');
      return;
    }

    setBusy(true);
    try {
      const result = await requestStrictModeDisable();
      await syncRules();
      await refresh();
      setMessage(result.disabled
        ? 'Strict Mode is off.'
        : `Strict Mode will turn off after the 15-minute cooldown (${formatRemaining(result.availableAt)}).`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not update Strict Mode.');
    } finally {
      setBusy(false);
    }
  }

  async function handleAdultShieldToggle(enabled: boolean): Promise<void> {
    if (!enabled && settings.protectionEnabled && settings.strictMode.enabled) {
      setMessage('Strict Mode is on. Start the 15-minute protection cooldown before turning Adult Content Shield off.');
      return;
    }
    await save({
      ...settings,
      adultContentShield: { enabled },
    }, enabled ? 'Adult Content Shield is on.' : 'Adult Content Shield is off.');
  }

  return (
    <main className="settings-page">
      <section className="settings-card settings-hero">
        <div className="brand">
          <FocusGuardLogo />
          <div><h1>FocusGuard Settings</h1><p>Build a calmer browser, one intentional rule at a time.</p></div>
        </div>
        <div className="protection-row">
          <div>
            <div className="label">Protection</div>
            <strong>{settings.protectionEnabled ? 'Enabled' : 'Disabled'}</strong>
            {disableCountdown && <p className="warning-text">Disable request pending: {disableCountdown}</p>}
          </div>
          <button className={settings.protectionEnabled ? 'button button-secondary compact-button' : 'button button-primary compact-button'} disabled={busy} onClick={() => void handleProtectionToggle()}>
            {settings.protectionEnabled ? 'Turn off protection' : 'Turn on protection'}
          </button>
        </div>
      </section>

      <section className="settings-card">
        <div className="section-heading"><div><h2>Website blocking</h2><p>Block a whole domain, including its paths and subdomains.</p></div></div>
        <form className="inline-form" onSubmit={(event) => void handleAddDomain(event)}>
          <input value={domain} onChange={(event) => setDomain(event.target.value)} placeholder="example.com" aria-label="Website domain" />
          <button className="button button-primary form-button" disabled={busy}>Block website</button>
        </form>
        <form className="inline-form" onSubmit={(event) => void handleAddUrlPrefix(event)}>
          <input value={urlPrefix} onChange={(event) => setUrlPrefix(event.target.value)} placeholder="https://example.com/distraction" aria-label="Specific URL path" />
          <button className="button button-secondary form-button" disabled={busy}>Block URL path</button>
        </form>
        <ul className="site-list">
          {settings.blockedSites.length === 0 ? <li className="empty-row">No block rules yet.</li> : settings.blockedSites.map((site) => (
            <li key={site.id}>
              <div>
                <strong>{site.type === 'url-prefix' ? site.pattern.replace(/^\|/, '') : site.pattern}</strong>
                <span>{site.type === 'url-prefix' ? 'URL PATH' : 'ENTIRE WEBSITE'}</span>
              </div>
              <button className="remove-button" disabled={busy} onClick={() => void handleRemove(site.id)}>Remove</button>
            </li>
          ))}
        </ul>
      </section>

      <section className="settings-card">
        <div className="section-heading"><div><h2>Adult Content Shield</h2><p>Block a large curated list of known adult-content domains before they load.</p></div></div>
        <label className="setting-toggle">
          <input type="checkbox" checked={settings.adultContentShield.enabled} disabled={busy} onChange={(event) => void handleAdultShieldToggle(event.target.checked)} />
          <span><strong>Block known adult-content websites</strong><small>{ADULT_DOMAIN_COUNT.toLocaleString()} domains are bundled with this version. The exact number Chrome enables can be lower if other extensions already use its static-rule quota.</small></span>
        </label>
      </section>

      <section className="settings-card">
        <div className="section-heading"><div><h2>Selective distraction blocking</h2><p>Hide attention traps while keeping the rest of the site usable.</p></div></div>
        <label className="setting-toggle">
          <input type="checkbox" checked={settings.selectiveBlocking.youtubeShorts} disabled={busy} onChange={(event) => void save({ ...settings, selectiveBlocking: { ...settings.selectiveBlocking, youtubeShorts: event.target.checked } }, 'YouTube Shorts setting updated.')} />
          <span><strong>Block YouTube Shorts</strong><small>Hides Shorts shelves and navigation links, and blocks Shorts pages. Normal videos remain available.</small></span>
        </label>
        <label className="setting-toggle">
          <input type="checkbox" checked={settings.selectiveBlocking.facebookFeedReels} disabled={busy} onChange={(event) => void save({ ...settings, selectiveBlocking: { ...settings.selectiveBlocking, facebookFeedReels: event.target.checked } }, 'Facebook Reels setting updated.')} />
          <span><strong>Block Facebook Reels</strong><small>Hides Reel cards in the feed and blocks Facebook Reel pages.</small></span>
        </label>
        <label className="setting-toggle">
          <input type="checkbox" checked={settings.selectiveBlocking.instagramReels} disabled={busy} onChange={(event) => void save({ ...settings, selectiveBlocking: { ...settings.selectiveBlocking, instagramReels: event.target.checked } }, 'Instagram Reels setting updated.')} />
          <span><strong>Block Instagram Reels</strong><small>Hides Reel links and feed posts, and blocks Instagram Reel pages.</small></span>
        </label>
      </section>

      <section className="settings-card">
        <div className="section-heading"><div><h2>Schedule</h2><p>Only enforce website blocks during your chosen focus hours.</p></div></div>
        <label className="setting-toggle">
          <input type="checkbox" checked={settings.schedule.enabled} disabled={busy} onChange={(event) => updateSchedule('enabled', event.target.checked)} />
          <span><strong>Use a blocking schedule</strong><small>Selective Shorts/Reels hiding stays active independently.</small></span>
        </label>
        {settings.schedule.enabled && <>
          <div className="day-picker" aria-label="Focus days">
            {WEEK_DAYS.map((day) => <button key={day.value} type="button" disabled={busy} className={settings.schedule.days.includes(day.value) ? 'day-button active' : 'day-button'} onClick={() => toggleDay(day.value)}>{day.label}</button>)}
          </div>
          <div className="time-grid">
            <label>Start<input type="time" value={settings.schedule.startTime} disabled={busy} onChange={(event) => updateSchedule('startTime', event.target.value)} /></label>
            <label>End<input type="time" value={settings.schedule.endTime} disabled={busy} onChange={(event) => updateSchedule('endTime', event.target.value)} /></label>
          </div>
        </>}
      </section>

      <section className="settings-card">
        <div className="section-heading"><div><h2>Strict Mode</h2><p>Make disabling protection a deliberate decision.</p></div></div>
        <label className="setting-toggle">
          <input type="checkbox" checked={settings.strictMode.enabled} disabled={busy} onChange={(event) => void handleStrictModeToggle(event.target.checked)} />
          <span><strong>Require a 15-minute cooldown</strong><small>This delays disabling FocusGuard and switching Strict Mode off. Chrome extension removal cannot be delayed by any extension.</small></span>
        </label>
        {strictModeCountdown && <p className="warning-text">Strict Mode unlock pending: {strictModeCountdown}</p>}
      </section>

      <section className="settings-card">
        <div className="section-heading"><div><h2>Uninstall reminder</h2><p>Open your personal motivation page after FocusGuard is removed.</p></div></div>
        <label className="setting-toggle">
          <input type="checkbox" checked={settings.uninstallReminder.enabled} disabled={busy} onChange={(event) => void save({ ...settings, uninstallReminder: { ...settings.uninstallReminder, enabled: event.target.checked } }, event.target.checked ? 'The hosted reminder will open after removal.' : 'Uninstall reminder is off.')} />
          <span><strong>Open a hosted reminder page</strong><small>Your family photo will be added here after you upload it and we host its private reminder page.</small></span>
        </label>
        <label className="field-label">Hosted reminder page URL
          <input value={settings.uninstallReminder.hostedPageUrl} disabled={busy} onChange={(event) => setSettings({ ...settings, uninstallReminder: { ...settings.uninstallReminder, hostedPageUrl: event.target.value } })} onBlur={() => void save(settings)} placeholder="https://your-private-page.example/reminder" inputMode="url" />
        </label>
      </section>

      <p className="message" role="status">{message}</p>
    </main>
  );
}
