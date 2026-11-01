type LoadingSplashProps = {
  progress: number;
  message: string;
  darkMode: boolean;
};

export function LoadingSplash({ progress, message, darkMode }: LoadingSplashProps) {
  return (
    <main className="loading-splash" data-theme={darkMode ? 'dark' : 'light'} role="status" aria-live="polite" aria-busy="true">
      <div className="splash-orb splash-orb-one" aria-hidden="true" />
      <div className="splash-orb splash-orb-two" aria-hidden="true" />
      <section className="splash-card">
        <div className="splash-logo">
          <span><img src="/faviconinsani.png" alt="" /></span>
          <div><strong>SATU<span>INSANI</span></strong><small>PRESENSI PESANTREN</small></div>
        </div>
        <div className="splash-progress-copy">
          <span>{message}</span>
          <strong>{progress}%</strong>
        </div>
        <div className="splash-progress-track" role="progressbar" aria-label="Progress memuat aplikasi" aria-valuemin={1} aria-valuemax={100} aria-valuenow={progress}>
          <span style={{ width: `${progress}%` }} />
        </div>
        <p className="splash-caption">Menyiapkan ruang kerja untuk Anda</p>
      </section>
      <span className="loading-screen-reader">Memuat AbsensiSantri, {progress} persen.</span>
    </main>
  );
}
