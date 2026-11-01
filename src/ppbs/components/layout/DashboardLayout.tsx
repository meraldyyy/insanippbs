import { useState } from 'react';
import { Check, X } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Profile, Tab } from '../../../types';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { AdminProfileModal } from '../AdminProfileModal';

type DashboardLayoutProps = {
  activeTab: Tab;
  children: ReactNode;
  darkMode: boolean;
  hasNotifications: boolean;
  showPlatformLauncher: boolean;
  notificationMessage: string;
  mobileOpen: boolean;
  notice: string;
  profile: Profile | null;
  onClearNotice: () => void;
  onToggleTheme: () => void;
  onChangePlatform: () => void;
  onMenuClose: () => void;
  onMenuOpen: () => void;
  onNavigate: (tab: Tab) => void;
  onNotice: (message: string) => void;
  onProfileUpdated: (profile: Profile, message: string) => void;
  onSignOut: () => void;
};

export function DashboardLayout({
  activeTab,
  children,
  darkMode,
  hasNotifications,
  showPlatformLauncher,
  notificationMessage,
  mobileOpen,
  notice,
  profile,
  onClearNotice,
  onToggleTheme,
  onChangePlatform,
  onMenuClose,
  onMenuOpen,
  onNavigate,
  onNotice,
  onProfileUpdated,
  onSignOut,
}: DashboardLayoutProps) {
  const [profileSettingsOpen, setProfileSettingsOpen] = useState(false);

  return (
    <div className="app-shell" data-theme={darkMode ? 'dark' : 'light'}>
      <Sidebar
        activeTab={activeTab}
        mobileOpen={mobileOpen}
        profile={profile}
        onNavigate={onNavigate}
        onSignOut={onSignOut}
      />
      {mobileOpen && <button className="mobile-overlay" onClick={onMenuClose} aria-label="Tutup menu" />}
      <main className="main-content">
        <Topbar
          activeTab={activeTab}
          profile={profile}
          hasNotifications={hasNotifications}
          notificationMessage={notificationMessage}
          darkMode={darkMode}
          onToggleTheme={onToggleTheme}
          onMenuOpen={onMenuOpen}
          onNotice={onNotice}
          onProfileSettings={() => setProfileSettingsOpen(true)}
          onChangePlatform={onChangePlatform}
          showPlatformLauncher={showPlatformLauncher}
        />
        <div className="page-wrap">
          {notice && (
            <div className="notice">
              <Check size={17} />{notice}
              <button onClick={onClearNotice} aria-label="Tutup notifikasi"><X size={15} /></button>
            </div>
          )}
          {children}
        </div>
      </main>
      {profileSettingsOpen && profile?.role === 'admin' && (
        <AdminProfileModal
          profile={profile}
          onClose={() => setProfileSettingsOpen(false)}
          onUpdated={(updatedProfile, message) => {
            onProfileUpdated(updatedProfile, message);
            setProfileSettingsOpen(false);
          }}
        />
      )}
    </div>
  );
}
