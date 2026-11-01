import { useEffect, useState, type FormEvent } from 'react';
import { AlertCircle, ChevronLeft, ChevronRight, Eye, EyeOff } from 'lucide-react';
import { Brand } from '../components/Brand';
import { ThemeToggle } from '../components/ThemeToggle';
import { api } from '../lib/api';

type AuthPageProps = {
  darkMode: boolean;
  onToggleTheme: () => void;
};

const publicAsset = (fileName: string) => `${import.meta.env.BASE_URL}${fileName}`;
const rememberedEmailKey = 'insani-remembered-email';

const authSlides = [
  { src: publicAsset('auth-slide-1.png'), alt: 'Aktivitas santri 1' },
  { src: publicAsset('auth-slide-2.png'), alt: 'Aktivitas santri 2' },
  { src: publicAsset('auth-slide-3.png'), alt: 'Aktivitas santri 3' },
  { src: publicAsset('auth-slide-4.jpg'), alt: 'Aktivitas santri 4' },
];

export function AuthPage({ darkMode, onToggleTheme }: AuthPageProps) {
  const [email, setEmail] = useState(() => window.localStorage.getItem(rememberedEmailKey) ?? '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => Boolean(window.localStorage.getItem(rememberedEmailKey)));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % authSlides.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, []);

  function changeSlide(direction: number) {
    setActiveSlide((current) => (current + direction + authSlides.length) % authSlides.length);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await api.auth.signInWithPassword({ email, password });
      if (result.error) {
        setError(result.error.message.includes('Invalid login') ? 'Email atau kata sandi belum benar.' : result.error.message);
      } else if (rememberMe) {
        window.localStorage.setItem(rememberedEmailKey, email.trim());
      } else {
        window.localStorage.removeItem(rememberedEmailKey);
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Terjadi kesalahan saat menghubungi server.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-screen" data-theme={darkMode ? 'dark' : 'light'}>
      <div className="auth-visual">
        <div className="auth-slider" aria-label="Galeri aktivitas santri">
          {authSlides.map((slide, index) => (
            <div className={`auth-slide${index === activeSlide ? ' active' : ''}`} key={slide.src}>
              <img
                src={slide.src}
                alt={slide.alt}
                onError={(event) => {
                  event.currentTarget.style.display = 'none';
                  event.currentTarget.parentElement?.classList.add('is-missing');
                }}
              />
            </div>
          ))}
        </div>
        <div className="auth-copy">
          <Brand light platform="satuinsani" />
          <div className="auth-hero">
            <p className="eyebrow">EKOSISTEM INSANI</p>
            <h1>Integrasi Sistem <br /><span>Aktivitas dan Nilai Santri.</span></h1>
            <p>Kelola presensi santri secara otomatis, akurat, dan real-time dari satu dashboard yang tenang.</p>
          </div>
        </div>
        <div className="auth-slider-controls">
          <button type="button" onClick={() => changeSlide(-1)} aria-label="Foto sebelumnya"><ChevronLeft size={17} /></button>
          <div className="auth-slider-dots" aria-label="Pilih foto">
            {authSlides.map((slide, index) => (
              <button
                type="button"
                key={slide.src}
                className={index === activeSlide ? 'active' : ''}
                onClick={() => setActiveSlide(index)}
                aria-label={`Tampilkan foto ${index + 1}`}
                aria-current={index === activeSlide ? 'true' : undefined}
              />
            ))}
          </div>
          <button type="button" onClick={() => changeSlide(1)} aria-label="Foto berikutnya"><ChevronRight size={17} /></button>
        </div>
      </div>
      <div className="auth-panel">
        <ThemeToggle darkMode={darkMode} className="auth-theme-toggle" onToggle={onToggleTheme} />
        <div className="auth-form-wrap">
          <Brand compact platform="satuinsani" />
          <p className="eyebrow">SELAMAT DATANG KEMBALI</p>
          <h2>Masuk ke PPBS</h2>
          <p className="auth-subtitle">Masuk dengan akun yang dibuat administrator.</p>
          <form onSubmit={handleSubmit}>
            <label>Email kerja<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nama@perusahaan.com" required /></label>
            <label>Kata sandi<span className="password-input-wrap"><input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Minimal 6 karakter" minLength={6} required /><button className="password-visibility-button" type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></span></label>
            <label className="remember-me"><input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} /><span>Ingat email saya</span></label>
            {error && <div className="form-message"><AlertCircle size={15} />{error}</div>}
            <button className="primary-button auth-button" disabled={busy}>
              {busy ? 'Memproses...' : 'Masuk ke dashboard'}
            </button>
          </form>
          <p className="auth-switch">Belum punya akun? Hubungi administrator untuk dibuatkan akun.</p>
        </div>
        <small className="auth-footer">Dengan melanjutkan, Anda menyetujui kebijakan penggunaan AbsensiSantri.</small>
      </div>
    </div>
  );
}
