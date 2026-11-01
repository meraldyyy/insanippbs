import { useEffect, useState } from 'react';
import { Activity, CalendarDays, ChevronDown, ChevronUp, Clock3, Download, Users } from 'lucide-react';
import { attendanceStatusLabel, downloadReportWorkbook, formatDate, localDateKey, parseTimestamp } from '../lib/format';
import type { AttendanceHoliday, AttendanceRow, PrayerAttendanceRow, Student } from '../../types';

type ReportsPageProps = {
  students: Student[];
  attendance: AttendanceRow[];
  prayerAttendance: PrayerAttendanceRow[];
  onRangeChange: (startDate: string, endDate: string) => Promise<void>;
  onPeriodReportData: (startDate: string, endDate: string) => Promise<PeriodReportData | null>;
};

type PeriodReportData = {
  attendance: AttendanceRow[];
  holidays: Pick<AttendanceHoliday, 'holiday_date' | 'name'>[];
  prayerAttendance: PrayerAttendanceRow[];
};

const prayerLabels: Record<PrayerAttendanceRow['prayer_key'], string> = {
  subuh: 'Subuh',
  zuhur: 'Zuhur',
  asar: 'Asar',
  magrib: 'Magrib',
  isya: 'Isya',
};

const attendanceStatuses = [
  { key: 'present', label: 'Hadir' },
  { key: 'late', label: 'Terlambat' },
  { key: 'absent', label: 'Belum hadir' },
  { key: 'excused', label: 'Izin' },
  { key: 'sick', label: 'Sakit' },
] as const;

