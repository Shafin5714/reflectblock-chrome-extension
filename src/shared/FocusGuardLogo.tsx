export function FocusGuardLogo() {
  const iconUrl = typeof chrome === 'undefined'
    ? '/icons/icon-128.png'
    : chrome.runtime.getURL('icons/icon-128.png');

  return <img className="brand-mark" src={iconUrl} alt="" aria-hidden="true" />;
}
