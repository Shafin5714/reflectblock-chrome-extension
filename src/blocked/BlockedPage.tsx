export function BlockedPage() {
  return (
    <main className="blocked-page">
      <section className="blocked-card">
        <div className="blocked-icon" aria-hidden="true">!</div>
        <p className="blocked-kicker">REFLECTBLOCK</p>
        <h1>This page is blocked.</h1>
        <p>ReflectBlock blocked this page based on your current protection settings. Stay focused.</p>
        <div className="blocked-actions">
          <button className="button button-primary" onClick={() => history.back()}>Go Back</button>
          <button className="button button-secondary" onClick={() => chrome.runtime.openOptionsPage()}>
            Open ReflectBlock Settings
          </button>
        </div>
      </section>
    </main>
  );
}