export function ReportsPage({ students, attendance, prayerAttendance, onRangeChange, onPeriodReportData }: ReportsPageProps) {
  const today = localDateKey();
  const currentWeek = reportWeekBounds(mondayOf(today), today);
  const [reportMonth, setReportMonth] = useState(today.slice(0, 7));
  const [reportWeekStart, setReportWeekStart] = useState(() => mondayOf(today));
  const [startDate, setStartDate] = useState(currentWeek.startDate);
  const [endDate, setEndDate] = useState(currentWeek.endDate);
  const [reportType, setReportType] = useState<'daily' | 'prayer'>('daily');
  const [expandedAttendanceStatus, setExpandedAttendanceStatus] = useState<string | null>(null);
  const [expandedPrayer, setExpandedPrayer] = useState<PrayerAttendanceRow['prayer_key'] | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      setLoading(true);
      return onRangeChange(startDate, endDate);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [endDate, onRangeChange, startDate]);
  const presentCount = attendance.filter((row) => row.status === 'present').length;
  const lateCount = attendance.filter((row) => row.status === 'late').length;
  const absentCount = attendance.filter((row) => row.status === 'absent').length;
  const excusedCount = attendance.filter((row) => row.status === 'excused').length;
  const sickCount = attendance.filter((row) => row.status === 'sick').length;
  const reportRows = [
    presentCount,
    lateCount,
    absentCount,
    excusedCount,
    sickCount,
  ];
  const maxCount = Math.max(...reportRows, 1);
  const barWidths = reportRows.map((count) => (count / maxCount) * 100);
  const checkInTimes = attendance
    .map((row) => row.check_in_at)
    .filter((value): value is string => value !== null)
    .map((value) => {
      const parts = new Intl.DateTimeFormat('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Asia/Jakarta',
      }).formatToParts(parseTimestamp(value));
      const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0);
      const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? 0);
      return hour * 60 + minute;
    });
  const averageCheckIn = checkInTimes.length
    ? (() => {
        const averageMinutes = Math.round(checkInTimes.reduce((sum, value) => sum + value, 0) / checkInTimes.length);
        return `${String(Math.floor(averageMinutes / 60)).padStart(2, '0')}:${String(averageMinutes % 60).padStart(2, '0')}`;
      })()
    : '--:--';
  const attendedCount = presentCount + lateCount;
  const attendanceRate = attendance.length ? Math.round((attendedCount / attendance.length) * 100) : 0;
  const activeStudents = students.filter((student) => student.is_active);
  const prayerDays = dateKeysInclusive(startDate, endDate);
  const prayerDateSet = new Set(prayerDays);
  const prayerOpportunities = activeStudents.length * prayerDays.length;
  const prayerSummaries = (Object.keys(prayerLabels) as PrayerAttendanceRow['prayer_key'][]).map((key) => {
    const studentRows = activeStudents.map((student) => {
      const attendedDates = new Set(prayerAttendance
        .filter((row) => row.prayer_key === key && row.student_id === student.id && prayerDateSet.has(row.prayer_date))
        .map((row) => row.prayer_date));
      return {
        student,
        present: Math.min(prayerDays.length, attendedDates.size),
        absent: Math.max(0, prayerDays.length - attendedDates.size),
      };
    });
    const present = studentRows.reduce((sum, row) => sum + row.present, 0);
    return {
      key,
      label: prayerLabels[key],
      present,
      absent: Math.max(0, prayerOpportunities - present),
      students: studentRows,
    };
  });
  const studentsWithPrayerScan = new Set(prayerAttendance.map((row) => row.student_id)).size;
  const expandedAttendanceRows = expandedAttendanceStatus
    ? attendance.filter((row) => row.status === expandedAttendanceStatus)
    : [];
  function updateRange(start: string, end: string) {
    setStartDate(start);
    setEndDate(end);
  }

  async function exportAttendance(period: 'weekly' | 'monthly') {
    setExporting(true);
    try {
      const { startDate, endDate, label, filename } = selectedExportPeriod(period, reportMonth, reportWeekStart, today);
      const reportData = await onPeriodReportData(startDate, endDate);
      if (reportData) downloadAttendanceReport(label, filename, startDate, endDate, students, reportData.attendance, reportData.holidays);
    } finally {
      setExporting(false);
    }
  }

  async function exportPrayer(period: 'weekly' | 'monthly') {
    setExporting(true);
    try {
      const { startDate, endDate, label, filename } = selectedExportPeriod(period, reportMonth, reportWeekStart, today);
      const reportData = await onPeriodReportData(startDate, endDate);
      if (reportData) downloadPrayerReport(label, filename, startDate, endDate, students, reportData.prayerAttendance);
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <div className="page-heading compact">
        <div><p className="eyebrow">LAPORAN PESANTREN</p><h1>Rekap &amp; laporan</h1><p className="muted">Pilih sumber data laporan absensi harian atau presensi sholat.</p></div>
      </div>
      <div className="report-mode-switch" role="group" aria-label="Sumber data laporan">
        <button className={reportType === 'daily' ? 'active' : ''} type="button" onClick={() => setReportType('daily')}>Presensi Harian</button>
        <button className={reportType === 'prayer' ? 'active' : ''} type="button" onClick={() => setReportType('prayer')}>Presensi Sholat</button>
      </div>
      <section className="report-export-panel" aria-label="Export laporan">
        <div className="report-export-heading">
          <span className="report-export-icon"><Download size={18} /></span>
          <div><h2>Export laporan</h2><p>{reportType === 'daily' ? 'Absensi harian' : 'Presensi salat'} · pilih periode mingguan atau bulanan</p></div>
        </div>
        <div className="report-export-body">
          <div className="report-export-periods">
            <label>Mingguan<input type="date" value={reportWeekStart} max={today} onChange={(event) => {
              if (event.target.value) setReportWeekStart(mondayOf(event.target.value));
            }} /><small>{formatDate(reportWeekStart)} – {formatDate(reportWeekBounds(reportWeekStart, today).endDate)}</small></label>
            <label>Bulanan<input type="month" value={reportMonth} max={today.slice(0, 7)} onChange={(event) => {
              if (event.target.value) setReportMonth(event.target.value);
            }} /><small>{reportMonthLabel(reportMonth)}</small></label>
          </div>
          <div className="report-export-actions">
            <button className="secondary-button" disabled={exporting} onClick={() => void (reportType === 'daily' ? exportAttendance('weekly') : exportPrayer('weekly'))}>
              <Download size={16} />{exporting ? 'Menyiapkan...' : 'Export mingguan'}
            </button>
            <button className="primary-button" disabled={exporting} onClick={() => void (reportType === 'daily' ? exportAttendance('monthly') : exportPrayer('monthly'))}>
              <Download size={16} />{exporting ? 'Menyiapkan...' : 'Export bulanan'}
            </button>
          </div>
        </div>
      </section>
      {reportType === 'daily' ? (
        <>
          <p className="report-source-note">Sumber data: <b>attendance</b>. Pada hari kerja, santri aktif tanpa catatan scan atau izin/sakit dihitung Belum hadir. Tanggal libur yang diatur di Settings tidak menghasilkan status absen.</p>
          <div className="report-grid">
            <div className="report-card dark"><div><span>Rasio hadir</span><strong>{attendanceRate}%</strong><small>{attendedCount} catatan hadir dari {attendance.length} catatan santri-hari · {activeStudents.length} santri aktif</small></div><Activity size={72} /></div>
            <div className="report-card"><div><span>Rata-rata jam masuk</span><strong>{averageCheckIn}</strong><small>{checkInTimes.length} waktu check-in</small></div><Clock3 size={32} /></div>
            <div className="report-card"><div><span>Santri aktif</span><strong>{students.filter((student) => student.is_active).length}</strong><small>Disertakan untuk setiap tanggal</small></div><Users size={32} /></div>
          </div>
        </>
      ) : (
        <>
          <p className="report-source-note">Sumber data: <b>prayer_attendance</b>. Santri yang belum memiliki catatan scan untuk waktu sholat pada tanggal terpilih dihitung sebagai belum absen; data tidak dicampur dengan attendance.</p>
          <div className="report-grid">
            <div className="report-card dark"><div><span>Total presensi sholat</span><strong>{prayerAttendance.length}</strong><small>Catatan scan pada periode ini</small></div><Activity size={72} /></div>
            <div className="report-card"><div><span>Santri tercatat</span><strong>{studentsWithPrayerScan}</strong><small>Santri dengan minimal satu scan sholat</small></div><Users size={32} /></div>
            <div className="report-card"><div><span>Santri belum absen</span><strong>{prayerSummaries.reduce((sum, prayer) => sum + prayer.absent, 0)}</strong><small>Akumulasi santri-waktu sholat pada periode ini</small></div><Clock3 size={32} /></div>
          </div>
        </>
      )}
      <section className="panel report-table">
        <div className="panel-heading">
          <div><h2>{reportType === 'daily' ? 'Ringkasan absensi harian' : 'Ringkasan presensi sholat'}</h2><p>{formatDate(startDate)} – {formatDate(endDate)}{loading ? ' · Memuat...' : ''}</p></div>
          <div className="report-range">
            <CalendarDays size={16} />
            <label>Dari<input type="date" value={startDate} max={endDate || today} onChange={(event) => void updateRange(event.target.value, endDate)} /></label>
            <label>Sampai<input type="date" value={endDate} min={startDate} max={today} onChange={(event) => void updateRange(startDate, event.target.value)} /></label>
          </div>
        </div>
        {reportType === 'prayer' && (
          <div className="prayer-chart-legend">
            <span><i className="prayer-chart-present" />Sudah absen</span>
            <span><i className="prayer-chart-absent" />Belum absen</span>
          </div>
        )}
        <div className="report-bars">
          {reportType === 'daily'
            ? attendanceStatuses.map(({ key, label }, index) => (
                <button
                  className={`report-bar-row attendance-report-bar${expandedAttendanceStatus === key ? ' selected' : ''}`}
                  key={key}
                  type="button"
                  aria-expanded={expandedAttendanceStatus === key}
                  onClick={() => setExpandedAttendanceStatus(expandedAttendanceStatus === key ? null : key)}
                >
                  <span>{label}</span>
                  <div><i style={{ width: `${barWidths[index]}%` }} /></div>
                  <span className="attendance-count-text"><b>{reportRows[index]}</b>{expandedAttendanceStatus === key ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</span>
                </button>
              ))
            : prayerSummaries.map(({ key, label, present, absent }) => (
                <button
                  className={`report-bar-row prayer-report-bar${expandedPrayer === key ? ' selected' : ''}`}
                  key={key}
                  type="button"
                  aria-expanded={expandedPrayer === key}
                  onClick={() => setExpandedPrayer(expandedPrayer === key ? null : key)}
                >
                  <span>{label}</span>
                  <div className="prayer-stacked-track" role="img" aria-label={`${present} sudah absen, ${absent} belum absen`}>
                    <i className="prayer-chart-present" style={{ width: `${prayerOpportunities ? (present / prayerOpportunities) * 100 : 0}%` }} />
                    <i className="prayer-chart-absent" style={{ width: `${prayerOpportunities ? (absent / prayerOpportunities) * 100 : 0}%` }} />
                  </div>
                  <span className="prayer-count-text"><b>{present}</b> sudah · <b>{absent}</b> belum {expandedPrayer === key ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</span>
                </button>
              ))}
        </div>
        {reportType === 'daily' && expandedAttendanceStatus && (
          <div className="prayer-report-details">
            <div className="panel-heading">
              <div>
                <h3>Detail {attendanceStatuses.find((status) => status.key === expandedAttendanceStatus)?.label}</h3>
                <p>{expandedAttendanceRows.length} catatan pada periode yang dipilih.</p>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Santri</th><th>Kelas</th><th>Tanggal</th><th>Jam masuk</th><th>Keterangan</th></tr></thead>
                <tbody>
                  {expandedAttendanceRows.map((row) => (
                    <tr key={`${row.student_id}:${row.attendance_date}`}>
                      <td>{row.student?.full_name || 'Santri'}</td>
                      <td>{row.student?.class_name || '—'}</td>
                      <td>{formatDate(row.attendance_date)}</td>
                      <td>{formatClock(row.check_in_at) || '—'}</td>
                      <td>{row.note || '—'}</td>
                    </tr>
                  ))}
                  {expandedAttendanceRows.length === 0 && <tr><td colSpan={5}>Tidak ada catatan untuk status ini pada periode yang dipilih.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {reportType === 'prayer' && expandedPrayer && (() => {
          const summary = prayerSummaries.find((item) => item.key === expandedPrayer);
          if (!summary) return null;
          return (
            <div className="prayer-report-details">
              <div className="panel-heading">
                <div><h3>Detail {summary.label}</h3><p>Jumlah hari hadir/belum absen per santri pada rentang laporan.</p></div>
              </div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Santri</th><th>Kelas</th><th>Sudah absen</th><th>Belum absen</th></tr></thead>
                  <tbody>
                    {summary.students.map(({ student, present, absent }) => (
                      <tr key={student.id}>
                        <td>{student.full_name}</td>
                        <td>{student.class_name || '—'}</td>
                        <td>{present} hari</td>
                        <td>{absent} hari</td>
                      </tr>
                    ))}
                    {summary.students.length === 0 && <tr><td colSpan={4}>Tidak ada santri aktif pada periode ini.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}
      </section>
    </>
  );
}

function reportMonthBounds(month: string, today: string) {
  const [year, monthNumber] = month.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const fullEnd = `${month}-${String(lastDay).padStart(2, '0')}`;
  return {
    startDate: `${month}-01`,
    endDate: month === today.slice(0, 7) ? today : fullEnd,
  };
}

function mondayOf(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00Z`);
  const daysSinceMonday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - daysSinceMonday);
  return date.toISOString().slice(0, 10);
}

function reportWeekBounds(weekStart: string, today: string) {
  const startDate = mondayOf(weekStart);
  const [year, month, day] = startDate.split('-').map(Number);
  const sunday = new Date(Date.UTC(year, month - 1, day + 6)).toISOString().slice(0, 10);
  const endDate = startDate <= today && today <= sunday ? today : sunday;
  return { startDate, endDate };
}

function selectedExportPeriod(period: 'weekly' | 'monthly', month: string, weekStart: string, today: string) {
  if (period === 'monthly') {
    const { startDate, endDate } = reportMonthBounds(month, today);
    return {
      startDate,
      endDate,
      label: reportMonthLabel(month),
      filename: month.replace('-', '_'),
    };
  }
  const { startDate, endDate } = reportWeekBounds(weekStart, today);
  return {
    startDate,
    endDate,
    label: `${formatDate(startDate)} – ${formatDate(endDate)}`,
    filename: `${startDate.replace(/-/g, '_')}_${endDate.replace(/-/g, '_')}`,
  };
}

function reportMonthLabel(month: string) {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' })
    .format(new Date(Date.UTC(year, monthNumber - 1, 1)));
}

function exportTimestamp() {
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'medium',
    timeZone: 'Asia/Jakarta',
  }).format(new Date());
}

function attendanceExportStatus(status: string) {
  return status === 'absent' ? 'Alpa / Belum hadir' : attendanceStatusLabel(status);
}

function formatReportPercent(value: number) {
  return `${(value * 100).toFixed(2)}%`;
}

function downloadAttendanceReport(
  periodLabel: string,
  filenameSuffix: string,
  startDate: string,
  endDate: string,
  students: Student[],
  attendance: AttendanceRow[],
  holidays: Pick<AttendanceHoliday, 'holiday_date' | 'name'>[],
) {
  const activeStudents = students.filter((student) => student.is_active);
  const studentById = new Map(activeStudents.map((student) => [student.id, student]));
  const rows = attendance
    .filter((row) => row.attendance_date >= startDate && row.attendance_date <= endDate && studentById.has(row.student_id));
  const stats = new Map(activeStudents.map((student) => [student.id, {
    student,
    present: 0,
    late: 0,
    excused: 0,
    sick: 0,
    absent: 0,
    valid: 0,
  }]));

  for (const row of rows) {
    const stat = stats.get(row.student_id);
    if (!stat) continue;
    stat.valid += 1;
    if (row.status === 'present') stat.present += 1;
    else if (row.status === 'late') stat.late += 1;
    else if (row.status === 'excused') stat.excused += 1;
    else if (row.status === 'sick') stat.sick += 1;
    else if (row.status === 'absent') stat.absent += 1;
  }

  const orderedStats = [...stats.values()].sort((left, right) => (
    left.student.class_name.localeCompare(right.student.class_name, 'id') || left.student.full_name.localeCompare(right.student.full_name, 'id')
  ));
  const attended = orderedStats.reduce((sum, stat) => sum + stat.present + stat.late, 0);
  const validOpportunities = orderedStats.reduce((sum, stat) => sum + stat.valid, 0);
  const totalLate = orderedStats.reduce((sum, stat) => sum + stat.late, 0);
  const totalExcused = orderedStats.reduce((sum, stat) => sum + stat.excused, 0);
  const totalSick = orderedStats.reduce((sum, stat) => sum + stat.sick, 0);
  const totalAbsent = orderedStats.reduce((sum, stat) => sum + stat.absent, 0);
  const metadata = [
    ['INSANI-PPBS'],
    ['Pondok Pesantren Baitussalam'],
    ['LAPORAN REKAP ABSENSI SANTRI'],
    [`Periode laporan: ${periodLabel}`],
    [`Diekspor: ${exportTimestamp()}`],
    [],
  ];

  downloadReportWorkbook(`Laporan_Absensi_${filenameSuffix}.xlsx`, [
    {
      name: 'Ringkasan',
      headerRow: 7,
      widths: [32, 18],
      rows: [
        ...metadata,
        ['Statistik', 'Nilai'],
        ['Total santri aktif yang tercakup', activeStudents.length],
        ['Hari presensi valid yang tercakup', new Set(rows.map((row) => row.attendance_date)).size],
        ['Total kesempatan presensi valid', validOpportunities],
        ['Total kehadiran (Hadir + Terlambat)', attended],
        ['Persentase kehadiran', validOpportunities ? formatReportPercent(attended / validOpportunities) : ''],
        ['Total keterlambatan', totalLate],
        ['Total izin', totalExcused],
        ['Total sakit', totalSick],
        ['Total alpa / belum hadir', totalAbsent],
        ['Hari libur yang dikecualikan', holidays.length],
      ],
    },
    {
      name: 'Rekap Per Santri',
      headerRow: 7,
      widths: [8, 16, 30, 20, 12, 14, 12, 12, 18, 18],
      percentageColumns: [9],
      rows: [
        ...metadata,
        ['No', 'NIS', 'Nama Santri', 'Kelas/Kelompok', 'Hadir', 'Terlambat', 'Izin', 'Sakit', 'Alpa / Tidak Hadir', 'Persentase Kehadiran'],
        ...orderedStats.map((stat, index) => [
          index + 1,
          stat.student.student_code,
          stat.student.full_name,
          stat.student.class_name,
          stat.present + stat.late,
          stat.late,
          stat.excused,
          stat.sick,
          stat.absent,
          stat.valid ? (stat.present + stat.late) / stat.valid : '',
        ]),
      ],
    },
    {
      name: 'Detail Harian',
      headerRow: 7,
      widths: [8, 16, 16, 30, 20, 14, 22, 30],
      rows: [
        ...metadata,
        ['No', 'Tanggal', 'NIS', 'Nama Santri', 'Kelas/Kelompok', 'Jam Masuk', 'Status Kehadiran', 'Keterangan'],
        ...rows
          .sort((left, right) => left.attendance_date.localeCompare(right.attendance_date) || (studentById.get(left.student_id)?.full_name ?? '').localeCompare(studentById.get(right.student_id)?.full_name ?? '', 'id'))
          .map((row, index) => {
            const student = studentById.get(row.student_id);
            return [
              index + 1,
              formatDate(row.attendance_date),
              student?.student_code ?? '',
              student?.full_name ?? row.student?.full_name ?? 'Santri',
              student?.class_name ?? row.student?.class_name ?? '',
              formatClock(row.check_in_at),
              attendanceExportStatus(row.status),
              row.note ?? '',
            ];
          }),
      ],
    },
  ]);
}

function downloadPrayerReport(
  periodLabel: string,
  filenameSuffix: string,
  startDate: string,
  endDate: string,
  students: Student[],
  prayerAttendance: PrayerAttendanceRow[],
) {
  const activeStudents = students.filter((student) => student.is_active);
  const prayerDates = dateKeysInclusive(startDate, endDate);
  const prayerKeys = Object.keys(prayerLabels) as PrayerAttendanceRow['prayer_key'][];
  const studentById = new Map(activeStudents.map((student) => [student.id, student]));
  const records = prayerAttendance.filter((row) => row.prayer_date >= startDate && row.prayer_date <= endDate && studentById.has(row.student_id));
  const presentKeys = new Set(records.map((row) => `${row.student_id}:${row.prayer_key}:${row.prayer_date}`));
  const recordByKey = new Map(records.map((row) => [`${row.student_id}:${row.prayer_key}:${row.prayer_date}`, row]));
  const opportunityCount = activeStudents.length * prayerDates.length;
  const orderedStudents = [...activeStudents].sort((left, right) => (
    left.class_name.localeCompare(right.class_name, 'id') || left.full_name.localeCompare(right.full_name, 'id')
  ));
  const metadata = [
    ['INSANI-PPBS'],
    ['Pondok Pesantren Baitussalam'],
    ['LAPORAN PRESENSI SALAT SANTRI'],
    [`Periode laporan: ${periodLabel}`],
    [`Diekspor: ${exportTimestamp()}`],
    [],
  ];
  const prayerSummaryRows = prayerKeys.map((key) => {
    const present = orderedStudents.reduce((sum, student) => sum + prayerDates.filter((date) => presentKeys.has(`${student.id}:${key}:${date}`)).length, 0);
    return [prayerLabels[key], present, opportunityCount, opportunityCount ? formatReportPercent(present / opportunityCount) : ''];
  });
  const studentRows = orderedStudents.map((student, index) => {
    const counts = prayerKeys.map((key) => prayerDates.filter((date) => presentKeys.has(`${student.id}:${key}:${date}`)).length);
    const totalPresent = counts.reduce((sum, count) => sum + count, 0);
    const totalValid = prayerDates.length * prayerKeys.length;
    return [index + 1, student.student_code, student.full_name, student.class_name, ...counts.map((count) => `${count}/${prayerDates.length}`), totalPresent, totalValid, totalValid ? totalPresent / totalValid : ''];
  });
  const detailRows = prayerDates.flatMap((date) => orderedStudents.flatMap((student) => prayerKeys.map((key) => {
    const record = recordByKey.get(`${student.id}:${key}:${date}`);
    return [
      date,
      student.student_code,
      student.full_name,
      student.class_name,
      prayerLabels[key],
      record ? 'Hadir' : 'Belum absen',
      record ? formatClock(record.checked_in_at) : '',
      '',
    ];
  })));

  downloadReportWorkbook(`Laporan_Presensi_Salat_${filenameSuffix}.xlsx`, [
    {
      name: 'Ringkasan Presensi Salat',
      headerRow: 7,
      widths: [32, 18, 22, 18],
      rows: [
        ...metadata,
        ['Waktu Salat', 'Jumlah Kehadiran', 'Kesempatan Valid', 'Persentase Kehadiran'],
        ...prayerSummaryRows,
        [],
        ['Total santri tercakup', activeStudents.length],
        ['Total catatan scan unik', presentKeys.size],
      ],
    },
    {
      name: 'Rekap Per Santri',
      headerRow: 7,
      widths: [8, 16, 30, 20, 12, 12, 12, 12, 12, 20, 22, 24],
      percentageColumns: [11],
      rows: [
        ...metadata,
        ['No', 'NIS', 'Nama Santri', 'Kelas/Kelompok', 'Subuh', 'Zuhur', 'Asar', 'Magrib', 'Isya', 'Total Kehadiran Salat', 'Total Kesempatan Presensi Valid', 'Persentase Kehadiran Salat'],
        ...studentRows,
      ],
    },
    {
      name: 'Detail Presensi Salat',
      headerRow: 7,
      widths: [16, 16, 30, 20, 14, 18, 14, 24],
      rows: [
        ...metadata,
        ['Tanggal', 'NIS', 'Nama Santri', 'Kelas/Kelompok', 'Waktu Salat', 'Status Presensi', 'Jam Presensi', 'Keterangan'],
        ...detailRows,
      ],
    },
  ]);
}

function dateKeysInclusive(startDate: string, endDate: string) {
  if (!startDate || !endDate || startDate > endDate) return [];
  const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
  const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
  const current = new Date(Date.UTC(startYear, startMonth - 1, startDay));
  const end = Date.UTC(endYear, endMonth - 1, endDay);
  const dates: string[] = [];
  while (current.getTime() <= end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

function formatClock(value: string | null) {
  if (!value) return '';
  return new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Jakarta',
  }).format(parseTimestamp(value));
}
