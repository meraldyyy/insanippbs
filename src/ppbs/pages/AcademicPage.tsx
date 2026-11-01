import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { AlertCircle, BookOpen, Check, ChevronLeft, ChevronRight, Pencil, Plus, Save, X } from 'lucide-react';
import { api } from '../../lib/api';
import type { Student } from '../../types';

type AcademicTerm = { id: string; name: string };
type Criterion = { id: string; name: string; is_active: boolean };
type GradeRow = {
  id: string;
  student_id: string;
  score: number;
  note: string | null;
  student?: { full_name: string; class_name: string } | null;
  subject?: { name: string } | null;
  aspect?: { name: string } | null;
  kind: 'Akademik' | 'Attitude';
  criterion: string;
};

type AcademicPageProps = { students: Student[]; canEdit: boolean; canManageConfiguration?: boolean };
const PAGE_SIZE = 10;

function Pagination({ page, itemCount, onPageChange }: { page: number; itemCount: number; onPageChange: (page: number) => void }) {
  const pageCount = Math.ceil(itemCount / PAGE_SIZE);
  if (pageCount <= 1) return null;
  const currentPage = Math.min(page, pageCount);
  const firstItem = (currentPage - 1) * PAGE_SIZE + 1;
  const lastItem = Math.min(currentPage * PAGE_SIZE, itemCount);

  return (
    <div className="module-pagination">
      <span>Menampilkan {firstItem}–{lastItem} dari {itemCount}</span>
      <div>
        <button type="button" className="pagination-arrow" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1} aria-label="Halaman sebelumnya"><ChevronLeft size={15} /></button>
        {Array.from({ length: pageCount }, (_, index) => index + 1).map((pageNumber) => (
          <button
            type="button"
            key={pageNumber}
            className={`pagination-number ${pageNumber === currentPage ? 'active' : ''}`}
            onClick={() => onPageChange(pageNumber)}
            aria-current={pageNumber === currentPage ? 'page' : undefined}
          >{pageNumber}</button>
        ))}
        <button type="button" className="pagination-arrow" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === pageCount} aria-label="Halaman berikutnya"><ChevronRight size={15} /></button>
      </div>
    </div>
  );
}

