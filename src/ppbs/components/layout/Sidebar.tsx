import {
  Activity,
  ArrowDownToLine,
  CalendarDays,
  ClipboardCheck,
  ClipboardPlus,
  LogOut,
  Moon,
  School,
  Settings2,
  Users,
  UserCog,
} from 'lucide-react';
import type { Profile, Tab } from '../../../types';
import { Brand } from '../../../components/Brand';
import { AdminAvatar } from '../../../components/AdminAvatar';
import { roleLabel, tabsForRole } from '../../dashboards/roleAccess';

type SidebarProps = {
  activeTab: Tab;
  mobileOpen: boolean;
  profile: Profile | null;
  onNavigate: (tab: Tab) => void;
  onSignOut: () => void;
};

const navigation: { tab: Tab; label: string; icon: typeof Activity }[] = [
  { tab: 'overview', label: 'Ringkasan', icon: Activity },
  { tab: 'students', label: 'Santri', icon: Users },
  { tab: 'attendance', label: 'Log Absensi', icon: CalendarDays },
  { tab: 'subject-attendance', label: 'Absensi Mapel', icon: ClipboardCheck },
  { tab: 'prayer-attendance', label: 'Presensi Sholat', icon: Moon },
  { tab: 'exceptions', label: 'Izin & Sakit', icon: ClipboardPlus },
  { tab: 'academic', label: 'Penilaian Akademik', icon: School },
  { tab: 'reports', label: 'Rekap & Laporan', icon: ArrowDownToLine },
  { tab: 'settings', label: 'Pengaturan', icon: Settings2 },
  { tab: 'admin-accounts', label: 'Akun Admin', icon: UserCog },
];

export function Sidebar({ activeTab, mobileOpen, profile, onNavigate, onSignOut }: SidebarProps) {
  const visibleTabs = tabsForRole(profile?.role);
  const visibleNavigation = navigation.filter(({ tab }) => visibleTabs.includes(tab));
  return (
    <>
      <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
        <Brand platform="ppbs" />
        <nav>
          {visibleNavigation.map(({ tab, label, icon: Icon }) => (
            <button
              key={tab}
              className={`nav-item ${activeTab === tab ? 'active' : ''}`}
              onClick={() => onNavigate(tab)}
            >
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="user-card">
            {profile?.role === 'admin'
              ? <AdminAvatar userId={profile.user_id} fullName={profile.full_name} photoPath={profile.avatar_path} className="sidebar-admin-avatar" />
              : <div className="avatar">{(profile?.full_name || 'AD').slice(0, 2).toUpperCase()}</div>}
            <div>
              <b>{profile?.full_name || 'Administrator'}</b>
              <small><span style={{ color: 'white' }}>{roleLabel(profile?.role)}</span></small>
            </div>
            <button aria-label="Keluar" onClick={onSignOut}><LogOut size={16} /></button>
          </div>
        </div>
      </aside>
    </>
  );
}
