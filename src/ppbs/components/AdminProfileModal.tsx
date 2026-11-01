import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { AlertCircle, Eye, EyeOff, ImagePlus, X } from 'lucide-react';
import { AdminAvatar } from '../../components/AdminAvatar';
import { convertImageToWebp } from '../lib/image';
import { api } from '../../lib/api';
import type { Profile } from '../../types';

type AdminProfileModalProps = {
  profile: Profile;
  onClose: () => void;
  onUpdated: (profile: Profile, message: string) => void;
};

const maxPhotoSize = 5 * 1024 * 1024;
const acceptedPhotoTypes = ['image/jpeg', 'image/png', 'image/webp'];

export function AdminProfileModal({ profile, onClose, onUpdated }: AdminProfileModalProps) {
  const [fullName, setFullName] = useState(profile.full_name);
  const [email, setEmail] = useState(profile.email);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [convertingPhoto, setConvertingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const selectionId = useRef(0);

  async function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    const currentSelection = ++selectionId.current;
    if (!acceptedPhotoTypes.includes(file.type)) {
      setConvertingPhoto(false);
      setError('Pilih foto berformat JPG, PNG, atau WebP.');
      input.value = '';
      return;
    }
    if (file.size > maxPhotoSize) {
      setConvertingPhoto(false);
      setError('Ukuran foto maksimal 5 MB.');
      input.value = '';
      return;
    }
    setError('');
    setConvertingPhoto(true);
    try {
      const webp = await convertImageToWebp(file, maxPhotoSize);
      if (currentSelection === selectionId.current) {
        setPhotoFile(webp);
        setRemovePhoto(false);
      }
    } catch (photoError) {
      if (currentSelection === selectionId.current) {
        setPhotoFile(null);
        setError(photoError instanceof Error ? photoError.message : 'Foto gagal dikonversi ke WebP.');
      }
    } finally {
      if (currentSelection === selectionId.current) setConvertingPhoto(false);
      input.value = '';
    }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextName = fullName.trim();
    if (!nextName) {
      setError('Nama admin wajib diisi.');
      return;
    }
    if (password && password.length < 6) {
      setError('Kata sandi minimal 6 karakter.');
      return;
    }
    setSaving(true);
    setError('');
    let uploadedPath: string | null = null;
    let profileSaved = false;
    try {
      if (photoFile) {
        uploadedPath = `${profile.user_id}/profile-${crypto.randomUUID()}.webp`;
        const { error: uploadError } = await api.storage
          .from('admin-photos')
          .upload(uploadedPath, photoFile, { contentType: 'image/webp', upsert: false });
        if (uploadError) throw uploadError;
      }

      const nextPhotoPath = photoFile ? uploadedPath : removePhoto ? null : profile.avatar_path;
      const { error: profileError } = await api.rpc('update_admin_profile', {
        p_full_name: nextName,
        p_avatar_path: nextPhotoPath,
      });
      if (profileError) throw profileError;
      profileSaved = true;

      const nextProfile = { ...profile, full_name: nextName, email: email.trim(), avatar_path: nextPhotoPath };
      const emailChanged = email.trim().toLowerCase() !== profile.email.toLowerCase();
      if (emailChanged || password || nextName !== profile.full_name) {
        const { error: authError } = await api.auth.updateUser({
          ...(emailChanged ? { email: email.trim() } : {}),
          ...(password ? { password } : {}),
          data: { full_name: nextName },
        });
        if (authError) {
          onUpdated(nextProfile, `Profil tersimpan, tetapi perubahan email/kata sandi gagal: ${authError.message}`);
          return;
        }
      }

      if ((photoFile || removePhoto) && profile.avatar_path) {
        const { error: cleanupError } = await api.storage.from('admin-photos').remove([profile.avatar_path]);
        if (cleanupError) {
          onUpdated(nextProfile, `Profil berhasil diperbarui, tetapi foto lama gagal dibersihkan: ${cleanupError.message}`);
          return;
        }
      }
      onUpdated(
        nextProfile,
        emailChanged
          ? 'Profil diperbarui. Perubahan email langsung berlaku.'
          : 'Profil admin berhasil diperbarui.',
      );
    } catch (saveError) {
      if (uploadedPath && !profileSaved) {
        const { error: cleanupError } = await api.storage.from('admin-photos').remove([uploadedPath]);
        if (cleanupError) {
          setError(`${saveError instanceof Error ? saveError.message : 'Profil gagal disimpan.'} Foto yang gagal dipakai juga tidak dapat dibersihkan: ${cleanupError.message}`);
          return;
        }
      }
      setError(saveError instanceof Error ? saveError.message : 'Profil admin gagal diperbarui.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (!saving && event.target === event.currentTarget) onClose(); }}>
      <section className="modal-card admin-profile-modal" role="dialog" aria-modal="true" aria-labelledby="admin-profile-title">
        <div className="modal-heading">
          <div><p className="eyebrow">AKUN ADMIN</p><h2 id="admin-profile-title">Pengaturan profil</h2><p>Perbarui identitas dan foto profil admin.</p></div>
          <button className="icon-button" type="button" onClick={onClose} disabled={saving} aria-label="Tutup"><X size={18} /></button>
        </div>
        <form className="member-form" onSubmit={(event) => void saveProfile(event)}>
          <div className="admin-profile-photo">
            <AdminAvatar userId={profile.user_id} fullName={fullName || profile.full_name} photoPath={removePhoto ? null : profile.avatar_path} file={photoFile} className="admin-avatar-preview" />
            <div className="student-photo-controls">
              <label className="secondary-button photo-select-button">
                <ImagePlus size={15} />{convertingPhoto ? 'Mengonversi...' : photoFile || profile.avatar_path && !removePhoto ? 'Ganti foto' : 'Unggah foto'}
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void handlePhotoChange(event)} />
              </label>
              {(photoFile || profile.avatar_path && !removePhoto) && (
                <button type="button" className="text-button photo-remove-button" onClick={() => { setPhotoFile(null); setRemovePhoto(true); }}>
                  Hapus foto
                </button>
              )}
              <small>JPG/PNG/WebP otomatis dikonversi · Maks. 5 MB</small>
            </div>
          </div>
          <label>Nama admin<input value={fullName} onChange={(event) => setFullName(event.target.value)} required /></label>
          <label>Email admin<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
          <label>Kata sandi baru (opsional)<span className="password-input-wrap"><input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} minLength={6} placeholder="Minimal 6 karakter" /><button className="password-visibility-button" type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></span></label>
          {error && <div className="form-message"><AlertCircle size={15} />{error}</div>}
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onClose} disabled={saving}>Batal</button>
            <button type="submit" className="primary-button" disabled={saving || convertingPhoto}>{saving ? 'Menyimpan...' : convertingPhoto ? 'Mengonversi foto...' : 'Simpan perubahan'}</button>
          </div>
        </form>
      </section>
    </div>
  );
}