export function AcademicPage({ students, canEdit, canManageConfiguration = canEdit }: AcademicPageProps) {
  const [terms, setTerms] = useState<AcademicTerm[]>([]);
  const [selectedTerm, setSelectedTerm] = useState('');
  const [subjects, setSubjects] = useState<Criterion[]>([]);
  const [aspects, setAspects] = useState<Criterion[]>([]);
  const [grades, setGrades] = useState<GradeRow[]>([]);
  const [gradesPage, setGradesPage] = useState(1);
  const [subjectsPage, setSubjectsPage] = useState(1);
  const [aspectsPage, setAspectsPage] = useState(1);
  const [newTerm, setNewTerm] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [newAspect, setNewAspect] = useState('');
  const [kind, setKind] = useState<'academic' | 'attitude'>('academic');
  const [studentId, setStudentId] = useState('');
  const [criterionId, setCriterionId] = useState('');
  const [score, setScore] = useState('');
  const [note, setNote] = useState('');
  const [editing, setEditing] = useState<{ table: 'academic_subjects' | 'attitude_aspects'; id: string; name: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const activeStudents = useMemo(() => students.filter((student) => student.is_active), [students]);
  const availableCriteria = kind === 'academic' ? subjects.filter((item) => item.is_active) : aspects.filter((item) => item.is_active);
  const currentGradesPage = Math.min(gradesPage, Math.max(1, Math.ceil(grades.length / PAGE_SIZE)));

  const fetchConfiguration = useCallback(async () => {
    const [termResult, subjectResult, aspectResult] = await Promise.all([
      api.from('academic_terms').select('id, name').order('created_at', { ascending: false }),
      api.from('academic_subjects').select('id, name, is_active').order('name'),
      api.from('attitude_aspects').select('id, name, is_active').order('name'),
    ]);
    if (termResult.error) throw termResult.error;
    if (subjectResult.error) throw subjectResult.error;
    if (aspectResult.error) throw aspectResult.error;
    return {
      terms: (termResult.data ?? []) as AcademicTerm[],
      subjects: (subjectResult.data ?? []) as Criterion[],
      aspects: (aspectResult.data ?? []) as Criterion[],
    };
  }, []);

  const applyConfiguration = useCallback((configuration: Awaited<ReturnType<typeof fetchConfiguration>>) => {
    setTerms(configuration.terms);
    setSubjects(configuration.subjects);
    setAspects(configuration.aspects);
    setSelectedTerm((current) => current || configuration.terms[0]?.id || '');
  }, []);

  const fetchGrades = useCallback(async (termId: string): Promise<GradeRow[]> => {
    if (!termId) return [];
    const [academicResult, attitudeResult] = await Promise.all([
      api.from<{ id: string; student_id: string; subject_id: string; score: number; note: string | null }>('academic_grades')
        .select('id, student_id, subject_id, score, note')
        .eq('term_id', termId)
        .order('updated_at', { ascending: false }),
      api.from<{ id: string; student_id: string; aspect_id: string; score: number; note: string | null }>('attitude_grades')
        .select('id, student_id, aspect_id, score, note')
        .eq('term_id', termId)
        .order('updated_at', { ascending: false }),
    ]);
    if (academicResult.error) throw academicResult.error;
    if (attitudeResult.error) throw attitudeResult.error;
    const studentById = new Map(students.map((student) => [student.id, student]));
    const subjectById = new Map(subjects.map((subject) => [subject.id, subject.name]));
    const aspectById = new Map(aspects.map((aspect) => [aspect.id, aspect.name]));
    const academics = (academicResult.data ?? []).map((row) => ({
      id: row.id,
      student_id: row.student_id,
      subject_id: row.subject_id,
      score: row.score,
      note: row.note,
      kind: 'Akademik' as const,
      criterion: subjectById.get(row.subject_id) ?? 'Mapel nonaktif',
      student: studentById.get(row.student_id) ?? null,
    }));
    const attitudes = (attitudeResult.data ?? []).map((row) => ({
      id: row.id,
      student_id: row.student_id,
      aspect_id: row.aspect_id,
      score: row.score,
      note: row.note,
      kind: 'Attitude' as const,
      criterion: aspectById.get(row.aspect_id) ?? 'Aspek nonaktif',
      student: studentById.get(row.student_id) ?? null,
    }));
    return [...academics, ...attitudes] as GradeRow[];
  }, [aspects, students, subjects]);

  useEffect(() => {
    let mounted = true;
    void fetchConfiguration()
      .then((configuration) => {
        if (mounted) applyConfiguration(configuration);
      })
      .catch((loadError: unknown) => {
        if (mounted) setError(loadError instanceof Error ? loadError.message : 'Gagal memuat data penilaian.');
      })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [applyConfiguration, fetchConfiguration]);

  useEffect(() => {
    let mounted = true;
    void fetchGrades(selectedTerm)
      .then((rows) => { if (mounted) setGrades(rows); })
      .catch((loadError: unknown) => {
        if (mounted) setError(loadError instanceof Error ? loadError.message : 'Gagal memuat nilai.');
      });
    return () => { mounted = false; };
  }, [fetchGrades, selectedTerm]);

  async function addTerm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const { data, error: insertError } = await api.from('academic_terms')
        .insert({ name: newTerm.trim() }).select('id, name').single();
      if (insertError) throw insertError;
      const term = data as AcademicTerm;
      setTerms((current) => [term, ...current]);
      setSelectedTerm(term.id);
      setNewTerm('');
      setMessage('Periode akademik ditambahkan.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Gagal menambahkan periode.');
    } finally {
      setBusy(false);
    }
  }

  async function addCriterion(event: FormEvent<HTMLFormElement>, table: 'academic_subjects' | 'attitude_aspects', name: string) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const { error: insertError } = await api.from(table).insert({ name: name.trim() });
      if (insertError) throw insertError;
      applyConfiguration(await fetchConfiguration());
      if (table === 'academic_subjects') setNewSubject('');
      else setNewAspect('');
      setMessage('Aspek penilaian ditambahkan.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Gagal menambahkan aspek.');
    } finally {
      setBusy(false);
    }
  }

  async function updateCriterion() {
    if (!editing || !editing.name.trim()) return;
    setBusy(true);
    setError('');
    try {
      const { error: updateError } = await api.from(editing.table)
        .update({ name: editing.name.trim() }).eq('id', editing.id);
      if (updateError) throw updateError;
      setEditing(null);
      applyConfiguration(await fetchConfiguration());
      setMessage('Nama aspek penilaian diperbarui.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Gagal mengubah aspek penilaian.');
    } finally {
      setBusy(false);
    }
  }

  async function toggleCriterion(table: 'academic_subjects' | 'attitude_aspects', criterion: Criterion) {
    setError('');
    try {
      const { error: updateError } = await api.from(table)
        .update({ is_active: !criterion.is_active }).eq('id', criterion.id);
      if (updateError) throw updateError;
      applyConfiguration(await fetchConfiguration());
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Gagal mengubah status aspek.');
    }
  }

  async function saveGrade(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTerm || !studentId || !criterionId) {
      setError('Pilih periode, santri, dan aspek penilaian terlebih dahulu.');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const table = kind === 'academic' ? 'academic_grades' : 'attitude_grades';
      const metric = kind === 'academic' ? 'subject_id' : 'aspect_id';
      const conflict = kind === 'academic' ? 'student_id,term_id,subject_id' : 'student_id,term_id,aspect_id';
      if (kind === 'attitude' && !canManageConfiguration) {
        setError('Guru hanya dapat menginput nilai mata pelajaran.');
        return;
      }
      const { error: saveError } = await api.from(table).upsert({
        student_id: studentId,
        term_id: selectedTerm,
        [metric]: criterionId,
        score: Number(score),
        note: note.trim() || null,
      }, { onConflict: conflict });
      if (saveError) throw saveError;
      setGrades(await fetchGrades(selectedTerm));
      setMessage('Nilai berhasil disimpan.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Gagal menyimpan nilai.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="page-heading compact">
        <div><p className="eyebrow">PENDIDIKAN SANTRI</p><h1>Penilaian akademik &amp; attitude</h1><p className="muted">Nilai mata pelajaran dan karakter santri per periode.</p></div>
        <BookOpen size={30} />
      </div>
      {error && <div className="form-message module-message"><AlertCircle size={15} />{error}</div>}
      {message && <div className="module-success"><Check size={15} />{message}</div>}
      <section className="panel module-toolbar">
        <label>Periode penilaian<select value={selectedTerm} onChange={(event) => setSelectedTerm(event.target.value)}>
          <option value="">Pilih periode</option>
          {terms.map((term) => <option key={term.id} value={term.id}>{term.name}</option>)}
        </select></label>
        {canManageConfiguration && <form className="module-inline-form" onSubmit={(event) => void addTerm(event)}>
          <label>Tambah periode<input value={newTerm} onChange={(event) => setNewTerm(event.target.value)} placeholder="Contoh: 2026/2027 - Ganjil" required /></label>
          <button className="primary-button" disabled={busy}><Plus size={15} />Tambah</button>
        </form>}
      </section>

 <section className="panel academic-grade-panel">
        <div className="panel-heading"><div><h2>Input nilai santri</h2><p>Nilai 0–100. Input dengan kombinasi periode, santri, dan aspek yang sama akan memperbarui nilai sebelumnya.</p></div></div>
        {canEdit ? (
          <form className="module-form-grid" onSubmit={(event) => void saveGrade(event)}>
            <label>Jenis penilaian<select value={kind} onChange={(event) => { setKind(event.target.value as 'academic' | 'attitude'); setCriterionId(''); }}>
              <option value="academic">Akademik</option><option value="attitude" disabled={!canManageConfiguration}>Attitude / karakter</option>
            </select></label>
            <label>Santri<select value={studentId} onChange={(event) => setStudentId(event.target.value)} required>
              <option value="">Pilih santri</option>{activeStudents.map((student) => <option key={student.id} value={student.id}>{student.full_name} · {student.class_name}</option>)}
            </select></label>
            <label>{kind === 'academic' ? 'Mata pelajaran' : 'Aspek attitude'}<select value={criterionId} onChange={(event) => setCriterionId(event.target.value)} required>
              <option value="">Pilih aspek</option>{availableCriteria.map((criterion) => <option key={criterion.id} value={criterion.id}>{criterion.name}</option>)}
            </select></label>
            <label>Nilai (0–100)<input type="number" min="0" max="100" step="0.01" value={score} onChange={(event) => setScore(event.target.value)} required /></label>
            <label>Catatan (opsional)<input value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} /></label>
            <button className="primary-button" disabled={busy || !selectedTerm}><Save size={15} />Simpan nilai</button>
          </form>
        ) : <p className="muted">Input nilai hanya dapat dilakukan administrator.</p>}
      </section>
      <section className="panel table-panel module-history">
        <div className="panel-heading"><div><h2>Nilai periode ini</h2><p>{loading ? 'Memuat nilai...' : `${grades.length} nilai tercatat`}</p></div></div>
        <div className="table-scroll"><table><thead><tr><th>Santri</th><th>Kelas</th><th>Jenis</th><th>Mata pelajaran / aspek</th><th>Nilai</th><th>Catatan</th><th></th></tr></thead>
          <tbody>{grades.slice((currentGradesPage - 1) * PAGE_SIZE, currentGradesPage * PAGE_SIZE).map((grade) => (
            <tr key={`${grade.kind}-${grade.id}`}>
              <td>{grade.student?.full_name ?? 'Santri'}</td><td>{grade.student?.class_name ?? '-'}</td><td>{grade.kind}</td><td>{grade.criterion}</td>
              <td><b>{Number(grade.score).toLocaleString('id-ID')}</b></td><td>{grade.note || '-'}</td>
              <td>{canEdit && (grade.kind === 'Akademik' || canManageConfiguration) && <button className="text-button" onClick={() => {
                setKind(grade.kind === 'Akademik' ? 'academic' : 'attitude');
                setStudentId(grade.student_id);
                setCriterionId(grade.kind === 'Akademik' ? (grade as GradeRow & { subject_id?: string }).subject_id ?? '' : (grade as GradeRow & { aspect_id?: string }).aspect_id ?? '');
                setScore(String(grade.score));
                setNote(grade.note ?? '');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}>Edit</button>}</td>
            </tr>
          ))}</tbody>
        </table></div>
        {!loading && grades.length === 0 && <p className="module-empty">Belum ada nilai untuk periode ini.</p>}
        <Pagination page={currentGradesPage} itemCount={grades.length} onPageChange={setGradesPage} />
      </section>

      {canManageConfiguration && (
        <section className="academic-config-grid">
          {([
            { title: 'Mata pelajaran', table: 'academic_subjects' as const, values: subjects, value: newSubject, setValue: setNewSubject, page: subjectsPage, setPage: setSubjectsPage },
            { title: 'Aspek attitude / karakter', table: 'attitude_aspects' as const, values: aspects, value: newAspect, setValue: setNewAspect, page: aspectsPage, setPage: setAspectsPage },
          ]).map(({ title, table, values, value, setValue, page, setPage }) => {
            const currentPage = Math.min(page, Math.max(1, Math.ceil(values.length / PAGE_SIZE)));
            return (
            <section className="panel module-config" key={table}>
              <h2>{title}</h2>
              <form className="module-inline-form" onSubmit={(event) => void addCriterion(event, table, value)}>
                <label>Nama<input value={value} onChange={(event) => setValue(event.target.value)} required /></label>
                <button className="secondary-button" disabled={busy} aria-label={`Tambah ${title}`}><Plus size={15} /></button>
              </form>
              <div className="criterion-list">
                {values.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE).map((criterion) => (
                  <div className={`criterion-row ${criterion.is_active ? '' : 'is-inactive'}`} key={criterion.id}>
                    {editing?.id === criterion.id ? (
                      <>
                        <input aria-label={`Ubah nama ${criterion.name}`} value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} />
                        <button className="criterion-action" onClick={() => void updateCriterion()} aria-label="Simpan nama"><Save size={15} /></button>
                        <button className="criterion-action" onClick={() => setEditing(null)} aria-label="Batal"><X size={15} /></button>
                      </>
                    ) : (
                      <>
                        <span>{criterion.name}{!criterion.is_active && <small> (nonaktif)</small>}</span>
                        <button className="criterion-action" onClick={() => setEditing({ table, id: criterion.id, name: criterion.name })} aria-label={`Ubah ${criterion.name}`}><Pencil size={14} /></button>
                        <button className="criterion-action" onClick={() => void toggleCriterion(table, criterion)}>{criterion.is_active ? 'Nonaktifkan' : 'Aktifkan'}</button>
                      </>
                    )}
                  </div>
                ))}
              </div>
              <Pagination page={currentPage} itemCount={values.length} onPageChange={setPage} />
            </section>
            );
          })}
        </section>
      )}
     
    </>
  );
}
