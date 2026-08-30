(() => {
  const SETTINGS_KEY = 'focusGuardSettings';
  const STYLE_ID = 'focusguard-selective-blocking-style';

  function removeExistingStyle() {
    document.getElementById(STYLE_ID)?.remove();
  }

  function restoreFacebookFeedReels() {
    document.querySelectorAll('[data-focusguard-hidden="facebook-reel"]').forEach((article) => {
      article.style.removeProperty('display');
      article.removeAttribute('data-focusguard-hidden');
    });
  }

  function hideFacebookFeedReels() {
    document.querySelectorAll('[role="feed"] a[href*="/reel/"]').forEach((anchor) => {
      const article = anchor.closest('[role="article"]');
      if (article) {
        article.setAttribute('data-focusguard-hidden', 'facebook-reel');
        article.style.setProperty('display', 'none', 'important');
      }
    });
  }

  function applySelectiveBlocking(settings) {
    removeExistingStyle();
    restoreFacebookFeedReels();
    if (!settings?.protectionEnabled) return;
    const selective = settings?.selectiveBlocking || {};
    const css = [];

    if (location.hostname === 'www.youtube.com' && selective.youtubeShorts) {
      css.push(`
        ytd-rich-section-renderer:has(ytd-reel-shelf-renderer),
        ytd-reel-shelf-renderer,
        ytd-guide-entry-renderer:has(a[href^="/shorts"]),
        ytd-mini-guide-entry-renderer:has(a[href^="/shorts"]),
        ytd-mini-guide-renderer a[title="Shorts"] {
          display: none !important;
        }
      `);
    }

    if (location.hostname === 'www.facebook.com' && selective.facebookFeedReels) {
      hideFacebookFeedReels();
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
      applySelectiveBlocking(result[SETTINGS_KEY]);
    });
  }

  let pendingFacebookRefresh = false;
  const observer = new MutationObserver(() => {
    if (pendingFacebookRefresh) return;
    pendingFacebookRefresh = true;
    window.setTimeout(() => {
      pendingFacebookRefresh = false;
      chrome.storage.local.get(SETTINGS_KEY).then((result) => {
        const settings = result[SETTINGS_KEY];
        if (settings?.protectionEnabled && settings?.selectiveBlocking?.facebookFeedReels) hideFacebookFeedReels();
      });
    }, 250);
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
  chrome.storage.onChanged.addListener((_changes, areaName) => {
    if (areaName === 'local') refresh();
  });
  refresh();
})();
