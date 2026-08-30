type IconName = 'calendar' | 'chevron' | 'close' | 'eye-off' | 'globe' | 'home' | 'info' | 'settings' | 'shield' | 'sparkle';

export function UiIcon({ name, size = 20 }: { name: IconName; size?: number }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...common}>
      {name === 'home' && <><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9M9 20v-6h6v6" /></>}
      {name === 'globe' && <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></>}
      {name === 'eye-off' && <><path d="M3 3l18 18" /><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" /><path d="M9.8 4.3A10.9 10.9 0 0 1 12 4c5 0 8.6 4.3 9 8-.1.9-.5 1.9-1 2.8M6.1 6.1C4.2 7.5 3.2 9.8 3 12c.5 4 4.1 8 9 8 1.3 0 2.5-.3 3.6-.8" /></>}
      {name === 'calendar' && <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M7 3v4M17 3v4M3 10h18M12 14v4M12 14l2 2" /></>}
      {name === 'shield' && <><path d="M12 3 20 6v5.4c0 4.5-3.2 8.4-8 9.6-4.8-1.2-8-5.1-8-9.6V6l8-3Z" /><path d="m8.7 12 2.1 2.1 4.5-4.5" /></>}
      {name === 'settings' && <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.4 2.4-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5v.2h-3.4v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1-2.4-2.4.1-.1A1.7 1.7 0 0 0 6 15a1.7 1.7 0 0 0-1.5-1H4.3v-3.4h.2A1.7 1.7 0 0 0 6 9.1a1.7 1.7 0 0 0-.3-1.9l-.1-.1L8 4.7l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5v-.2h3.4v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1 2.4 2.4-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.2V14h-.2a1.7 1.7 0 0 0-1.4 1Z" /></>}
      {name === 'chevron' && <path d="m9 5 7 7-7 7" />}
      {name === 'close' && <path d="m6 6 12 12M18 6 6 18" />}
      {name === 'info' && <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>}
      {name === 'sparkle' && <path d="m12 3 1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6L12 3ZM19 16l.7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z" />}
    </svg>
  );
}
