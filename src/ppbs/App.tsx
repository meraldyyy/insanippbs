import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { UsbRfidScanner } from './components/UsbRfidScanner';
import { localDateKey, parseTimestamp } from './lib/format';
import { attendanceMonitorChannelName, type AttendanceMonitorEvent } from './lib/attendanceMonitor';
import { api } from '../lib/api';
import { AttendancePage } from './pages/AttendancePage';
import { PrayerAttendancePage } from './pages/PrayerAttendancePage';
import { AuthPage } from '../pages/AuthPage';
import { StudentsPage } from './pages/StudentsPage';
import { OverviewPage } from './pages/OverviewPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import { AdminAccountsPage } from './pages/AdminAccountsPage';
import { ExceptionsPage } from './pages/ExceptionsPage';
import { SubjectAttendancePage } from './pages/SubjectAttendancePage';
import { canAccessTab } from './dashboards/roleAccess';
import type { AttendanceHoliday, AttendanceRow, PrayerAttendanceRow, Profile, Schedule, Student, Tab } from '../types';

const AttendanceMonitorPage = lazy(() => import('./components/AttendanceMonitorPage').then(
  ({ AttendanceMonitorPage: MonitorPage }) => ({ default: MonitorPage }),
));
const AcademicPage = lazy(() => import('./pages/AcademicPage').then(
  ({ AcademicPage: Page }) => ({ default: Page }),
));

const themeKey = 'insani-theme';
const activeTabKey = 'insani-active-tab';
const validTabs: Tab[] = ['overview', 'students', 'attendance', 'subject-attendance', 'prayer-attendance', 'academic', 'reports', 'exceptions', 'settings', 'admin-accounts'];

function initialActiveTab(): Tab {
  const storedTab = window.localStorage.getItem(activeTabKey);
  return storedTab && validTabs.includes(storedTab as Tab) ? storedTab as Tab : 'overview';
}

