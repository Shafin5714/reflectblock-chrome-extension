import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  addBlockedSite,
  addBlockedUrlKeyword,
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
import { UiIcon } from '../shared/UiIcon';

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

function formatScheduleSummary(settings: FocusGuardSettings): string {
  const { schedule } = settings;
  if (!schedule.enabled) return 'Always active';
  const weekdays = [1, 2, 3, 4, 5];
  const everyDay = [0, 1, 2, 3, 4, 5, 6];
  const dayLabel = weekdays.every((day) => schedule.days.includes(day)) && schedule.days.length === weekdays.length
    ? 'Weekdays'
    : everyDay.every((day) => schedule.days.includes(day)) && schedule.days.length === everyDay.length
      ? 'Every day'
      : `${schedule.days.length} selected days`;
  return `${dayLabel}, ${schedule.startTime} – ${schedule.endTime}`;
}

export function Options() {
  const [settings, setSettings] = useState<FocusGuardSettings>(DEFAULT_SETTINGS);
  const [domain, setDomain] = useState('');
  const [urlPrefix, setUrlPrefix] = useState('');
  const [urlKeyword, setUrlKeyword] = useState('');
  const [ruleMode, setRuleMode] = useState<'domain' | 'url-prefix' | 'keyword'>('domain');
  const [activeSection, setActiveSection] = useState('overview');
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

  async function handleAddUrlKeyword(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setBusy(true);
    try {
      const added = await addBlockedUrlKeyword(urlKeyword);
      await syncRules();
      await refresh();
      setUrlKeyword('');
      setMessage(added ? 'URL keyword added to the block list.' : 'That URL keyword is already blocked.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not add the URL keyword.');
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

  async function handleProtectionToggle(nextEnabled: boolean): Promise<void> {
    setBusy(true);
    try {
      if (nextEnabled) {
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
    <main className="settings-dashboard">
      <aside className="settings-sidebar">
        <div className="sidebar-brand"><FocusGuardLogo /><span>FocusGuard</span></div>
        <nav className="sidebar-nav" aria-label="Settings sections">
          <a href="#overview" className={activeSection === 'overview' ? 'active' : ''} onClick={() => setActiveSection('overview')}><UiIcon name="home" />Overview</a>
          <a href="#website-blocking" className={activeSection === 'website-blocking' ? 'active' : ''} onClick={() => setActiveSection('website-blocking')}><UiIcon name="globe" />Website blocking</a>
          <a href="#focus-tools" className={activeSection === 'focus-tools' ? 'active' : ''} onClick={() => setActiveSection('focus-tools')}><UiIcon name="eye-off" />Focus tools</a>
          <a href="#schedule" className={activeSection === 'schedule' ? 'active' : ''} onClick={() => setActiveSection('schedule')}><UiIcon name="calendar" />Schedule</a>
          <a href="#safety" className={activeSection === 'safety' ? 'active' : ''} onClick={() => setActiveSection('safety')}><UiIcon name="shield" />Safety</a>
        </nav>
        <p className="sidebar-note"><UiIcon name="info" size={17} /> Settings stay on this device.</p>
      </aside>

      <div className="settings-content">
        <header className="settings-header" id="overview">
          <div><p className="eyebrow">FOCUSGUARD</p><h1>Settings</h1><p>Build a calmer browser, one intentional choice at a time.</p></div>
        </header>

        <section className="protection-banner">
          <div className="status-copy">
            <span className={settings.protectionEnabled ? 'status-dot' : 'status-dot off'} />
            <div><strong>{settings.protectionEnabled ? 'Protection is on' : 'Protection is off'}</strong><small>{settings.protectionEnabled ? 'FocusGuard is blocking your selected distractions.' : 'Your block rules are paused.'}</small></div>
          </div>
          <label className="fg-switch" aria-label="Toggle protection"><input type="checkbox" checked={settings.protectionEnabled} disabled={busy} onChange={(event) => void handleProtectionToggle(event.target.checked)} /><span /></label>
          {disableCountdown && <p className="inline-warning">Disable request pending: {disableCountdown}</p>}
        </section>

        <div className="settings-columns">
          <div className="settings-primary">
            <section className="dashboard-card" id="website-blocking">
              <div className="card-heading"><div><h2>Website blocking</h2><p>Choose what should not interrupt you.</p></div><span className="rule-count">{settings.blockedSites.length} rules</span></div>
              <div className="rule-mode-tabs" role="tablist" aria-label="Rule type">
                <button type="button" role="tab" aria-selected={ruleMode === 'domain'} className={ruleMode === 'domain' ? 'active' : ''} onClick={() => setRuleMode('domain')}>Website</button>
                <button type="button" role="tab" aria-selected={ruleMode === 'url-prefix'} className={ruleMode === 'url-prefix' ? 'active' : ''} onClick={() => setRuleMode('url-prefix')}>URL path</button>
                <button type="button" role="tab" aria-selected={ruleMode === 'keyword'} className={ruleMode === 'keyword' ? 'active' : ''} onClick={() => setRuleMode('keyword')}>URL keyword</button>
              </div>
              <form className="rule-form" onSubmit={(event) => void (ruleMode === 'domain' ? handleAddDomain(event) : ruleMode === 'url-prefix' ? handleAddUrlPrefix(event) : handleAddUrlKeyword(event))}>
                <div><input value={ruleMode === 'domain' ? domain : ruleMode === 'url-prefix' ? urlPrefix : urlKeyword} onChange={(event) => ruleMode === 'domain' ? setDomain(event.target.value) : ruleMode === 'url-prefix' ? setUrlPrefix(event.target.value) : setUrlKeyword(event.target.value)} placeholder={ruleMode === 'domain' ? 'e.g. reddit.com' : ruleMode === 'url-prefix' ? 'https://example.com/distraction' : 'e.g. shorts'} aria-label={ruleMode === 'domain' ? 'Website domain' : ruleMode === 'url-prefix' ? 'Specific URL path' : 'URL keyword'} /><button className="button button-primary" disabled={busy}>{ruleMode === 'domain' ? 'Add website' : ruleMode === 'url-prefix' ? 'Add path' : 'Add keyword'}</button></div>
                <small>{ruleMode === 'domain' ? 'Blocks the entire website, including subdomains.' : ruleMode === 'url-prefix' ? 'Blocks one specific page or URL path.' : 'Blocks any website URL containing this text.'}</small>
              </form>
              <div className="list-label">Blocked rules</div>
              <ul className="rule-list">
                {settings.blockedSites.length === 0 ? <li className="empty-row">No block rules yet. Add the first one above.</li> : settings.blockedSites.map((site) => (
                  <li key={site.id}><span className="rule-icon"><UiIcon name={site.type === 'keyword' ? 'sparkle' : 'globe'} /></span><div><strong>{site.type === 'url-prefix' ? site.pattern.replace(/^\|/, '') : site.pattern}</strong><small>{site.type === 'url-prefix' ? 'URL path' : site.type === 'keyword' ? 'URL keyword' : 'Entire website'}</small></div><button className="icon-button remove-button" disabled={busy} onClick={() => void handleRemove(site.id)} aria-label={`Remove ${site.pattern}`}><UiIcon name="close" /></button></li>
                ))}
              </ul>
            </section>

            <section className="dashboard-card" id="focus-tools">
              <div className="card-heading"><div><h2>Focus tools</h2><p>Remove high-distraction areas without blocking normal content.</p></div></div>
              <label className="feature-row"><span className="feature-icon"><UiIcon name="eye-off" /></span><span><strong>Block YouTube Shorts</strong><small>Hide shelves, links, and Shorts pages.</small></span><span className="fg-switch"><input type="checkbox" checked={settings.selectiveBlocking.youtubeShorts} disabled={busy} onChange={(event) => void save({ ...settings, selectiveBlocking: { ...settings.selectiveBlocking, youtubeShorts: event.target.checked } }, 'YouTube Shorts setting updated.')} /><i /></span></label>
              <label className="feature-row"><span className="feature-icon"><UiIcon name="eye-off" /></span><span><strong>Block Facebook Reels</strong><small>Hide Reel cards and block Reel pages.</small></span><span className="fg-switch"><input type="checkbox" checked={settings.selectiveBlocking.facebookFeedReels} disabled={busy} onChange={(event) => void save({ ...settings, selectiveBlocking: { ...settings.selectiveBlocking, facebookFeedReels: event.target.checked } }, 'Facebook Reels setting updated.')} /><i /></span></label>
              <label className="feature-row"><span className="feature-icon"><UiIcon name="eye-off" /></span><span><strong>Block Instagram Reels</strong><small>Hide Reel links and block Reel pages.</small></span><span className="fg-switch"><input type="checkbox" checked={settings.selectiveBlocking.instagramReels} disabled={busy} onChange={(event) => void save({ ...settings, selectiveBlocking: { ...settings.selectiveBlocking, instagramReels: event.target.checked } }, 'Instagram Reels setting updated.')} /><i /></span></label>
            </section>

            <section className="dashboard-card" id="schedule">
              <div className="card-heading"><div><h2>Schedule</h2><p>Apply website and keyword rules only during your chosen focus hours.</p></div><label className="fg-switch"><input type="checkbox" checked={settings.schedule.enabled} disabled={busy} onChange={(event) => updateSchedule('enabled', event.target.checked)} /><span /></label></div>
              {settings.schedule.enabled && <><div className="day-picker" aria-label="Focus days">{WEEK_DAYS.map((day) => <button key={day.value} type="button" disabled={busy} className={settings.schedule.days.includes(day.value) ? 'day-button active' : 'day-button'} onClick={() => toggleDay(day.value)}>{day.label}</button>)}</div><div className="time-grid"><label>Start<input type="time" value={settings.schedule.startTime} disabled={busy} onChange={(event) => updateSchedule('startTime', event.target.value)} /></label><label>End<input type="time" value={settings.schedule.endTime} disabled={busy} onChange={(event) => updateSchedule('endTime', event.target.value)} /></label></div></>}
              {!settings.schedule.enabled && <p className="schedule-off">Website and keyword rules are active all day. Focus tools always stay active.</p>}
            </section>
          </div>

          <aside className="settings-safety" id="safety">
            <h2>Safety</h2>
            <section className="safety-card"><label className="safety-row"><span className="feature-icon"><UiIcon name="shield" /></span><span><strong>Adult content shield</strong><small>{ADULT_DOMAIN_COUNT.toLocaleString()} known domains</small></span><span className="fg-switch"><input type="checkbox" checked={settings.adultContentShield.enabled} disabled={busy} onChange={(event) => void handleAdultShieldToggle(event.target.checked)} /><i /></span></label><label className="safety-row"><span className="feature-icon"><UiIcon name="calendar" /></span><span><strong>Strict Mode</strong><small>15-minute cooldown to turn off protection</small></span><span className="fg-switch"><input type="checkbox" checked={settings.strictMode.enabled} disabled={busy} onChange={(event) => void handleStrictModeToggle(event.target.checked)} /><i /></span></label>{strictModeCountdown && <p className="inline-warning">Strict Mode unlock pending: {strictModeCountdown}</p>}</section>
            <section className="safety-card reminder-card"><div className="card-heading"><div><h3>Uninstall reminder</h3><p>Open your hosted motivation page after removal.</p></div></div><label className="feature-row compact"><span><strong>Enable reminder</strong><small>Requires a secure hosted URL.</small></span><span className="fg-switch"><input type="checkbox" checked={settings.uninstallReminder.enabled} disabled={busy} onChange={(event) => void save({ ...settings, uninstallReminder: { ...settings.uninstallReminder, enabled: event.target.checked } }, event.target.checked ? 'The hosted reminder will open after removal.' : 'Uninstall reminder is off.')} /><i /></span></label><label className="field-label">Hosted reminder page URL<input value={settings.uninstallReminder.hostedPageUrl} disabled={busy} onChange={(event) => setSettings({ ...settings, uninstallReminder: { ...settings.uninstallReminder, hostedPageUrl: event.target.value } })} onBlur={() => void save(settings)} placeholder="https://your-private-page.example/reminder" inputMode="url" /></label></section>
            <p className="schedule-summary"><UiIcon name="calendar" /> {formatScheduleSummary(settings)}</p>
          </aside>
        </div>
        <p className="message" role="status">{message}</p>
      </div>
    </main>
  );
}
