type DashboardLoadingPageProps = {
  darkMode: boolean;
};

export function DashboardLoadingPage({ darkMode }: DashboardLoadingPageProps) {
  return (
    <main className="dashboard-loading" data-theme={darkMode ? 'dark' : 'light'} role="status" aria-live="polite" aria-busy="true">
      <div className="loading-orb loading-orb-one" aria-hidden="true" />
      <div className="loading-orb loading-orb-two" aria-hidden="true" />
      <aside className="loading-sidebar loading-glass" aria-hidden="true">
        <div className="loading-brand"><span><img src="/logoppbs.jpeg" alt="" /></span><i /></div>
        <div className="loading-workspace"><i /><span><i /><i /></span></div>
        <div className="loading-nav-label" />
        <div className="loading-nav-item active"><i /><span /></div>
        <div className="loading-nav-item"><i /><span /></div>
        <div className="loading-nav-item"><i /><span /></div>
        <div className="loading-nav-item"><i /><span /></div>
        <div className="loading-nav-item"><i /><span /></div>
        <div className="loading-nav-item"><i /><span /></div>
        <div className="loading-sidebar-footer"><i /><span><i /><i /></span></div>
      </aside>

      <section className="loading-main">
        <div className="loading-topbar loading-glass" aria-hidden="true">
          <div className="loading-breadcrumb"><i /><span /><i /></div>
          <div className="loading-topbar-actions"><i /><i /></div>
        </div>
        <div className="loading-content">
          <div className="loading-heading">
            <div><span className="loading-eyebrow" aria-hidden="true" /><h1>Presensi santri</h1><p>Ringkasan kehadiran santri hari ini.</p></div>
            <span className="loading-status"><i className="pulse" /> Menyiapkan dashboard</span>
          </div>
          <div className="loading-stats" aria-hidden="true">
            {[0, 1, 2, 3].map((item) => (
              <div className="loading-stat loading-glass" key={item}>
                <i className="loading-stat-icon" /><span><i /><i /><i /></span>
              </div>
            ))}
          </div>
          <div className="loading-panels" aria-hidden="true">
            <div className="loading-panel loading-glass loading-chart">
              <div className="loading-panel-title"><i /><i /></div>
              <div className="loading-chart-bars">{[34, 51, 42, 75, 58, 88, 64, 46, 70, 55, 82, 62].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}</div>
              <div className="loading-chart-footer"><i /></div>
            </div>
            <div className="loading-panel loading-glass loading-activity">
              <div className="loading-panel-title"><i /><i /></div>
              {[0, 1, 2].map((item) => <div className="loading-activity-row" key={item}><i /><span><i /><i /></span><i /></div>)}
              <div className="loading-activity-button" />
            </div>
          </div>
        </div>
      </section>
      <span className="loading-screen-reader">Menyiapkan dashboard AbsensiSantri.</span>
    </main>
  );
}
