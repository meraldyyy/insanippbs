import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Download, Search } from 'lucide-react';
import { StudentPhoto } from '../components/StudentPhoto';
import { api } from '../../lib/api';
import { downloadExcel, formatDate, localDateKey, parseTimestamp } from '../lib/format';
import type { PrayerAttendanceRow, PrayerSchedule, Student } from '../../types';

type PrayerAttendancePageProps = {
  students: Student[];
  scanRevision: number;
};

const prayerNames: Record<PrayerSchedule['prayer_key'], string> = {
  subuh: 'Subuh',
  zuhur: 'Zuhur',
  asar: 'Asar',
  magrib: 'Magrib',
  isya: 'Isya',
};

const prayerOrder: PrayerSchedule['prayer_key'][] = ['subuh', 'zuhur', 'asar', 'magrib', 'isya'];

function formatPrayerTime(value: string) {
  return new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Jakarta',
  }).format(parseTimestamp(value));
}

export function PrayerAttendancePage({ students, scanRevision }: PrayerAttendancePageProps) {
  const [date, setDate] = useState(localDateKey());
  const [attendance, setAttendance] = useState<PrayerAttendanceRow[]>([]);
  const [expandedPrayer, setExpandedPrayer] = useState<PrayerSchedule['prayer_key'] | null>(null);
  const [prayerFilter, setPrayerFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let current = true;
    void api.from<PrayerAttendanceRow>('prayer_attendance')
      .select('id, student_id, prayer_key, prayer_date, checked_in_at, student:students(id, full_name, class_name, photo_url)')
      .eq('prayer_date', date)
      .order('checked_in_at', { ascending: false })
      .then(({ data, error: queryError }) => {
        if (!current) return;
        if (queryError) {
          setError(queryError.message);
          setAttendance([]);
        } else {
          setError('');
          setAttendance((data ?? []).map((row) => ({
            ...row,
            student: Array.isArray(row.student) ? row.student[0] ?? null : row.student,
          })) as PrayerAttendanceRow[]);
        }
        setLoading(false);
      });
    return () => { current = false; };
  }, [date, scanRevision]);

  const filtered = useMemo(() => attendance.filter((row) => (
    (prayerFilter === 'all' || row.prayer_key === prayerFilter)
    && `${row.student?.full_name ?? ''} ${row.student?.class_name ?? ''}`.toLowerCase().includes(search.toLowerCase())
  )), [attendance, prayerFilter, search]);
  const activeStudentIds = useMemo(
    () => new Set(students.filter((student) => student.is_active).map((student) => student.id)),
    [students],
  );
  const prayerSummaries = useMemo(() => (Object.keys(prayerNames) as PrayerSchedule['prayer_key'][]).map((key) => {
    const presentIds = new Set(attendance.filter((row) => row.prayer_key === key && activeStudentIds.has(row.student_id)).map((row) => row.student_id));
    return {
      key,
      name: prayerNames[key],
      present: presentIds.size,
      absent: Math.max(0, activeStudentIds.size - presentIds.size),
      presentStudents: students.filter((student) => activeStudentIds.has(student.id) && presentIds.has(student.id)),
      absentStudents: students.filter((student) => activeStudentIds.has(student.id) && !presentIds.has(student.id)),
    };
  }), [activeStudentIds, attendance, students]);

  function exportDailyPrayer() {
    const searchTerm = search.toLowerCase();
    const rowsByStudent = new Map<string, Partial<Record<PrayerSchedule['prayer_key'], string>>>();
    for (const row of attendance) {
      const studentRows = rowsByStudent.get(row.student_id) ?? {};
      studentRows[row.prayer_key] = formatPrayerTime(row.checked_in_at);
      rowsByStudent.set(row.student_id, studentRows);
    }
    const rows = students
      .filter((student) => student.is_active)
      .filter((student) => `${student.full_name} ${student.class_name}`.toLowerCase().includes(searchTerm))
      .map((student) => {
        const studentRows = rowsByStudent.get(student.id) ?? {};
        return [
          formatDate(date),
          student.full_name,
          student.class_name || 'Kelas belum ditentukan',
          ...prayerOrder.map((key) => studentRows[key] ?? 'Belum absen'),
        ];
      });
    downloadExcel(`presensi-sholat-${date}.xls`, ['Tanggal', 'Nama santri', 'Kelas', 'Subuh', 'Zuhur', 'Asar', 'Magrib', 'Isya'], rows);
  }

  function changeDate(nextDate: string) {
    if (!nextDate) return;
    setLoading(true);
    setDate(nextDate);
  }

  return (
    <>
      <div className="page-heading compact">
        <div><p className="eyebrow">PRESENSI SHOLAT</p><h1>Presensi Sholat</h1><p className="muted">Catatan kehadiran lima waktu, terpisah dari absensi harian dan ngaji.</p></div>
        <label className="date-filter">{formatDate(date)}<input type="date" value={date} max={localDateKey()} onChange={(event) => changeDate(event.target.value)} aria-label="Pilih tanggal presensi sholat" /></label>
      </div>
      <section className="prayer-summary-grid" aria-label="Ringkasan presensi sholat">
        {prayerSummaries.map(({ key, name, present, absent }) => (
          <button
            className={`panel prayer-summary-card${expandedPrayer === key ? ' selected' : ''}`}
            key={key}
            type="button"
            aria-expanded={expandedPrayer === key}
            onClick={() => setExpandedPrayer(expandedPrayer === key ? null : key)}
          >
            <span className="prayer-summary-title">{name}{expandedPrayer === key ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</span>
            <span><b>Sholat:</b> {present}</span>
            <span><b>Belum absen:</b> {absent}</span>
          </button>
        ))}
      </section>
      {expandedPrayer && (() => {
        const summary = prayerSummaries.find((item) => item.key === expandedPrayer);
        if (!summary) return null;
        return (
          <section className="panel prayer-detail-panel">
            <div className="panel-heading">
              <div><h2>Detail {summary.name}</h2><p>{formatDate(date)} · {summary.present} sudah absen, {summary.absent} belum absen</p></div>
            </div>
            <div className="prayer-detail-columns">
              <div>
                <h3>Sudah absen ({summary.presentStudents.length})</h3>
                {summary.presentStudents.length > 0 ? (
                  <ul>{summary.presentStudents.map((student) => <li key={student.id}><b>{student.full_name}</b><span>{student.class_name || 'Kelas belum ditentukan'}</span></li>)}</ul>
                ) : <p className="muted">Belum ada santri yang absen.</p>}
              </div>
              <div>
                <h3>Belum absen ({summary.absentStudents.length})</h3>
                {summary.absentStudents.length > 0 ? (
                  <ul>{summary.absentStudents.map((student) => <li key={student.id}><b>{student.full_name}</b><span>{student.class_name || 'Kelas belum ditentukan'}</span></li>)}</ul>
                ) : <p className="muted">Semua santri aktif sudah absen.</p>}
              </div>
            </div>
          </section>
        );
      })()}
      <section className="panel table-panel">
        <div className="table-toolbar">
          <div className="search-box"><Search size={17} /><input placeholder="Cari santri..." value={search} onChange={(event) => setSearch(event.target.value)} /></div>
          <div className="toolbar-filters">
            <select className="secondary-button" value={prayerFilter} onChange={(event) => setPrayerFilter(event.target.value)} aria-label="Filter waktu sholat">
              <option value="all">Semua waktu</option>
              {Object.entries(prayerNames).map(([key, name]) => <option key={key} value={key}>{name}</option>)}
            </select>
            <button className="secondary-button" type="button" onClick={exportDailyPrayer}>
              <Download size={16} />Export harian
            </button>
          </div>
        </div>
        {error && <div className="form-message">{error}</div>}
        <div className="table-wrap">
          <table>
            <thead><tr><th>Santri</th><th>Waktu sholat</th><th>Jam absen</th><th>Status</th></tr></thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id}>
                  <td><div className="table-person"><StudentPhoto studentId={row.student?.id || row.student_id} fullName={row.student?.full_name || 'Santri'} photoPath={row.student?.photo_url || null} /><div><b>{row.student?.full_name || 'Santri'}</b><span>{row.student?.class_name || 'Kelas belum ditentukan'}</span></div></div></td>
                  <td>{prayerNames[row.prayer_key]}</td>
                  <td>{formatPrayerTime(row.checked_in_at)} WIB</td>
                  <td><span className="status-badge active"><i />Hadir</span></td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={4}>{loading ? 'Memuat presensi sholat...' : 'Belum ada catatan presensi sholat untuk filter ini.'}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
