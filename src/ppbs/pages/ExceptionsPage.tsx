import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { AlertCircle, ClipboardPlus, Save, Search } from 'lucide-react';
import { attendanceStatusLabel, formatDate, localDateKey } from '../lib/format';
import { api } from '../../lib/api';
import type { AttendanceRow, Student } from '../../types';

type ExceptionsPageProps = {
  students: Student[];
  onChanged: (message: string) => void;
};

type ExceptionRecord = AttendanceRow & { note: string | null };
type ExceptionGroup = {
  id: string;
  student_id: string;
  status: string;
  note: string | null;
  student: ExceptionRecord['student'];
  startDate: string;
  endDate: string;
};

export function ExceptionsPage({ students, onChanged }: ExceptionsPageProps) {
  const maxExceptionDate = nextMonthEndDateKey();
  const [startDate, setStartDate] = useState(localDateKey());
  const [endDate, setEndDate] = useState(localDateKey());
  const [status, setStatus] = useState<'excused' | 'sick'>('excused');
  const [studentId, setStudentId] = useState('');
  const [studentQuery, setStudentQuery] = useState('');
  const [note, setNote] = useState('');
  const [records, setRecords] = useState<ExceptionRecord[]>([]);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadRecords = useCallback(async (selectedStartDate: string, selectedEndDate: string) => {
    setLoading(true);
    setError('');
    try {
      const { data, error: queryError } = await api
        .from('attendance')
        .select('id, student_id, attendance_date, check_in_at, check_out_at, status, note, student:students(full_name, class_name)')
        .gte('attendance_date', selectedStartDate)
        .lte('attendance_date', selectedEndDate)
        .in('status', ['excused', 'sick'])
        .order('attendance_date', { ascending: false })
        .order('created_at', { ascending: false });
      if (queryError) throw queryError;
      setRecords((data ?? []).map((row) => ({
        ...row,
        student: Array.isArray(row.student) ? row.student[0] ?? null : row.student,
      })) as ExceptionRecord[]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Gagal memuat catatan izin dan sakit.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => loadRecords(startDate, endDate));
  }, [endDate, loadRecords, startDate]);

  const groupedRecords = groupExceptionRecords(records);
  const filteredRecords = groupedRecords.filter((record) => (
    `${record.student?.full_name ?? ''} ${record.student?.class_name ?? ''} ${record.note ?? ''}`
      .toLowerCase()
      .includes(search.toLowerCase())
  ));

  const activeStudents = students.filter((student) => student.is_active);

  function selectStudent(value: string) {
    setStudentQuery(value);
    const query = value.trim().toLowerCase();
    const selectedStudent = activeStudents.find((student) => {
      const option = `${student.student_code} — ${student.full_name} (${student.class_name})`.toLowerCase();
      return option === query || student.full_name.toLowerCase() === query || student.student_code.toLowerCase() === query;
    });
    setStudentId(selectedStudent?.id ?? '');
  }

  async function submitException(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!studentId || !startDate || !endDate || startDate > endDate) {
      setError('Pilih santri dan rentang tanggal yang valid terlebih dahulu.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const dates = dateKeysInclusive(startDate, endDate);
      const { error: saveError } = await api
        .from('attendance')
        .upsert(dates.map((attendanceDate) => ({
          student_id: studentId,
          attendance_date: attendanceDate,
          status,
          note: note.trim() || null,
          is_manual: true,
        })), { onConflict: 'student_id,attendance_date' });
      if (saveError) throw saveError;

      const selectedStudent = students.find((student) => student.id === studentId);
      setNote('');
      await loadRecords(startDate, endDate);
      onChanged(`Catatan ${attendanceStatusLabel(status).toLowerCase()} untuk ${selectedStudent?.full_name ?? 'santri'} berhasil disimpan untuk ${dates.length} tanggal.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Gagal menyimpan catatan izin atau sakit.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="page-heading compact">
        <div><p className="eyebrow">ADMINISTRASI KEHADIRAN</p><h1>Izin &amp; Sakit</h1><p className="muted">Catat keterangan ketidakhadiran secara manual.</p></div>
      </div>

      <section className="panel settings-panel">
        <div className="panel-heading"><div><h2>Input izin atau sakit</h2><p>Hanya administrator yang dapat menginput keterangan ini.</p></div><ClipboardPlus size={22} /></div>
        <form className="exception-form" onSubmit={submitException}>
          <label>Santri
            <input
              list="exception-students"
              value={studentQuery}
              onChange={(event) => selectStudent(event.target.value)}
              placeholder="Ketik nama atau NIS santri"
              required
            />
            <datalist id="exception-students">
              {activeStudents.map((student) => (
                <option key={student.id} value={`${student.student_code} — ${student.full_name} (${student.class_name})`} />
              ))}
            </datalist>
          </label>
          <div className="exception-fields">
            <label>Dari tanggal<input type="date" value={startDate} max={maxExceptionDate} required onChange={(event) => setStartDate(event.target.value)} /></label>
            <label>Sampai tanggal<input type="date" value={endDate} max={maxExceptionDate} required onChange={(event) => setEndDate(event.target.value)} /></label>
            <label>Keterangan
              <select value={status} onChange={(event) => setStatus(event.target.value as 'excused' | 'sick')}>
                <option value="excused">Izin</option>
                <option value="sick">Sakit</option>
              </select>
            </label>
          </div>
          <label>Catatan (opsional)<textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} placeholder="Contoh: izin acara keluarga atau demam" /></label>
          {error && <div className="form-message"><AlertCircle size={15} />{error}</div>}
          <button className="primary-button" disabled={busy || activeStudents.length === 0 || !studentId}>
            <Save size={16} />{busy ? 'Menyimpan...' : 'Simpan keterangan'}
          </button>
        </form>
      </section>

      <section className="panel table-panel">
        <div className="panel-heading exception-list-heading">
          <div><h2>Catatan pada periode {formatDate(startDate)} – {formatDate(endDate)}</h2><p>{groupedRecords.length} catatan izin/sakit</p></div>
        </div>
        <div className="table-toolbar">
          <div className="search-box"><Search size={17} /><input placeholder="Cari nama, kelas, atau catatan..." value={search} onChange={(event) => setSearch(event.target.value)} /></div>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Santri</th><th>Kelas</th><th>Keterangan</th><th>Durasi tanggal</th><th>Catatan</th></tr></thead>
            <tbody>
              {filteredRecords.map((record) => (
                <tr key={record.id}>
                  <td><b>{record.student?.full_name ?? 'Santri'}</b></td>
                  <td>{record.student?.class_name ?? '—'}</td>
                  <td><span className={`status-badge ${record.status === 'sick' ? 'warning' : 'inactive'}`}><i />{attendanceStatusLabel(record.status)}</span></td>
                  <td>{formatDate(record.startDate)}{record.endDate !== record.startDate && ` – ${formatDate(record.endDate)}`}</td>
                  <td>{record.note || '—'}</td>
                </tr>
              ))}
              {!loading && filteredRecords.length === 0 && <tr><td colSpan={5}>Belum ada catatan izin atau sakit pada tanggal ini.</td></tr>}
              {loading && <tr><td colSpan={5}>Memuat catatan...</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function groupExceptionRecords(records: ExceptionRecord[]): ExceptionGroup[] {
  const sortedRecords = [...records].sort((left, right) => (
    left.student_id.localeCompare(right.student_id)
    || left.attendance_date.localeCompare(right.attendance_date)
  ));
  const groups: ExceptionGroup[] = [];

  for (const record of sortedRecords) {
    const previous = groups[groups.length - 1];
    if (
      previous
      && previous.student_id === record.student_id
      && previous.status === record.status
      && previous.note === record.note
      && nextDateKey(previous.endDate) === record.attendance_date
    ) {
      previous.endDate = record.attendance_date;
      continue;
    }

    groups.push({
      id: record.id,
      student_id: record.student_id,
      status: record.status,
      note: record.note ?? null,
      student: record.student,
      startDate: record.attendance_date,
      endDate: record.attendance_date,
    });
  }

  return groups.sort((left, right) => right.startDate.localeCompare(left.startDate));
}

function nextDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + 1));
  return date.toISOString().slice(0, 10);
}

function dateKeysInclusive(startDate: string, endDate: string) {
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

function nextMonthEndDateKey() {
  const date = new Date();
  date.setMonth(date.getMonth() + 2, 0);
  return localDateKey(date);
}
