type PlatformLoadingPageProps = {
  darkMode: boolean;
};

export function PlatformLoadingPage({ darkMode }: PlatformLoadingPageProps) {
  return (
    <main className="platform-loading" data-theme={darkMode ? 'dark' : 'light'} role="status" aria-live="polite" aria-busy="true">
      <div className="platform-loading-orb platform-loading-orb-one" aria-hidden="true" />
      <div className="platform-loading-orb platform-loading-orb-two" aria-hidden="true" />

      <aside className="platform-loading-sidebar" aria-hidden="true">
        <div className="platform-loading-brand">
          <span><img src="/faviconinsani.png" alt="" /></span>
          <div><strong>INSANI</strong><small>EKOSISTEM DIGITAL</small></div>
        </div>
        <p className="platform-loading-nav-label">MAIN MENU</p>
        <div className="platform-loading-nav">
          <i className="active"><b /><span /></i>
          <i><b /><span /></i>
        </div>
        <div className="platform-loading-sidebar-account">
          <i />
          <span><b /><small /></span>
        </div>
      </aside>

      <section className="platform-loading-main">
        <header className="platform-loading-header">
          <div className="platform-loading-date"><i /> <span /></div>
          <i className="platform-loading-account" aria-hidden="true" />
        </header>

        <div className="platform-loading-content">
          <div className="platform-loading-intro">
            <span className="platform-loading-eyebrow"><i /> EKOSISTEM INSANI</span>
            <h1>Menyiapkan ruang aplikasi</h1>
            <p>Sebentar ya, kami sedang menyiapkan platform untukmu.</p>
          </div>

          <div className="platform-loading-search" aria-hidden="true"><i /><span /></div>
          <div className="platform-loading-categories" aria-hidden="true"><i /><i /><i /><i /><i /></div>
          <div className="platform-loading-section" aria-hidden="true"><i /><span /></div>

          <div className="platform-loading-grid" aria-hidden="true">
            <article className="platform-loading-card platform-loading-card-active">
              <div className="platform-loading-card-top">
                <span className="platform-loading-logo"><img src="/logoppbs.jpeg" alt="" /></span>
                <i className="platform-loading-status" />
              </div>
              <i className="platform-loading-line platform-loading-line-title" />
              <i className="platform-loading-line platform-loading-line-short" />
              <i className="platform-loading-line platform-loading-line-copy" />
              <div className="platform-loading-tags"><i /><i /><i /></div>
              <i className="platform-loading-button" />
            </article>

            <article className="platform-loading-card">
              <div className="platform-loading-card-top">
                <span className="platform-loading-cim">CIM</span>
                <i className="platform-loading-status platform-loading-status-soon" />
              </div>
              <i className="platform-loading-line platform-loading-line-title" />
              <i className="platform-loading-line platform-loading-line-short" />
              <i className="platform-loading-line platform-loading-line-copy" />
              <div className="platform-loading-tags"><i /><i /></div>
              <i className="platform-loading-button platform-loading-button-muted" />
            </article>
          </div>
        </div>
        <span className="platform-loading-screen-reader">Menyiapkan pemilih aplikasi Insani.</span>
      </section>
    </main>
  );
}
