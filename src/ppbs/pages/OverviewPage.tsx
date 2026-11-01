import {
  Activity,
  ArrowUpRight,
  Clock3,
  RefreshCw,
  UserCheck,
  Users,
  XCircle,
} from 'lucide-react';
import { StatCard } from '../components/StatCard';
import { attendanceStatusLabel, formatTime } from '../lib/format';
import type { AttendanceRow, Profile, Tab } from '../../types';

const attentionLateThreshold = 15;
const attentionAbsentThreshold = 5;

type OverviewPageProps = {
  present: number;
  late: number;
  absent: number;
  activeStudents: number;
  attendance: AttendanceRow[];
  monthlyAttendance: AttendanceRow[];
  overviewMonth: string;
  onOverviewMonthChange: (month: string) => Promise<void>;
  scanRevision: number;
  onRefresh: () => void;
  refreshing: boolean;
  onNavigate: (tab: Tab) => void;
  role?: Profile['role'];
};

export function OverviewPage({
  present,
  late,
  absent,
  activeStudents,
  attendance,
  monthlyAttendance,
  overviewMonth,
  onOverviewMonthChange,
  onRefresh,
  refreshing,
  onNavigate,
  role = 'viewer',
}: OverviewPageProps) {
  const total = Math.max(activeStudents, 1);
  const weeklyActivity = buildWeeklyActivity(monthlyAttendance, overviewMonth);
  const peakWeeklyCheckIns = Math.max(...weeklyActivity.map((week) => week.checkIns), 1);
  const attentionStudents = buildAttentionStudents(monthlyAttendance);
  const today = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  }).format(new Date());
  const heading = {
    admin: { title: 'Presensi Santri', subtitle: 'Ringkasan kehadiran santri hari ini.' },
    teacher: { title: 'Pantauan kelas', subtitle: 'Pantau kehadiran santri untuk kegiatan belajar hari ini.' },
    parent: { title: 'Aktivitas santri', subtitle: 'Lihat ringkasan santri yang diwakili.' },
    viewer: { title: 'Monitoring presensi', subtitle: 'Ringkasan kehadiran santri hari ini.' },
  }[role];

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">{today}</p>
          <h1>{heading.title} <span>●</span></h1>
          <p className="muted">{heading.subtitle}</p>
        </div>
        <div className="heading-actions">
          <button className="secondary-button" onClick={onRefresh}>
            <RefreshCw size={16} className={refreshing ? 'spin' : ''} />Segarkan
          </button>
        </div>
      </div>

      <div className="stats-grid">
        <StatCard icon={UserCheck} label="Hadir hari ini" value={present + late} detail={`${Math.round(((present + late) / total) * 100)}% dari total santri`} tone="teal" trend="" />
        <StatCard icon={Clock3} label="Terlambat" value={late} detail="Perlu perhatian" tone="amber" trend="Hari ini" />
        <StatCard icon={XCircle} label="Belum hadir" value={absent} detail="Dari santri aktif" tone="rose" trend="Hari ini" />
        <StatCard icon={Users} label="Total santri" value={activeStudents} detail="Santri aktif" tone="blue" trend="" />
      </div>

      <div className="content-grid">
        <section className="panel attendance-panel">
          <div className="panel-heading">
            <div><h2>Aktivitas presensi</h2><p>Jumlah check-in per minggu · Senin–Minggu</p></div>
            <label className="overview-month-filter"><span>Bulan</span><input type="month" value={overviewMonth} max={currentMonthKey()} onChange={(event) => { if (event.target.value) void onOverviewMonthChange(event.target.value); }} /></label>
            <button className="text-button" onClick={() => onNavigate('attendance')}>Lihat semua <ArrowUpRight size={15} /></button>
          </div>
          <div className="attendance-chart">
            <div className="chart-axis">
              {[4, 3, 2, 1, 0].map((step) => <span key={step}>{Math.ceil((peakWeeklyCheckIns * step) / 4)}</span>)}
            </div>
            <div className="chart-area">
              <div className="grid-lines"><i /><i /><i /><i /><i /></div>
              {monthlyAttendance.length === 0
                ? <p className="chart-empty">Belum ada data presensi pada bulan ini.</p>
                : <div className="bars">
                    {weeklyActivity.map((week) => (
                      <div className="bar-group" key={week.key}>
                        <div className="bar" style={{ height: `${(week.checkIns / peakWeeklyCheckIns) * 100}%` }}><span>{week.checkIns}</span></div>
                        <small>{week.label}</small>
                      </div>
                    ))}
                  </div>}
            </div>
          </div>
          <div className="chart-legend">
            <span><i className="legend-dot teal" />Jumlah check-in</span>
            <span>Per minggu</span>
          </div>
        </section>

        <section className="panel today-panel">
          <div className="panel-heading">
            <div><h2>Presensi terbaru</h2><p>Update secara real-time</p></div>
            <span className="live-pill"><i /> LIVE</span>
          </div>
          <div className="activity-list">
            {attendance.slice(0, 4).map((row) => (
              <div className="activity-row" key={row.id}>
                <div className={`activity-avatar ${row.status}`}>
                  {(row.student?.full_name || 'NA').split(' ').map((part) => part[0]).join('').slice(0, 2)}
                </div>
                <div className="activity-main"><b>{row.student?.full_name || 'Santri'}</b><span>{row.student?.class_name || '—'}</span></div>
                <div className="activity-time">
                  <b>{formatTime(row.check_in_at)}</b>
                  <span className={row.status}>{attendanceStatusLabel(row.status)}</span>
                </div>
              </div>
            ))}
          </div>
          <button className="outline-button full-button" onClick={() => onNavigate('attendance')}>Buka log absensi <ArrowUpRight size={15} /></button>
        </section>
      </div>

      <div className="bottom-grid">
        <section className="panel mini-panel focus-panel">
          <div className="focus-decoration"><Activity size={65} /></div>
          <div className="panel-heading"><div><h2>Perlu perhatian</h2><p>Terlambat lebih dari 15 kali atau belum hadir lebih dari 5 kali bulan ini</p></div></div>
          <div className="attention-list">
            {attentionStudents.map((student) => (
              <div className="attention-student" key={student.id}>
                <div><b>{student.name}</b><span>{student.className || 'Kelas belum ditentukan'}</span></div>
                <strong>{student.total}<small>{student.absent} belum · {student.late} terlambat</small></strong>
              </div>
            ))}
            {attentionStudents.length === 0 && <p className="chart-empty">Tidak ada data yang perlu ditindaklanjuti.</p>}
          </div>
        </section>
      </div>
    </>
  );
}

