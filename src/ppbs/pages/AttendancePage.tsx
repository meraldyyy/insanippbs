import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Download, MonitorPlay, Radio, Search } from 'lucide-react';
import { StudentPhoto } from '../components/StudentPhoto';
import { attendanceStatusLabel, downloadExcel, formatDate, formatTime, localDateKey } from '../lib/format';
import type { AttendanceRow, Student } from '../../types';

type AttendancePageProps = {
  attendance: AttendanceRow[];
  students: Student[];
  onDateChange: (date: string) => Promise<void>;
  onNotice: (message: string) => void;
};

type SummaryStudent = Student & { attendanceNote?: string | null };

const statuses = ['present', 'late', 'absent', 'excused', 'sick'];

export function AttendancePage({ attendance, students, onDateChange, onNotice }: AttendancePageProps) {
  const [date, setDate] = useState(localDateKey());
  const [status, setStatus] = useState('all');
  const [expandedClass, setExpandedClass] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const activeStudents = useMemo(() => students.filter((student) => student.is_active), [students]);
  const attendanceByStudent = useMemo(() => new Map(attendance.map((row) => [row.student_id, row])), [attendance]);
  const classSummaries = useMemo(() => {
    const studentsByClass = new Map<string, Student[]>();
    for (const student of activeStudents) {
      const className = student.class_name || 'Kelas belum ditentukan';
      const classStudents = studentsByClass.get(className) ?? [];
      classStudents.push(student);
      studentsByClass.set(className, classStudents);
    }
    return Array.from(studentsByClass, ([className, classStudents]) => {
      const studentsByStatus = {
        attended: [] as SummaryStudent[],
        absent: [] as SummaryStudent[],
        excused: [] as SummaryStudent[],
        sick: [] as SummaryStudent[],
      };
      for (const student of classStudents) {
        const record = attendanceByStudent.get(student.id);
        if (record?.status === 'present' || record?.status === 'late') studentsByStatus.attended.push(student);
        else if (record?.status === 'excused') studentsByStatus.excused.push({ ...student, attendanceNote: record.note ?? null });
        else if (record?.status === 'sick') studentsByStatus.sick.push({ ...student, attendanceNote: record.note ?? null });
        else studentsByStatus.absent.push(student);
      }
      return { className, total: classStudents.length, studentsByStatus };
    }).sort((left, right) => left.className.localeCompare(right.className, 'id'));
  }, [activeStudents, attendanceByStudent]);
  const filtered = useMemo(() => attendance.filter((row) => (
    (status === 'all' || row.status === status)
    && `${row.student?.full_name ?? ''} ${row.student?.class_name ?? ''}`.toLowerCase().includes(search.toLowerCase())
  )), [attendance, search, status]);

  async function selectDate(nextDate: string) {
    if (!nextDate) return;
    setDate(nextDate);
    setLoading(true);
    try {
      await onDateChange(nextDate);
    } finally {
      setLoading(false);
    }
  }

  function openMonitor() {
    const monitorUrl = new URL(window.location.href);
    monitorUrl.searchParams.set('attendance-display', '1');
    const monitorWindow = window.open(monitorUrl, '_blank', 'popup,width=1280,height=800');
    if (!monitorWindow) onNotice('Layar monitor tidak dapat dibuka. Izinkan pop-up untuk situs ini lalu coba lagi.');
  }

  return (
    <>
      <div className="page-heading compact">
        <div><p className="eyebrow">PRESENSI SANTRI</p><h1>Log absensi</h1><p className="muted">Riwayat presensi dan status kehadiran santri.</p></div>
        <label className="date-filter">{formatDate(date)}<input type="date" value={date} max={localDateKey()} onChange={(event) => void selectDate(event.target.value)} aria-label="Pilih tanggal presensi" /></label>
        <button className="secondary-button attendance-monitor-button" type="button" onClick={openMonitor}>
          <MonitorPlay size={16} />Buka layar monitor
        </button>
      </div>
      <section className="attendance-class-summaries" aria-label="Ringkasan absensi per kelas">
        {classSummaries.map(({ className, total, studentsByStatus }) => (
          <button
            className={`panel attendance-class-card${expandedClass === className ? ' selected' : ''}`}
            key={className}
            type="button"
            aria-expanded={expandedClass === className}
            onClick={() => setExpandedClass(expandedClass === className ? null : className)}
          >
            <span className="attendance-class-heading">{className}{expandedClass === className ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</span>
            <span><b>{studentsByStatus.attended.length}</b> sudah absen <i>·</i> <b>{studentsByStatus.absent.length}</b> belum hadir</span>
            <small>{studentsByStatus.excused.length} izin · {studentsByStatus.sick.length} sakit · {total} santri</small>
          </button>
        ))}
        {classSummaries.length === 0 && <div className="panel attendance-no-classes">Belum ada santri aktif untuk diringkas.</div>}
      </section>
      {expandedClass && (() => {
        const summary = classSummaries.find((item) => item.className === expandedClass);
        if (!summary) return null;
        return (
          <section className="panel attendance-class-detail">
            <div className="panel-heading">
              <div><h2>Detail absensi · {summary.className}</h2><p>{formatDate(date)} · {summary.total} santri aktif</p></div>
            </div>
            <div className="attendance-class-detail-grid">
              <AttendanceStudentList title="Sudah absen" students={summary.studentsByStatus.attended} emptyMessage="Belum ada santri yang absen." />
              <AttendanceStudentList title="Belum hadir" students={summary.studentsByStatus.absent} emptyMessage="Semua santri sudah memiliki status." />
              <AttendanceStudentList title="Izin" students={summary.studentsByStatus.excused} emptyMessage="Tidak ada santri izin." />
              <AttendanceStudentList title="Sakit" students={summary.studentsByStatus.sick} emptyMessage="Tidak ada santri sakit." />
            </div>
          </section>
        );
      })()}
      <section className="panel table-panel">
        <div className="table-toolbar">
          <div className="search-box"><Search size={17} /><input placeholder="Cari santri..." value={search} onChange={(event) => setSearch(event.target.value)} /></div>
          <div className="toolbar-filters">
            <select className="secondary-button" value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter status presensi">
              <option value="all">Semua status</option>
              {statuses.map((value) => <option key={value} value={value}>{attendanceStatusLabel(value)}</option>)}
            </select>
            <button className="secondary-button" onClick={() => downloadExcel(`presensi-santri-${date}.xls`, ['Tanggal', 'Nama santri', 'Kelas', 'Jam masuk', 'Jam pulang', 'Status'], filtered.map((row) => [formatDate(row.attendance_date), row.student?.full_name || 'Santri', row.student?.class_name || '', formatTime(row.check_in_at), formatTime(row.check_out_at), attendanceStatusLabel(row.status)]))}>
              <Download size={16} />Export harian
            </button>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Santri</th><th>Jam masuk</th><th>Jam pulang</th><th>Status</th><th>Reader</th></tr></thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id}>
                  <td><div className="table-person"><StudentPhoto studentId={row.student?.id || row.student_id} fullName={row.student?.full_name || 'Santri'} photoPath={row.student?.photo_url || null} /><div><b>{row.student?.full_name || 'Santri'}</b><span>{row.student?.class_name || 'Kelas belum ditentukan'}</span></div></div></td>
                  <td>{formatTime(row.check_in_at)}</td>
                  <td>{formatTime(row.check_out_at)}</td>
                  <td><span className={`status-badge ${row.status === 'present' ? 'active' : row.status === 'late' || row.status === 'excused' || row.status === 'sick' ? 'warning' : 'inactive'}`}><i />{attendanceStatusLabel(row.status)}</span></td>
                  <td><span className="reader-name"><Radio size={14} />USB RFID</span></td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={5}>{loading ? 'Memuat data presensi...' : 'Tidak ada catatan yang sesuai dengan filter.'}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function AttendanceStudentList({ title, students, emptyMessage }: { title: string; students: SummaryStudent[]; emptyMessage: string }) {
  return (
    <div className="attendance-class-list">
      <h3>{title} ({students.length})</h3>
      {students.length > 0
        ? <ul>{students.map((student) => <li key={student.id}><span>{student.full_name}</span>{student.attendanceNote !== undefined && <small>{student.attendanceNote || 'Tidak ada keterangan'}</small>}</li>)}</ul>
        : <p>{emptyMessage}</p>}
    </div>
  );
}
