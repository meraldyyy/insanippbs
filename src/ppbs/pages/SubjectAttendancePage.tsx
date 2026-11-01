import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CalendarCheck2, Check, Search, Save } from 'lucide-react';
import { api } from '../../lib/api';
import { formatDate, localDateKey } from '../lib/format';
import type { Student } from '../../types';

type Subject = { id: string; name: string };
type SubjectAttendanceRow = { id: string; student_id: string; subject_id: string; attendance_date: string; status: string; note: string | null };

type SubjectAttendancePageProps = {
  students: Student[];
  onSaved: (message: string) => void;
};

const statuses = [
  { value: 'present', label: 'Hadir', tone: 'present' },
  { value: 'late', label: 'Terlambat', tone: 'late' },
  { value: 'excused', label: 'Izin', tone: 'excused' },
  { value: 'sick', label: 'Sakit', tone: 'sick' },
  { value: 'absent', label: 'Alpa', tone: 'absent' },
] as const;

const statusLabels = Object.fromEntries(statuses.map((status) => [status.value, status.label]));

export function SubjectAttendancePage({ students, onSaved }: SubjectAttendancePageProps) {
  const activeStudents = useMemo(() => students.filter((student) => student.is_active), [students]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectId, setSubjectId] = useState('');
  const [date, setDate] = useState(localDateKey());
  const [statusByStudent, setStatusByStudent] = useState<Record<string, string>>({});
  const [loadedStatusByStudent, setLoadedStatusByStudent] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const loadSubjects = useCallback(async () => {
    const { data, error: queryError } = await api
      .from('academic_subjects')
      .select('id, name')
      .eq('is_active', true)
      .order('name');
    if (queryError) throw queryError;
    const loadedSubjects = (data ?? []) as Subject[];
    setSubjects(loadedSubjects);
    setSubjectId((current) => current || loadedSubjects[0]?.id || '');
  }, []);

  const loadAttendance = useCallback(async (selectedSubject: string, selectedDate: string) => {
    if (!selectedSubject) {
      setStatusByStudent({});
      setLoadedStatusByStudent({});
      return;
    }
    setLoading(true);
    const { data, error: queryError } = await api
      .from('subject_attendance')
      .select('id, student_id, subject_id, attendance_date, status, note')
      .eq('subject_id', selectedSubject)
      .eq('attendance_date', selectedDate);
    if (queryError) throw queryError;
    const nextStatuses: Record<string, string> = {};
    for (const row of (data ?? []) as SubjectAttendanceRow[]) nextStatuses[row.student_id] = row.status;
    setStatusByStudent(nextStatuses);
    setLoadedStatusByStudent(nextStatuses);
  }, []);

  useEffect(() => {
    let mounted = true;
    void Promise.resolve().then(() => {
      if (!mounted) return;
      return loadSubjects()
        .catch((loadError: unknown) => {
          if (mounted) setError(loadError instanceof Error ? loadError.message : 'Gagal memuat mata pelajaran.');
        })
        .finally(() => { if (mounted) setLoading(false); });
    });
    return () => { mounted = false; };
  }, [loadSubjects]);

  useEffect(() => {
    let mounted = true;
    void Promise.resolve().then(() => {
      if (!mounted) return;
      setError('');
      return loadAttendance(subjectId, date)
        .catch((loadError: unknown) => {
          if (mounted) setError(loadError instanceof Error ? loadError.message : 'Gagal memuat absensi mapel.');
        })
        .finally(() => { if (mounted) setLoading(false); });
    });
    return () => { mounted = false; };
  }, [date, loadAttendance, subjectId]);

  const visibleStudents = activeStudents.filter((student) => (
    `${student.full_name} ${student.student_code} ${student.class_name}`.toLowerCase().includes(search.toLowerCase())
  ));
  const selectedCount = Object.keys(statusByStudent).filter((studentId) => activeStudents.some((student) => student.id === studentId)).length;
  const presentCount = Object.values(statusByStudent).filter((status) => status === 'present' || status === 'late').length;
  const absentCount = Object.values(statusByStudent).filter((status) => status === 'absent').length;
  const selectedSubject = subjects.find((subject) => subject.id === subjectId);

  function updateStatus(studentId: string, status: string) {
    setStatusByStudent((current) => ({ ...current, [studentId]: current[studentId] === status ? '' : status }));
  }

  async function saveAttendance() {
    if (!subjectId) {
      setError('Pilih mata pelajaran terlebih dahulu.');
      return;
    }

    const records = Object.entries(statusByStudent)
      .filter(([, status]) => status)
      .map(([student_id, status]) => ({
        student_id,
        subject_id: subjectId,
        attendance_date: date,
        status,
        is_manual: true,
      }));
    const clearedStudentIds = Object.keys(loadedStatusByStudent)
      .filter((studentId) => !statusByStudent[studentId] && activeStudents.some((student) => student.id === studentId));

    if (records.length === 0 && clearedStudentIds.length === 0) {
      setError('Tandai minimal satu santri sebelum menyimpan.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      if (clearedStudentIds.length > 0) {
        const { error: deleteError } = await api
          .from('subject_attendance')
          .delete()
          .eq('subject_id', subjectId)
          .eq('attendance_date', date)
          .in('student_id', clearedStudentIds);
        if (deleteError) throw deleteError;
      }

      if (records.length > 0) {
        const { error: saveError } = await api.from('subject_attendance').upsert(records, {
          onConflict: 'student_id,subject_id,attendance_date',
        });
        if (saveError) throw saveError;
      }

      const savedCount = records.length;
      const clearedCount = clearedStudentIds.length;
      const summary = savedCount > 0 || clearedCount > 0
        ? `Absensi ${selectedSubject?.name ?? 'mata pelajaran'} untuk ${formatDate(date)} berhasil disimpan.`
        : `Absensi ${selectedSubject?.name ?? 'mata pelajaran'} untuk ${formatDate(date)} berhasil diperbarui.`;
      onSaved(summary);
      await loadAttendance(subjectId, date);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Gagal menyimpan absensi mapel.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="page-heading compact">
        <div><p className="eyebrow">KEHADIRAN PEMBELAJARAN</p><h1>Absensi per mata pelajaran</h1><p className="muted">Catat kehadiran santri di kelas yang sedang diajar.</p></div>
        <CalendarCheck2 size={30} />
      </div>

      {error && <div className="form-message module-message"><AlertCircle size={15} />{error}</div>}

      <section className="panel subject-attendance-toolbar">
        <label>Mata pelajaran
          <select value={subjectId} onChange={(event) => setSubjectId(event.target.value)} disabled={subjects.length === 0}>
            <option value="">{subjects.length === 0 ? 'Belum ada mata pelajaran' : 'Pilih mata pelajaran'}</option>
            {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
          </select>
        </label>
        <label>Tanggal<input type="date" value={date} max={localDateKey()} onChange={(event) => setDate(event.target.value)} /></label>
        <div className="subject-attendance-summary">
          <span><b>{selectedCount}</b> dari {activeStudents.length} ditandai</span>
          <span className="summary-present"><b>{presentCount}</b> hadir</span>
          <span className="summary-absent"><b>{absentCount}</b> alpa</span>
        </div>
        <button className="primary-button" type="button" onClick={() => void saveAttendance()} disabled={busy || loading || !subjectId}>
          <Save size={15} />{busy ? 'Menyimpan...' : 'Simpan absensi'}
        </button>
      </section>

      <section className="panel table-panel subject-attendance-panel">
        <div className="panel-heading subject-attendance-heading">
          <div><h2>{selectedSubject?.name ?? 'Pilih mata pelajaran'}</h2><p>{formatDate(date)} · {activeStudents.length} santri aktif</p></div>
          <div className="search-box"><Search size={17} /><input placeholder="Cari nama atau kelas..." value={search} onChange={(event) => setSearch(event.target.value)} /></div>
        </div>
        <div className="table-scroll">
          <table className="subject-attendance-table">
            <thead><tr><th>Santri</th><th>Kelas</th><th>Status kehadiran</th><th>Keterangan</th></tr></thead>
            <tbody>
              {visibleStudents.map((student) => {
                const currentStatus = statusByStudent[student.id] ?? '';
                return <tr key={student.id}>
                  <td><div className="subject-student-name"><b>{student.full_name}</b><small>{student.student_code}</small></div></td>
                  <td>{student.class_name || 'Kelas belum ditentukan'}</td>
                  <td><div className="attendance-status-options" role="group" aria-label={`Status ${student.full_name}`}>
                    {statuses.map((status) => <button
                      className={`attendance-status-option ${status.tone}${currentStatus === status.value ? ' selected' : ''}`}
                      type="button"
                      key={status.value}
                      aria-pressed={currentStatus === status.value}
                      onClick={() => updateStatus(student.id, status.value)}
                    >{currentStatus === status.value && <Check size={12} />}{status.label}</button>)}
                  </div></td>
                  <td>{currentStatus ? <span className={`status-badge ${currentStatus === 'present' ? 'active' : currentStatus === 'absent' ? 'inactive' : 'warning'}`}><i />{statusLabels[currentStatus]}</span> : <span className="not-marked">Belum ditandai</span>}</td>
                </tr>;
              })}
              {visibleStudents.length === 0 && <tr><td colSpan={4}>{loading ? 'Memuat data absensi...' : 'Tidak ada santri yang sesuai pencarian.'}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
