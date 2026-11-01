import type { Profile, Tab } from '../../types';

export type PpbsRole = Profile['role'];

const allTabs: Tab[] = [
  'overview',
  'students',
  'attendance',
  'prayer-attendance',
  'exceptions',
  'reports',
  'settings',
  'admin-accounts',
];

const tabsByRole: Record<PpbsRole, Tab[]> = {
  admin: allTabs,
  teacher: ['overview', 'students', 'attendance', 'subject-attendance', 'prayer-attendance', 'academic', 'reports'],
  parent: ['overview', 'attendance', 'academic'],
  viewer: ['overview', 'attendance'],
};

const roleLabels: Record<PpbsRole, string> = {
  admin: 'Administrator',
  teacher: 'Guru',
  parent: 'Orang Tua',
  viewer: 'Viewer',
};

export function tabsForRole(role: PpbsRole | undefined): Tab[] {
  return tabsByRole[role ?? 'viewer'];
}

export function canAccessTab(role: PpbsRole | undefined, tab: Tab): boolean {
  return tabsForRole(role).includes(tab);
}

export function roleLabel(role: PpbsRole | undefined): string {
  return roleLabels[role ?? 'viewer'];
}