type WeeklyActivity = { key: string; label: string; checkIns: number };

function buildWeeklyActivity(rows: AttendanceRow[], month: string): WeeklyActivity[] {
  const [year, monthNumber] = month.split('-').map(Number);
  const firstDay = new Date(Date.UTC(year, monthNumber - 1, 1));
  const lastDay = new Date(Date.UTC(year, monthNumber, 0));
  const firstMonday = new Date(firstDay);
  firstMonday.setUTCDate(firstDay.getUTCDate() - ((firstDay.getUTCDay() + 6) % 7));
  const weeks: WeeklyActivity[] = [];
  for (const weekStart = new Date(firstMonday); weekStart <= lastDay; weekStart.setUTCDate(weekStart.getUTCDate() + 7)) {
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
    const startKey = weekStart.toISOString().slice(0, 10);
    const endKey = weekEnd.toISOString().slice(0, 10);
    const checkIns = rows.filter((row) => row.check_in_at !== null && row.attendance_date >= `${month}-01` && row.attendance_date <= `${month}-${String(lastDay.getUTCDate()).padStart(2, '0')}` && row.attendance_date >= startKey && row.attendance_date <= endKey).length;
    const visibleStart = weekStart < firstDay ? firstDay : weekStart;
    const visibleEnd = weekEnd > lastDay ? lastDay : weekEnd;
    weeks.push({
      key: startKey,
      label: `${visibleStart.getUTCDate()}–${visibleEnd.getUTCDate()}`,
      checkIns,
    });
  }
  return weeks;
}

function buildAttentionStudents(rows: AttendanceRow[]) {
  const byStudent = new Map<string, { id: string; name: string; className: string; absent: number; late: number }>();
  for (const row of rows) {
    if (row.status !== 'absent' && row.status !== 'late') continue;
    const current = byStudent.get(row.student_id) ?? {
      id: row.student_id,
      name: row.student?.full_name || 'Santri',
      className: row.student?.class_name || '',
      absent: 0,
      late: 0,
    };
    if (row.status === 'absent') current.absent += 1;
    if (row.status === 'late') current.late += 1;
    byStudent.set(row.student_id, current);
  }
  return Array.from(byStudent.values())
    .map((student) => ({ ...student, total: student.absent + student.late }))
    .filter((student) => student.late > attentionLateThreshold || student.absent > attentionAbsentThreshold)
    .sort((left, right) => right.total - left.total || left.name.localeCompare(right.name, 'id'));
}

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}
