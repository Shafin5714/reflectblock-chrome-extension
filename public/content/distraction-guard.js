(() => {
  const SETTINGS_KEY = 'focusGuardSettings';
  const STYLE_ID = 'focusguard-selective-blocking-style';
  const FACEBOOK_HIDDEN_ATTRIBUTE = 'data-focusguard-hidden';
  let currentSettings;
  let pendingFacebookRefresh = false;

  function isDomain(hostname, domain) {
    return hostname === domain || hostname.endsWith(`.${domain}`);
  }

  function isSite(domain) {
    return isDomain(location.hostname, domain);
  }

  function isBlockedDestination(url, settings = currentSettings) {
    if (!settings?.protectionEnabled) return false;
    const selective = settings.selectiveBlocking || {};

    return (selective.youtubeShorts
      && isDomain(url.hostname, 'youtube.com')
      && /^\/shorts(?:\/|$)/i.test(url.pathname))
      || (selective.facebookFeedReels
        && isDomain(url.hostname, 'facebook.com')
        && /^\/(?:reels?|share\/r)(?:\/|$)/i.test(url.pathname))
      || (selective.instagramReels
        && isDomain(url.hostname, 'instagram.com')
        && /^\/reels?(?:\/|$)/i.test(url.pathname));
  }

  function redirectFromBlockedDestination(url) {
    void url;
    location.replace(chrome.runtime.getURL('blocked.html'));
  }

  function enforceCurrentRoute(settings = currentSettings) {
    const currentUrl = new URL(location.href);
    if (!isBlockedDestination(currentUrl, settings)) return false;
    redirectFromBlockedDestination(currentUrl);
    return true;
  }

  function removeExistingStyle() {
    document.getElementById(STYLE_ID)?.remove();
  }

  function restoreFacebookFeedReels() {
    document.querySelectorAll(`[${FACEBOOK_HIDDEN_ATTRIBUTE}="facebook-reel"]`).forEach((feedUnit) => {
      feedUnit.removeAttribute(FACEBOOK_HIDDEN_ATTRIBUTE);
    });
  }

  function findFacebookFeedUnit(anchor) {
    const semanticFeedUnit = anchor.closest('[role="article"], [data-pagelet^="FeedUnit_"]');
    if (semanticFeedUnit) return semanticFeedUnit;

    const feed = anchor.closest('[role="feed"]');
    if (!feed) return null;

    let feedUnit = anchor;
    while (feedUnit.parentElement && feedUnit.parentElement !== feed) {
      feedUnit = feedUnit.parentElement;
    }
    return feedUnit === anchor ? null : feedUnit;
  }

  function hideFacebookFeedReels() {
    document.querySelectorAll('[role="feed"] a[href*="/reel/"], [role="feed"] a[href*="/reels/"], [role="feed"] a[href*="/share/r/"]').forEach((anchor) => {
      const feedUnit = findFacebookFeedUnit(anchor);
      feedUnit?.setAttribute(FACEBOOK_HIDDEN_ATTRIBUTE, 'facebook-reel');
    });
  }

  function applySelectiveBlocking(settings) {
    removeExistingStyle();
    restoreFacebookFeedReels();
    if (!settings?.protectionEnabled) return;
    if (enforceCurrentRoute(settings)) return;
    const selective = settings?.selectiveBlocking || {};
    const css = [];

    if (isSite('youtube.com') && selective.youtubeShorts) {
      css.push(`
        ytd-rich-section-renderer:has(ytd-reel-shelf-renderer),
        ytd-rich-section-renderer:has(ytd-rich-shelf-renderer[is-shorts]),
        ytd-rich-section-renderer:has(a[href*="/shorts/"]),
        ytd-reel-shelf-renderer,
        ytd-rich-shelf-renderer[is-shorts],
        ytd-rich-item-renderer:has(a[href*="/shorts/"]),
        ytd-video-renderer:has(a[href*="/shorts/"]),
        ytd-grid-video-renderer:has(a[href*="/shorts/"]),
        ytd-compact-video-renderer:has(a[href*="/shorts/"]),
        ytd-guide-entry-renderer:has(a[href*="/shorts"]),
        ytd-mini-guide-entry-renderer:has(a[href*="/shorts"]),
        ytd-mini-guide-renderer a[href*="/shorts"],
        yt-tab-shape:has(a[href*="/shorts"]),
        a.yt-simple-endpoint[href="/shorts/"] {
          display: none !important;
        }
      `);
    }

    if (isSite('facebook.com') && selective.facebookFeedReels) {
      css.push(`
        [${FACEBOOK_HIDDEN_ATTRIBUTE}="facebook-reel"],
        [role="feed"] [role="article"]:has(a[href*="/reel/"]),
        [role="feed"] [role="article"]:has(a[href*="/reels/"]),
        [role="feed"] [role="article"]:has(a[href*="/share/r/"]),
        [role="feed"] [data-pagelet^="FeedUnit_"]:has(a[href*="/reel/"]),
        [role="feed"] [data-pagelet^="FeedUnit_"]:has(a[href*="/reels/"]),
        [role="feed"] [data-pagelet^="FeedUnit_"]:has(a[href*="/share/r/"]) {
          display: none !important;
        }
      `);
      hideFacebookFeedReels();
    }

    if (isSite('instagram.com') && selective.instagramReels) {
      css.push(`
        nav a[href^="/reels"],
        main article:has(a[href^="/reel/"]),
        main a[href^="/reel/"],
        main a[href^="/reels/"] {
          display: none !important;
        }
      `);
    }

    if (css.length > 0) {
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = css.join('\n');
      document.documentElement.appendChild(style);
    }
  }

  function refresh() {
    chrome.storage.local.get(SETTINGS_KEY).then((result) => {
      currentSettings = result[SETTINGS_KEY];
      applySelectiveBlocking(currentSettings);
    });
  }

  const observer = new MutationObserver(() => {
    if (enforceCurrentRoute()) return;
    if (!isSite('facebook.com') || !currentSettings?.protectionEnabled
      || !currentSettings?.selectiveBlocking?.facebookFeedReels) return;
    if (pendingFacebookRefresh) return;
    pendingFacebookRefresh = true;
    window.setTimeout(() => {
      pendingFacebookRefresh = false;
      hideFacebookFeedReels();
    }, 250);
  });

  document.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;
    const anchor = event.target.closest('a[href]');
    if (!anchor) return;

    const destination = new URL(anchor.href, location.href);
    if (!isBlockedDestination(destination)) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    redirectFromBlockedDestination(destination);
  }, true);

  window.addEventListener('popstate', () => enforceCurrentRoute());
  document.addEventListener('yt-navigate-start', () => window.setTimeout(enforceCurrentRoute, 0));
  document.addEventListener('yt-navigate-finish', () => enforceCurrentRoute());

  observer.observe(document.documentElement, { childList: true, subtree: true });
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes[SETTINGS_KEY]) refresh();
  });
  refresh();
})();
