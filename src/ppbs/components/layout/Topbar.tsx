import { Activity, AppWindow, Menu, Settings } from 'lucide-react';
import { AdminAvatar } from '../../../components/AdminAvatar';
import { ThemeToggle } from '../../../components/ThemeToggle';
import type { Profile, Tab } from '../../../types';

const labels: Record<Tab, string> = {
  overview: 'Ringkasan',
  students: 'Santri',
  attendance: 'Log Absensi',
  'subject-attendance': 'Absensi Mapel',
  'prayer-attendance': 'Presensi Sholat',
  academic: 'Penilaian Akademik',
  reports: 'Rekap & Laporan',
  exceptions: 'Izin & Sakit',
  settings: 'Pengaturan',
  'admin-accounts': 'Akun Admin',
};

type TopbarProps = {
  activeTab: Tab;
  profile: Profile | null;
  hasNotifications: boolean;
  notificationMessage: string;
  onMenuOpen: () => void;
  darkMode: boolean;
  onToggleTheme: () => void;
  onChangePlatform: () => void;
  onNotice: (message: string) => void;
  onProfileSettings: () => void;
  showPlatformLauncher: boolean;
};

export function Topbar({ activeTab, profile, hasNotifications, notificationMessage, onMenuOpen, darkMode, onToggleTheme, onChangePlatform, onNotice, onProfileSettings, showPlatformLauncher }: TopbarProps) {
  return (
    <header className="topbar">
      <button className="mobile-menu" onClick={onMenuOpen} aria-label="Buka menu"><Menu size={21} /></button>
      <div className="breadcrumbs"><span>Workspace</span><b>/</b><strong>{labels[activeTab]}</strong></div>
      <div className="topbar-actions">
        <ThemeToggle darkMode={darkMode} onToggle={onToggleTheme} />
        {showPlatformLauncher && (
          <button type="button" className="platform-switch-button" onClick={onChangePlatform}>
            <AppWindow size={15} /><span>Aplikasi</span>
          </button>
        )}
        {profile?.role === 'admin' && <div className="live-indicator"><span className="status-dot" />USB scan aktif</div>}
        <button className="icon-button" aria-label="Notifikasi" onClick={() => onNotice(notificationMessage)}>
          <Activity size={18} />{hasNotifications && <i />}
        </button>
        {profile?.role === 'admin' && (
          <button className="profile-settings-trigger" type="button" onClick={onProfileSettings} aria-label="Pengaturan profil admin">
            <AdminAvatar userId={profile.user_id} fullName={profile.full_name} photoPath={profile.avatar_path} className="top-avatar-photo" />
            <span className="profile-settings-name">{profile.full_name}</span>
            <Settings size={15} aria-hidden="true" />
          </button>
        )}
      </div>
    </header>
  );
}
