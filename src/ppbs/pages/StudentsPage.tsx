import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { AlertCircle, CreditCard, Download, ImagePlus, MoreHorizontal, Search, Trash2, UserPlus, X } from 'lucide-react';
import { api } from '../../lib/api';
import { downloadExcel } from '../lib/format';
import { ConfirmModal } from '../components/ConfirmModal';
import { StudentPhoto } from '../components/StudentPhoto';
import { convertImageToWebp } from '../lib/image';
import { StudentDetailPage } from './StudentDetailPage';
import type { Student } from '../../types';

const MAX_PHOTO_SIZE = 5 * 1024 * 1024;
const ACCEPTED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

type StudentsPageProps = {
  students: Student[];
  canEdit: boolean;
  onSaved: (message: string) => void;
};

export function StudentsPage({ students, canEdit, onSaved }: StudentsPageProps) {
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [active, setActive] = useState(true);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [convertingPhoto, setConvertingPhoto] = useState(false);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [form, setForm] = useState({ full_name: '', student_code: '', class_name: '', parent_name: '', birth_place_date: '', card_uid: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const photoSelectionId = useRef(0);
  const filtered = useMemo(
    () => students.filter((student) => `${student.full_name} ${student.student_code} ${student.class_name}`.toLowerCase().includes(search.toLowerCase())),
    [students, search],
  );

  async function uploadPhoto(file: File) {
    if (file.type !== 'image/webp') {
      throw new Error('Foto harus dikonversi ke format WebP sebelum diunggah.');
    }
    if (file.size > MAX_PHOTO_SIZE) {
      throw new Error('Ukuran foto maksimal 5 MB.');
    }

    const path = `${crypto.randomUUID()}.webp`;
    const { error: uploadError } = await api.storage
      .from('student-photos')
      .upload(path, file, { contentType: 'image/webp', upsert: false });
    if (uploadError) throw uploadError;
    return path;
  }

  async function removeStoredPhoto(path: string) {
    const { error: removeError } = await api.storage.from('student-photos').remove([path]);
    if (removeError) throw removeError;
  }

  async function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0] ?? null;
    if (!file) return;
    const selectionId = ++photoSelectionId.current;
    if (!ACCEPTED_PHOTO_TYPES.includes(file.type)) {
      setConvertingPhoto(false);
      setError('Pilih foto berformat JPG, PNG, atau WebP.');
      input.value = '';
      return;
    }
    if (file.size > MAX_PHOTO_SIZE) {
      setConvertingPhoto(false);
      setError('Ukuran foto maksimal 5 MB.');
      input.value = '';
      return;
    }
    setError('');
    setConvertingPhoto(true);
    try {
      const webpPhoto = await convertImageToWebp(file, MAX_PHOTO_SIZE);
      if (selectionId !== photoSelectionId.current) return;
      setPhotoFile(webpPhoto);
      setRemovePhoto(false);
    } catch (conversionError) {
      if (selectionId === photoSelectionId.current) {
        setPhotoFile(null);
        setError(conversionError instanceof Error ? conversionError.message : 'Terjadi kesalahan saat mengonversi foto.');
      }
    } finally {
      if (selectionId === photoSelectionId.current) setConvertingPhoto(false);
      input.value = '';
    }
  }

  async function addStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (editingStudent) {
        const newPhotoPath = photoFile ? await uploadPhoto(photoFile) : null;
        const { error: updateError } = await api.from('students').update({
          full_name: form.full_name.trim(),
          student_code: form.student_code.trim().toUpperCase(),
          class_name: form.class_name.trim() || 'Belum ditentukan',
          parent_name: form.parent_name.trim() || null,
          birth_place_date: form.birth_place_date.trim() || null,
          photo_url: newPhotoPath ?? (removePhoto ? null : editingStudent.photo_url),
          is_active: active,
        }).eq('id', editingStudent.id);
        if (updateError) {
          if (newPhotoPath) await removeStoredPhoto(newPhotoPath);
          setError(updateError.code === '23505' ? 'NIS sudah digunakan.' : updateError.message);
          return;
        }
        const cardUid = form.card_uid.trim().replace(/[^A-F0-9]/gi, '').toUpperCase();
        let cardSaveError = '';
        if (cardUid) {
          const currentCard = editingStudent.rfid_cards[0];
          const cardQuery = currentCard
            ? api.from('cards').update({ uid: cardUid }).eq('student_id', editingStudent.id).eq('uid', currentCard.uid)
            : api.from('cards').insert({ student_id: editingStudent.id, uid: cardUid, is_active: true });
          const { error: cardError } = await cardQuery;
          if (cardError) {
            cardSaveError = cardError.code === '23505' ? 'UID kartu RFID sudah terdaftar.' : cardError.message;
          }
        }
        let savedMessage = `Data santri ${form.full_name.trim()} berhasil diperbarui.`;
        if (cardSaveError) savedMessage += ` Kartu RFID gagal diperbarui: ${cardSaveError}`;
        else if (cardUid) savedMessage += ' Kartu RFID berhasil diperbarui.';
        if ((newPhotoPath || removePhoto) && editingStudent.photo_url) {
          try {
            await removeStoredPhoto(editingStudent.photo_url);
          } catch (cleanupError) {
            const message = cleanupError instanceof Error ? cleanupError.message : 'Kesalahan tidak diketahui.';
            savedMessage += ` Foto lama gagal dibersihkan: ${message}`;
          }
        }
        setModalOpen(false);
        setEditingStudent(null);
        setPhotoFile(null);
        setRemovePhoto(false);
        onSaved(savedMessage);
        return;
      }

      const { data, error: insertError } = await api.rpc('register_student_with_card', {
        p_student_code: form.student_code.trim(),
        p_full_name: form.full_name.trim(),
        p_class_name: form.class_name.trim() || 'Belum ditentukan',
        p_parent_name: form.parent_name.trim() || null,
        p_birth_place_date: form.birth_place_date.trim() || null,
        p_card_uid: form.card_uid.trim(),
      });
      if (insertError || !data) {
        const message = insertError?.message ?? '';
        const duplicateUid = insertError?.code === '23505' && /cards_uid_key|uid/i.test(message);
        setError(
          duplicateUid
            ? 'UID kartu RFID sudah terdaftar.'
            : insertError?.code === '23505'
              ? 'NIS sudah digunakan.'
              : message || 'Data santri dan kartu RFID belum berhasil disimpan.',
        );
        return;
      }
      let savedMessage = `Data santri ${form.full_name.trim()} dan kartu RFID berhasil didaftarkan.`;
      if (photoFile) {
        try {
          const photoPath = await uploadPhoto(photoFile);
          const { error: photoUpdateError } = await api
            .from('students')
            .update({ photo_url: photoPath })
            .eq('id', data);
          if (photoUpdateError) {
            await removeStoredPhoto(photoPath);
            throw photoUpdateError;
          }
          savedMessage = `Data santri ${form.full_name.trim()}, kartu RFID, dan foto berhasil didaftarkan.`;
        } catch (photoError) {
          const message = photoError instanceof Error ? photoError.message : 'Terjadi kesalahan saat mengunggah foto.';
          savedMessage += ` Foto gagal disimpan: ${message}`;
        }
      }
      setForm({ full_name: '', student_code: '', class_name: '', parent_name: '', birth_place_date: '', card_uid: '' });
      setPhotoFile(null);
      setRemovePhoto(false);
      setModalOpen(false);
      setEditingStudent(null);
      onSaved(savedMessage);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Terjadi kesalahan saat menyimpan data santri.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteStudent(student: Student) {
    setSaving(true);
    setError('');
    try {
      const { error: deleteError } = await api.from('students').delete().eq('id', student.id);
      if (deleteError) throw deleteError;
      let message = `Santri ${student.full_name}, kartu RFID, dan riwayat absensinya berhasil dihapus.`;
      if (student.photo_url) {
        try {
          await removeStoredPhoto(student.photo_url);
        } catch (cleanupError) {
          const cleanupMessage = cleanupError instanceof Error ? cleanupError.message : 'Kesalahan tidak diketahui.';
          message += ` Foto gagal dibersihkan dari penyimpanan: ${cleanupMessage}`;
        }
      }
      onSaved(message);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : `Gagal menghapus data santri ${student.full_name}.`);
    } finally {
      setSaving(false);
    }
  }

  function openAddForm() {
    setEditingStudent(null);
    setForm({ full_name: '', student_code: '', class_name: '', parent_name: '', birth_place_date: '', card_uid: '' });
    setPhotoFile(null);
    setRemovePhoto(false);
    setActive(true);
    setError('');
    setModalOpen(true);
  }

  function openEditForm(student: Student) {
    setEditingStudent(student);
    setForm({
      full_name: student.full_name,
      student_code: student.student_code,
      class_name: student.class_name,
      parent_name: student.parent_name ?? '',
      birth_place_date: student.birth_place_date ?? '',
      card_uid: student.rfid_cards[0]?.uid ?? '',
    });
    setPhotoFile(null);
    setRemovePhoto(false);
    setActive(student.is_active);
    setError('');
    setModalOpen(true);
  }

  return (
    <>
      {selectedStudent ? (
        <StudentDetailPage
          student={selectedStudent}
          canEdit={canEdit}
          onBack={() => setSelectedStudent(null)}
          onEdit={() => openEditForm(selectedStudent)}
        />
      ) : (
      <>
      <div className="page-heading compact">
        <div><p className="eyebrow">DATA SANTRI</p><h1>Santri</h1><p className="muted">Kelola data santri dan status keaktifannya.</p></div>
        <button className="primary-button" disabled={!canEdit} onClick={openAddForm}>
          <UserPlus size={16} />Tambah santri
        </button>
      </div>
      <section className="panel table-panel">
        <div className="table-toolbar">
          <div className="search-box"><Search size={17} /><input placeholder="Cari nama, NIS, atau kelas..." value={search} onChange={(event) => setSearch(event.target.value)} /></div>
          <button className="secondary-button" onClick={() => downloadExcel('daftar-santri.xls', ['NIS', 'Nama', 'Kelas', 'Orang tua/wali', 'Tempat, tanggal lahir', 'UID RFID', 'Status'], filtered.map((student) => [student.student_code, student.full_name, student.class_name, student.parent_name ?? '', student.birth_place_date ?? '', student.rfid_cards.map((card) => card.uid).join('; '), student.is_active ? 'Aktif' : 'Nonaktif']))}>
            <Download size={16} />Export Excel
          </button>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Santri</th><th>NIS</th><th>Kelas</th><th>Orang tua/wali</th><th>Tempat, tanggal lahir</th><th>Kartu RFID</th><th>Status</th><th /></tr></thead>
            <tbody>
              {filtered.map((student) => (
                <tr key={student.id}>
                  <td><button type="button" className="student-name-link" onClick={() => setSelectedStudent(student)}><div className="table-person"><StudentPhoto studentId={student.id} fullName={student.full_name} photoPath={student.photo_url} /><b>{student.full_name}</b></div></button></td>
                  <td><code>{student.student_code}</code></td><td>{student.class_name}</td><td>{student.parent_name || <span className="muted">—</span>}</td><td>{student.birth_place_date || <span className="muted">—</span>}</td>
                  <td>{student.rfid_cards.length
                    ? student.rfid_cards.map((card) => <div key={card.uid}><code>{card.uid}</code> {!card.is_active && <small>(nonaktif)</small>}</div>)
                    : <span className="muted">Belum terdaftar</span>}</td>
                  <td><span className={`status-badge ${student.is_active ? 'active' : 'inactive'}`}><i />{student.is_active ? 'Aktif' : 'Nonaktif'}</span></td>
                  <td>
                    <div className="student-row-actions">
                      <button className="more-button" disabled={!canEdit || saving} onClick={() => openEditForm(student)} aria-label={`Edit ${student.full_name}`} title="Edit santri"><MoreHorizontal size={18} /></button>
                      <button className="more-button danger-button" disabled={!canEdit || saving} onClick={() => setStudentToDelete(student)} aria-label={`Hapus ${student.full_name}`} title="Hapus santri"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={8}>Belum ada data santri yang cocok dengan pencarian.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      </>
      )}
      {modalOpen && (
        <div className="modal-backdrop" onMouseDown={() => setModalOpen(false)}>
          <div className="modal-card student-modal-card" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-heading">
              <div><p className="eyebrow">DATA SANTRI</p><h2>{editingStudent ? 'Edit data santri' : 'Tambah santri'}</h2><p>{editingStudent ? 'Perbarui data dan status santri.' : 'Masukkan informasi santri baru.'}</p></div>
              <button className="icon-button" onClick={() => setModalOpen(false)} aria-label="Tutup"><X size={18} /></button>
            </div>
            <form className="member-form" onSubmit={addStudent}>
              <label>Nama lengkap<input value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} placeholder="Nama lengkap santri" required /></label>
              <label>Nomor induk santri (NIS)<input value={form.student_code} onChange={(event) => setForm({ ...form, student_code: event.target.value })} placeholder="Contoh: 2026001" required /></label>
              <label>Kelas<input value={form.class_name} onChange={(event) => setForm({ ...form, class_name: event.target.value })} placeholder="Contoh: 1A" /></label>
              <label>Nama orang tua/wali<input value={form.parent_name} onChange={(event) => setForm({ ...form, parent_name: event.target.value })} placeholder="Nama orang tua atau wali" /></label>
              <label>Tempat, tanggal lahir<input value={form.birth_place_date} onChange={(event) => setForm({ ...form, birth_place_date: event.target.value })} placeholder="Contoh: Bandung, 12 Januari 2010" /></label>
              <div className="student-photo-field">
                <StudentPhoto
                  studentId={editingStudent?.id ?? 'new-student'}
                  fullName={form.full_name || 'Santri'}
                  photoPath={removePhoto ? null : editingStudent?.photo_url ?? null}
                  file={photoFile}
                  large
                />
                <div className="student-photo-controls">
                  <label className="secondary-button photo-select-button">
                    <ImagePlus size={15} />{convertingPhoto ? 'Mengonversi...' : photoFile || editingStudent?.photo_url && !removePhoto ? 'Ganti foto' : 'Unggah foto'}
                    <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoChange} />
                  </label>
                  {(photoFile || editingStudent?.photo_url && !removePhoto) && (
                    <button type="button" className="text-button photo-remove-button" onClick={() => { setPhotoFile(null); setRemovePhoto(true); }}>
                      Hapus foto
                    </button>
                  )}
                  <small>JPG/PNG/WebP otomatis dikonversi ke WebP · Maks. 5 MB</small>
                </div>
              </div>
              {editingStudent && <label className="student-active-toggle"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />Santri aktif</label>}
              <div className="form-section-heading"><CreditCard size={16} /><span>Kartu RFID santri</span></div>
              <label>UID kartu RFID<input value={form.card_uid} onChange={(event) => setForm({ ...form, card_uid: event.target.value.toUpperCase() })} placeholder="Scan atau masukkan UID kartu" pattern="[A-Fa-f0-9: -]{4,}" required={!editingStudent} /></label>
              <p className="form-hint">{editingStudent ? 'Kosongkan jika tidak ingin mengubah kartu RFID.' : 'UID kartu wajib diisi dan disimpan bersama data santri.'}</p>
              {studentToDelete && (
                <ConfirmModal
                  title="Hapus data santri?"
                  description={`Santri "${studentToDelete.full_name}" akan dihapus permanen bersama kartu RFID dan seluruh riwayat absensinya. Tindakan ini tidak dapat dibatalkan.`}
                  confirmLabel="Hapus permanen"
                  busy={saving}
                  danger
                  onCancel={() => setStudentToDelete(null)}
                  onConfirm={() => {
                    const selectedStudent = studentToDelete;
                    setStudentToDelete(null);
                    void deleteStudent(selectedStudent);
                  }}
                />
              )}
              {error && <div className="form-message"><AlertCircle size={15} />{error}</div>}
              <div className="modal-actions">
                <button type="button" className="secondary-button" onClick={() => setModalOpen(false)}>Batal</button>
                <button type="submit" className="primary-button" disabled={saving || convertingPhoto}>{saving ? 'Menyimpan...' : convertingPhoto ? 'Mengonversi foto...' : editingStudent ? 'Simpan perubahan' : 'Simpan santri'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