function dailyReportRows(
  students: Student[],
  records: AttendanceRow[],
  startDate: string,
  endDate: string,
  workDays: number[],
  holidays: string[],
): AttendanceRow[] {
  const activeStudents = students.filter((student) => student.is_active);
  const rowsByStudentDate = new Map(records.map((row) => [`${row.student_id}:${row.attendance_date}`, row]));
  const holidayDates = new Set(holidays);
  const rows: AttendanceRow[] = [];
  const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
  const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
  const current = new Date(Date.UTC(startYear, startMonth - 1, startDay));
  const end = Date.UTC(endYear, endMonth - 1, endDay);

  while (current.getTime() <= end) {
    const date = current.toISOString().slice(0, 10);
    const isWorkDay = workDays.includes(current.getUTCDay());
    for (const student of activeStudents) {
      const existingRow = rowsByStudentDate.get(`${student.id}:${date}`);
      if (existingRow) {
        rows.push(existingRow);
      } else if (isWorkDay && !holidayDates.has(date)) {
        rows.push({
          id: `absent-${student.id}-${date}`,
          student_id: student.id,
          attendance_date: date,
          check_in_at: null,
          check_out_at: null,
          status: 'absent',
          student: {
            id: student.id,
            full_name: student.full_name,
            class_name: student.class_name,
            photo_url: student.photo_url,
          },
        });
      }
    }
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return rows;
}

function normalizeAttendanceRows(rows: AttendanceRow[]): AttendanceRow[] {
  return rows.map((row) => ({
    ...row,
    student: Array.isArray(row.student) ? row.student[0] ?? null : row.student,
  })) as AttendanceRow[];
}

function monthBounds(month: string) {
  const [year, monthNumber] = month.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return {
    startDate: `${month}-01`,
    endDate: `${month}-${String(lastDay).padStart(2, '0')}`,
  };
}

type PpbsAppProps = {
  showPlatformLauncher?: boolean;
  onOpenLauncher?: () => void;
};

export function PpbsApp({ showPlatformLauncher = false, onOpenLauncher }: PpbsAppProps = {}) {
  const isAttendanceMonitor = new URLSearchParams(window.location.search).get('attendance-display') === '1';
  const [session, setSession] = useState<boolean | null>(null);
  const [loadingScreen, setLoadingScreen] = useState<'splash' | 'page' | null>('splash');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [darkMode, setDarkMode] = useState(() => window.localStorage.getItem(themeKey) === 'dark');
  const [activeTab, setActiveTab] = useState<Tab>(initialActiveTab);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [attendancePageRows, setAttendancePageRows] = useState<AttendanceRow[]>([]);
  const [overviewAttendance, setOverviewAttendance] = useState<AttendanceRow[]>([]);
  const [overviewMonth, setOverviewMonth] = useState(localDateKey().slice(0, 7));
  const [reportRows, setReportRows] = useState<AttendanceRow[]>([]);
  const [prayerReportRows, setPrayerReportRows] = useState<PrayerAttendanceRow[]>([]);
  const [scanRevision, setScanRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notice, setNoticeState] = useState('');
  const noticeTimeout = useRef<number | null>(null);
  const splashTimeout = useRef<number | null>(null);
  const initialSessionResolved = useRef(false);
  const wasAuthenticated = useRef(false);
  const attendanceMonitorChannel = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    if (isAttendanceMonitor) return;
    const channel = new BroadcastChannel(attendanceMonitorChannelName);
    attendanceMonitorChannel.current = channel;
    return () => {
      channel.close();
      attendanceMonitorChannel.current = null;
    };
  }, [isAttendanceMonitor]);

  const setNotice = useCallback((message: string) => {
    if (noticeTimeout.current !== null) {
      window.clearTimeout(noticeTimeout.current);
      noticeTimeout.current = null;
    }
    setNoticeState(message);
  }, []);

  const setTimedNotice = useCallback((message: string) => {
    setNotice(message);
    noticeTimeout.current = window.setTimeout(() => {
      setNoticeState('');
      noticeTimeout.current = null;
    }, 5000);
  }, [setNotice]);

  const clearNotice = useCallback(() => setNotice(''), [setNotice]);

  const finishLoadingScreen = useCallback(() => {
    if (splashTimeout.current !== null) window.clearTimeout(splashTimeout.current);
    splashTimeout.current = window.setTimeout(() => {
      setLoadingScreen(null);
      splashTimeout.current = null;
    }, 350);
  }, []);

  useEffect(() => {
    let mounted = true;
    api.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) setNotice(`Gagal memeriksa sesi: ${error.message}`);
      const nextSession = Boolean(data.session);
      initialSessionResolved.current = true;
      wasAuthenticated.current = nextSession;
      setSession(nextSession);
      setLoading(!nextSession);
      if (nextSession) {
        setLoadingScreen('page');
      } else {
        finishLoadingScreen();
      }
    }).catch((error: unknown) => {
      if (!mounted) return;
      setNotice(error instanceof Error ? error.message : 'Gagal memeriksa sesi.');
      setSession(false);
      finishLoadingScreen();
      setLoading(false);
    });

    const { data: listener } = api.auth.onAuthStateChange((event, nextSession) => {
      const isLoggedIn = Boolean(nextSession);
      if (event === 'INITIAL_SESSION') {
        initialSessionResolved.current = true;
        wasAuthenticated.current = isLoggedIn;
      } else if (event === 'SIGNED_OUT') {
        wasAuthenticated.current = false;
        setProfile(null);
        setLoadingScreen(null);
        if (splashTimeout.current !== null) window.clearTimeout(splashTimeout.current);
      } else if (event === 'SIGNED_IN') {
        if (initialSessionResolved.current && !wasAuthenticated.current) {
          setLoadingScreen('page');
          if (splashTimeout.current !== null) window.clearTimeout(splashTimeout.current);
        }
        wasAuthenticated.current = true;
      }
      setSession(isLoggedIn);
      setLoading(!isLoggedIn);
    });

    return () => {
      mounted = false;
      if (splashTimeout.current !== null) window.clearTimeout(splashTimeout.current);
      if (noticeTimeout.current !== null) window.clearTimeout(noticeTimeout.current);
      listener.subscription.unsubscribe();
    };
  }, [finishLoadingScreen, setNotice]);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const { data: sessionResult, error: sessionError } = await api.auth.getSession();
      if (sessionError) throw sessionError;
      if (!sessionResult.session?.user) throw new Error('Sesi login tidak memiliki pengguna yang valid.');

      const profileResult = await api
        .from('profiles')
        .select('full_name, role, avatar_path')
        .eq('user_id', sessionResult.session.user.id)
        .maybeSingle();
      if (profileResult.error) throw profileResult.error;
      setProfile(profileResult.data
        ? {
            ...profileResult.data,
            user_id: sessionResult.session.user.id,
            email: sessionResult.session.user.email ?? '',
          } as Profile
          : null);
      const currentMonth = localDateKey().slice(0, 7);
      const { startDate: currentMonthStart, endDate: fullCurrentMonthEnd } = monthBounds(currentMonth);
      const currentMonthEnd = currentMonth === localDateKey().slice(0, 7) ? localDateKey() : fullCurrentMonthEnd;
      const [studentResult, cardResult, attendanceResult, overviewAttendanceResult, prayerAttendanceResult, scheduleResult, holidayResult] = await Promise.all([
        api.from<Omit<Student, 'rfid_cards'>>('students').select('id, student_code, full_name, class_name, parent_name, birth_place_date, photo_url, is_active').order('full_name'),
        api.from<{ student_id: string; uid: string; is_active: boolean }>('cards').select('student_id, uid, is_active'),
        api.from<AttendanceRow>('attendance').select('id, student_id, attendance_date, check_in_at, check_out_at, status, note, student:students(id, full_name, class_name, photo_url)').eq('attendance_date', localDateKey()).order('check_in_at', { ascending: false }),
        api.from<AttendanceRow>('attendance').select('id, student_id, attendance_date, check_in_at, check_out_at, status, note, student:students(id, full_name, class_name, photo_url)').gte('attendance_date', currentMonthStart).lte('attendance_date', currentMonthEnd).order('attendance_date').order('check_in_at', { ascending: false }),
        api.from<PrayerAttendanceRow>('prayer_attendance').select('id, student_id, prayer_key, prayer_date, checked_in_at, student:students(id, full_name, class_name, photo_url)').eq('prayer_date', localDateKey()).order('checked_in_at', { ascending: false }),
        api.from<Pick<Schedule, 'work_days'>>('schedules').select('work_days').eq('is_active', true).limit(1).maybeSingle(),
        api.from<Pick<AttendanceHoliday, 'holiday_date' | 'name'>>('attendance_holidays').select('holiday_date, name').gte('holiday_date', currentMonthStart).lte('holiday_date', currentMonthEnd),
      ]);

      if (studentResult.error) throw studentResult.error;
      if (cardResult.error) throw cardResult.error;
      if (attendanceResult.error) throw attendanceResult.error;
      if (overviewAttendanceResult.error) throw overviewAttendanceResult.error;
      if (prayerAttendanceResult.error) throw prayerAttendanceResult.error;
      if (scheduleResult.error) throw scheduleResult.error;
      if (holidayResult.error) throw holidayResult.error;
      if (!scheduleResult.data) throw new Error('Jadwal aktif tidak ditemukan.');

      const cardsByStudent = new Map<string, { uid: string; is_active: boolean }[]>();
      for (const card of cardResult.data ?? []) {
        const cards = cardsByStudent.get(card.student_id) ?? [];
        cards.push({ uid: card.uid, is_active: card.is_active });
        cardsByStudent.set(card.student_id, cards);
      }
      const loadedStudents = (studentResult.data ?? []).map((student) => ({
        ...student,
        rfid_cards: cardsByStudent.get(student.id) ?? [],
      })) as Student[];
      setStudents(loadedStudents);
      const todayRows = (attendanceResult.data ?? []).map((row) => ({
        ...row,
        student: Array.isArray(row.student) ? row.student[0] ?? null : row.student,
      })) as AttendanceRow[];
      setAttendance(todayRows);
      setAttendancePageRows(todayRows);
      setOverviewAttendance(dailyReportRows(
        loadedStudents,
        normalizeAttendanceRows(overviewAttendanceResult.data ?? []),
        currentMonthStart,
        currentMonthEnd,
        scheduleResult.data.work_days,
        (holidayResult.data ?? []).map((holiday) => holiday.holiday_date),
      ));
      setOverviewMonth(currentMonth);
      setReportRows(dailyReportRows(
        loadedStudents,
        todayRows,
        localDateKey(),
        localDateKey(),
        scheduleResult.data.work_days,
        (holidayResult.data ?? []).filter((holiday) => holiday.holiday_date === localDateKey()).map((holiday) => holiday.holiday_date),
      ));
      setPrayerReportRows((prayerAttendanceResult.data ?? []).map((row) => ({
        ...row,
        student: Array.isArray(row.student) ? row.student[0] ?? null : row.student,
      })) as PrayerAttendanceRow[]);
    } catch (error) {
      setNotice(error instanceof Error ? `Gagal memuat dashboard: ${error.message}` : 'Gagal memuat data dashboard.');
    } finally {
      setLoading(false);
      finishLoadingScreen();
    }
  }, [finishLoadingScreen, setNotice]);

  const loadAttendanceRange = useCallback(async (startDate: string, endDate: string) => {
    try {
      const { data, error } = await api
        .from<AttendanceRow>('attendance')
        .select('id, student_id, attendance_date, check_in_at, check_out_at, status, note, student:students(id, full_name, class_name, photo_url)')
        .gte('attendance_date', startDate)
        .lte('attendance_date', endDate)
        .order('attendance_date', { ascending: false })
        .order('check_in_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row) => ({
        ...row,
        student: Array.isArray(row.student) ? row.student[0] ?? null : row.student,
      })) as AttendanceRow[];
    } catch (error) {
      setNotice(error instanceof Error ? `Gagal memuat presensi: ${error.message}` : 'Gagal memuat data presensi.');
      return null;
    }
  }, [setNotice]);

  const loadAttendanceDate = useCallback(async (date: string) => {
    const rows = await loadAttendanceRange(date, date);
    if (rows) setAttendancePageRows(rows);
  }, [loadAttendanceRange]);

  const loadOverviewMonth = useCallback(async (month: string) => {
    const { startDate, endDate: fullMonthEnd } = monthBounds(month);
    const endDate = month === localDateKey().slice(0, 7) ? localDateKey() : fullMonthEnd;
    try {
      const [attendanceResult, scheduleResult, holidayResult] = await Promise.all([
        loadAttendanceRange(startDate, endDate),
        api.from<Pick<Schedule, 'work_days'>>('schedules').select('work_days').eq('is_active', true).limit(1).maybeSingle(),
        api.from<Pick<AttendanceHoliday, 'holiday_date'>>('attendance_holidays').select('holiday_date').gte('holiday_date', startDate).lte('holiday_date', endDate),
      ]);
      if (!attendanceResult || scheduleResult.error || holidayResult.error || !scheduleResult.data) return;
      setOverviewAttendance(dailyReportRows(
        students,
        attendanceResult,
        startDate,
        endDate,
        scheduleResult.data.work_days,
        (holidayResult.data ?? []).map((holiday) => holiday.holiday_date),
      ));
      setOverviewMonth(month);
    } catch (error) {
      setNotice(error instanceof Error ? `Gagal memuat ringkasan bulanan: ${error.message}` : 'Gagal memuat ringkasan bulanan.');
    }
  }, [loadAttendanceRange, setNotice, students]);

  const loadReportRange = useCallback(async (startDate: string, endDate: string) => {
    const [attendanceRows, prayerResult, scheduleResult, holidayResult] = await Promise.all([
      loadAttendanceRange(startDate, endDate),
      api.from<PrayerAttendanceRow>('prayer_attendance')
        .select('id, student_id, prayer_key, prayer_date, checked_in_at, student:students(id, full_name, class_name, photo_url)')
        .gte('prayer_date', startDate)
        .lte('prayer_date', endDate)
        .order('prayer_date', { ascending: false })
        .order('checked_in_at', { ascending: false }),
      api.from<Pick<Schedule, 'work_days'>>('schedules').select('work_days').eq('is_active', true).limit(1).maybeSingle(),
      api.from<Pick<AttendanceHoliday, 'holiday_date' | 'name'>>('attendance_holidays')
        .select('holiday_date, name')
        .gte('holiday_date', startDate)
        .lte('holiday_date', endDate),
    ]);
    if (scheduleResult.error) {
      setNotice(`Gagal memuat jadwal absensi: ${scheduleResult.error.message}`);
    } else if (!scheduleResult.data) {
      setNotice('Jadwal absensi aktif tidak ditemukan.');
    } else if (holidayResult.error) {
      setNotice(`Gagal memuat hari libur: ${holidayResult.error.message}`);
    } else if (attendanceRows) {
      setReportRows(dailyReportRows(
        students,
        attendanceRows,
        startDate,
        endDate,
        scheduleResult.data.work_days,
        (holidayResult.data ?? []).map((holiday) => holiday.holiday_date),
      ));
    }
    if (prayerResult.error) {
      setNotice(`Gagal memuat laporan presensi sholat: ${prayerResult.error.message}`);
    } else {
      setPrayerReportRows((prayerResult.data ?? []).map((row) => ({
        ...row,
        student: Array.isArray(row.student) ? row.student[0] ?? null : row.student,
      })) as PrayerAttendanceRow[]);
    }
  }, [loadAttendanceRange, setNotice, students]);

  const loadPeriodReportData = useCallback(async (startDate: string, endDate: string) => {
    const [attendanceRows, prayerResult, scheduleResult, holidayResult] = await Promise.all([
      loadAttendanceRange(startDate, endDate),
      api.from<PrayerAttendanceRow>('prayer_attendance')
        .select('id, student_id, prayer_key, prayer_date, checked_in_at, student:students(id, full_name, class_name, photo_url)')
        .gte('prayer_date', startDate)
        .lte('prayer_date', endDate)
        .order('prayer_date', { ascending: false })
        .order('checked_in_at', { ascending: false }),
      api.from<Pick<Schedule, 'work_days'>>('schedules').select('work_days').eq('is_active', true).limit(1).maybeSingle(),
      api.from<Pick<AttendanceHoliday, 'holiday_date' | 'name'>>('attendance_holidays')
        .select('holiday_date, name')
        .gte('holiday_date', startDate)
        .lte('holiday_date', endDate),
    ]);
    if (!attendanceRows || prayerResult.error || scheduleResult.error || holidayResult.error || !scheduleResult.data) {
      setNotice('Gagal menyiapkan data laporan.');
      return null;
    }
    return {
      attendance: dailyReportRows(
        students,
        attendanceRows,
        startDate,
        endDate,
        scheduleResult.data.work_days,
        (holidayResult.data ?? []).map((holiday) => holiday.holiday_date),
      ),
      holidays: holidayResult.data ?? [],
      prayerAttendance: (prayerResult.data ?? []).map((row) => ({
        ...row,
        student: Array.isArray(row.student) ? row.student[0] ?? null : row.student,
      })) as PrayerAttendanceRow[],
    };
  }, [loadAttendanceRange, setNotice, students]);

  const processRfidScan = useCallback(async (uid: string) => {
    try {
      const { data, error } = await api.rpc('process_rfid_scan', {
        p_card_uid: uid,
      });
      if (error) throw error;
      const result = (Array.isArray(data) ? data[0] : data) as {
        scan_result: string;
        student_name: string | null;
        class_name: string | null;
        attendance_status: string | null;
        display_message: string;
      } | null;
      if (!result) throw new Error('Server tidak mengembalikan hasil scan.');
      setScanRevision((revision) => revision + 1);
      const student = result.student_name ? ` — ${result.student_name}` : '';
      const message = `${result.display_message}${student}`;
      if (result.scan_result.startsWith('prayer_')) {
        setTimedNotice(message);
        return;
      }
      const normalizedUid = uid.toUpperCase().replace(/[^A-F0-9]/g, '');
      const matchedStudent = students.find((candidate) => candidate.rfid_cards.some(
        (card) => card.uid.toUpperCase().replace(/[^A-F0-9]/g, '') === normalizedUid,
      ));
      let attendanceTime = new Date().toISOString();
      let attendanceStatus = result.attendance_status ?? null;
      let monitorQueryWarning = '';
      if (matchedStudent) {
        const { data: attendanceRow, error: attendanceError } = await api
          .from<{ check_in_at: string | null; check_out_at: string | null; status: string }>('attendance')
          .select('check_in_at, check_out_at, status')
          .eq('student_id', matchedStudent.id)
          .eq('attendance_date', localDateKey())
          .maybeSingle();
        if (attendanceError) {
          monitorQueryWarning = `Detail waktu monitor gagal dimuat: ${attendanceError.message}`;
        } else if (attendanceRow) {
          attendanceStatus = attendanceRow.status;
          attendanceTime = result.scan_result === 'check_out'
            ? attendanceRow.check_out_at ?? attendanceRow.check_in_at ?? attendanceTime
            : attendanceRow.check_in_at ?? attendanceTime;
        }
      }
      const monitorEvent: AttendanceMonitorEvent = {
        id: crypto.randomUUID(),
        result: result.scan_result,
        message: result.display_message,
        fullName: result.student_name ?? matchedStudent?.full_name ?? null,
        className: result.class_name ?? matchedStudent?.class_name ?? null,
        photoPath: matchedStudent?.photo_url ?? null,
        status: attendanceStatus,
        time: new Intl.DateTimeFormat('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
          timeZone: 'Asia/Jakarta',
        }).format(parseTimestamp(attendanceTime)),
      };
      attendanceMonitorChannel.current?.postMessage(monitorEvent);
      const noticeMessage = monitorQueryWarning ? `${message} ${monitorQueryWarning}` : message;
      if (result.scan_result === 'duplicate') {
        setTimedNotice(noticeMessage);
      } else {
        setNotice(noticeMessage);
      }
      if (result.scan_result === 'check_in' || result.scan_result === 'check_out' || result.scan_result === 'duplicate') {
        await loadDashboard();
      }
    } catch (error) {
      setNotice(error instanceof Error
        ? `Scan ${uid} gagal: ${error.message}`
        : `Scan ${uid} gagal diproses.`);
    }
  }, [loadDashboard, setNotice, setTimedNotice, students]);

  useEffect(() => {
    if (!session || isAttendanceMonitor) return;
    let active = true;
    void Promise.resolve().then(() => {
      if (active) return loadDashboard();
    });
    return () => {
      active = false;
    };
  }, [session, isAttendanceMonitor, loadDashboard]);

  useEffect(() => {
    if (!profile) return;
    if (!canAccessTab(profile.role, activeTab)) {
      let active = true;
      void Promise.resolve().then(() => {
        if (!active) return;
        setActiveTab('overview');
        window.localStorage.setItem(activeTabKey, 'overview');
      });
      return () => { active = false; };
    }
  }, [activeTab, profile]);

  async function signOut() {
    const { error } = await api.auth.signOut();
    if (error) {
      setNotice(`Gagal keluar: ${error.message}`);
      return;
    }
    setProfile(null);
    setNotice('');
  }

  function navigate(tab: Tab) {
    if (!canAccessTab(profile?.role, tab)) return;
    setActiveTab(tab);
    window.localStorage.setItem(activeTabKey, tab);
    setMobileOpen(false);
  }

  function toggleTheme() {
    setDarkMode((current) => {
      const next = !current;
      window.localStorage.setItem(themeKey, next ? 'dark' : 'light');
      return next;
    });
  }

  if (isAttendanceMonitor) return <Suspense fallback={null}><AttendanceMonitorPage /></Suspense>;
  if (loadingScreen === 'splash' || session === null) return null;
  if (loadingScreen === 'page') return null;
  if (!session) return <AuthPage darkMode={darkMode} onToggleTheme={toggleTheme} />;
  const activeStudents = students.filter((student) => student.is_active).length;
  const present = attendance.filter((row) => row.status === 'present').length;
  const late = attendance.filter((row) => row.status === 'late').length;
  const excused = attendance.filter((row) => row.status === 'excused' || row.status === 'sick').length;
  const absent = Math.max(activeStudents - present - late - excused, 0);
  const hasNotifications = late + absent > 0;
  const notificationMessage = [
    late + absent > 0 ? `${late + absent} santri belum hadir tepat waktu` : '',
  ].filter(Boolean).join('. ') || 'Tidak ada hal yang perlu ditindaklanjuti.';
  const isAdmin = profile?.role === 'admin';
  const canEditAcademicGrades = isAdmin || profile?.role === 'teacher';

  return (
    <DashboardLayout
      activeTab={activeTab}
      darkMode={darkMode}
      hasNotifications={hasNotifications}
      showPlatformLauncher={showPlatformLauncher}
      mobileOpen={mobileOpen}
      notice={notice}
      profile={profile}
      onClearNotice={clearNotice}
      onToggleTheme={toggleTheme}
      onMenuClose={() => setMobileOpen(false)}
      onMenuOpen={() => setMobileOpen(true)}
      onNavigate={navigate}
      notificationMessage={notificationMessage}
      onNotice={setNotice}
      onProfileUpdated={(updatedProfile, message) => {
        setProfile(updatedProfile);
        setNotice(message);
      }}
      onChangePlatform={onOpenLauncher ?? (() => undefined)}
      onSignOut={signOut}
    >
      {isAdmin && <UsbRfidScanner onScan={processRfidScan} />}
      {activeTab === 'overview' && (
        <OverviewPage
          present={present}
          late={late}
          absent={absent}
          activeStudents={activeStudents}
          attendance={attendance}
          monthlyAttendance={overviewAttendance}
          overviewMonth={overviewMonth}
          onOverviewMonthChange={loadOverviewMonth}
          scanRevision={scanRevision}
          onRefresh={loadDashboard}
          refreshing={loading}
          onNavigate={navigate}
          role={profile?.role}
        />
      )}
      {canAccessTab(profile?.role, 'students') && activeTab === 'students' && (
        <StudentsPage
          students={students}
          canEdit={isAdmin}
          onSaved={(message) => {
            setNotice(message);
            void loadDashboard();
          }}
        />
      )}
      {activeTab === 'attendance' && <AttendancePage attendance={attendancePageRows} students={students} onDateChange={loadAttendanceDate} onNotice={setNotice} />}
      {canAccessTab(profile?.role, 'subject-attendance') && activeTab === 'subject-attendance' && (
        <SubjectAttendancePage
          students={students}
          onSaved={setNotice}
        />
      )}
      {canAccessTab(profile?.role, 'prayer-attendance') && activeTab === 'prayer-attendance' && <PrayerAttendancePage students={students} scanRevision={scanRevision} />}
      {canAccessTab(profile?.role, 'academic') && activeTab === 'academic' && <Suspense fallback={null}><AcademicPage students={students} canEdit={canEditAcademicGrades} canManageConfiguration={isAdmin} /></Suspense>}
      {canAccessTab(profile?.role, 'reports') && activeTab === 'reports' && (
        <ReportsPage
          students={students}
          attendance={reportRows}
          prayerAttendance={prayerReportRows}
          onRangeChange={loadReportRange}
          onPeriodReportData={loadPeriodReportData}
        />
      )}
      {canAccessTab(profile?.role, 'exceptions') && activeTab === 'exceptions' && (
        <ExceptionsPage
          students={students}
          onChanged={(message) => {
            setNotice(message);
            void loadDashboard();
          }}
        />
      )}
      {canAccessTab(profile?.role, 'settings') && activeTab === 'settings' && (
        <SettingsPage
          scanRevision={scanRevision}
          onChanged={(message) => {
            setNotice(message);
            void loadDashboard();
          }}
        />
      )}
      {isAdmin && activeTab === 'admin-accounts' && (
        <AdminAccountsPage
          currentUserId={profile?.user_id ?? ''}
          onChanged={setNotice}
        />
      )}
    </DashboardLayout>
  );
}
