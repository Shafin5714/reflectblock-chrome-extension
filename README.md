# FocusGuard

FocusGuard is a privacy-focused Chrome extension for selective website and distraction blocking.

This repository currently contains the **v0.3 adult-content protection milestone**:

- React + TypeScript + Vite
- Chrome Manifest V3
- Extension popup
- Current-site detection
- Local storage abstraction
- Dynamic domain and URL-prefix blocking with Manifest V3 `declarativeNetRequest`
- Custom FocusGuard block page
- Blocking schedules, including overnight schedules
- Adult Content Shield with a bundled, curated domain snapshot
- YouTube Shorts and Facebook feed-Reels hiding
- Strict Mode: a 15-minute intentional delay before protection can be disabled
- Uninstall reminder configuration for a hosted, personal motivation page
- Full settings page

The **Block Current Website** button saves the hostname locally, creates a dynamic blocking rule, and reloads the current tab onto the FocusGuard block page. A hostname rule covers all paths and subdomains. URL-prefix rules can block only a specific path.

## Adult Content Shield

Adult Content Shield is enabled by default and uses a bundled snapshot of 155,830
known adult-content domains. The rules are packaged with the extension: no browsing
history or visited URLs are sent to a server. Chrome's static-rule quota is shared
with other filtering extensions, so FocusGuard enables as many of its six adult
rulesets as the browser permits. The source and license notice are in
`THIRD_PARTY_NOTICES.md`.

An uninstall reminder must use an `https` page hosted outside the extension. Chrome removes the extension files and local settings before it opens the reminder page, so a personal photo cannot be stored only in Chrome extension storage.

## Development

```bash
npm install
npm run build
```

## Install in Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this project's `dist` folder.
5. Pin FocusGuard and open its popup.

After making changes, run `npm run build` again and click the reload button on the extension card.
