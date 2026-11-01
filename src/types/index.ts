export type Tab = 'overview' | 'students' | 'attendance' | 'subject-attendance' | 'prayer-attendance' | 'academic' | 'reports' | 'exceptions' | 'settings' | 'admin-accounts';

export type Profile = {
  user_id: string;
  full_name: string;
  email: string;
  role: 'admin' | 'teacher' | 'parent' | 'viewer';
  avatar_path: string | null;
  platforms?: ('ppbs' | 'cim')[];
};

export type AdminAccount = {
  user_id: string;
  email: string;
  full_name: string;
  role: 'admin';
  created_at: string;
  last_sign_in_at: string | null;
};

export type Student = {
  id: string;
  student_code: string;
  full_name: string;
  class_name: string;
  parent_name: string | null;
  birth_place_date: string | null;
  photo_url: string | null;
  is_active: boolean;
  rfid_cards: { uid: string; is_active: boolean }[];
};

export type AttendanceRow = {
  id: string;
  student_id: string;
  attendance_date: string;
  check_in_at: string | null;
  check_out_at: string | null;
  status: string;
  note?: string | null;
  student?: { id: string; full_name: string; class_name: string; photo_url: string | null } | null;
};

export type Device = {
  id: string;
  name: string;
  location: string;
  is_online: boolean;
  last_seen_at: string | null;
};

export type Schedule = {
  id: string;
  name: string;
  work_start: string;
  check_in_end: string;
  checkout_start: string;
  checkout_end: string;
  late_tolerance_minutes: number;
  work_days: number[];
  is_active: boolean;
};

export type AttendanceHoliday = {
  id: string;
  holiday_date: string;
  name: string | null;
};

export type PrayerSchedule = {
  id: string;
  prayer_key: 'subuh' | 'zuhur' | 'asar' | 'magrib' | 'isya';
  name: string;
  opens_at: string;
  closes_at: string;
  is_active: boolean;
};

export type PrayerAttendanceRow = {
  id: string;
  student_id: string;
  prayer_key: PrayerSchedule['prayer_key'];
  prayer_date: string;
  checked_in_at: string;
  student?: { id: string; full_name: string; class_name: string; photo_url: string | null } | null;
};

