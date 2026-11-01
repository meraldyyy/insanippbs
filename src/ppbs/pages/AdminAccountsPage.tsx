import { useEffect, useState, type FormEvent } from 'react';
import { Edit3, Eye, EyeOff, ShieldCheck, Trash2, UserCog, X } from 'lucide-react';
import { api } from '../../lib/api';
import { ConfirmModal } from '../components/ConfirmModal';
import type { AdminAccount } from '../../types';

type AdminAccountsPageProps = {
  currentUserId: string;
  onChanged: (message: string) => void;
};

type AdminUsersResponse = { users: AdminAccount[] };

const emptyForm = { fullName: '', email: '', password: '' };

export function AdminAccountsPage({ currentUserId, onChanged }: AdminAccountsPageProps) {
  const [users, setUsers] = useState<AdminAccount[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<AdminAccount | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  async function loadUsers() {
    setLoading(true);
    setError('');
    const { data, error: responseError } = await api.functions.invoke<AdminUsersResponse>('admin-users', { action: 'list' });
    if (responseError) setError(responseError.message);
    else setUsers(data?.users ?? []);
    setLoading(false);
  }

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) return loadUsers();
    });
    return () => { active = false; };
  }, []);

  function startEdit(user: AdminAccount) {
    setEditing(user);
    setForm({ fullName: user.full_name, email: user.email, password: '' });
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function resetForm() {
    setEditing(null);
    setForm(emptyForm);
    setShowPassword(false);
  }

  async function saveUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const action = editing ? 'update' : 'create';
    const body = {
      action,
      user_id: editing?.user_id,
      full_name: form.fullName.trim(),
      email: form.email.trim().toLowerCase(),
      ...(form.password ? { password: form.password } : {}),
    };
    const { data, error: responseError } = await api.functions.invoke<{ user: AdminAccount }>('admin-users', body);
    if (responseError) {
      setError(responseError.message);
    } else {
      if (!data?.user) {
        setError('Server tidak mengembalikan data akun.');
        setBusy(false);
        return;
      }
      setUsers((current) => editing
        ? current.map((user) => user.user_id === editing.user_id ? data.user : user)
        : [...current, data.user].sort((left, right) => left.full_name.localeCompare(right.full_name)));
      onChanged(editing ? 'Akun admin berhasil diperbarui.' : 'Akun admin berhasil dibuat.');
      resetForm();
    }
    setBusy(false);
  }

  async function removeUser() {
    if (!deleteTarget) return;
    setBusy(true);
    setError('');
    const { error: responseError } = await api.functions.invoke('admin-users', {
      action: 'delete',
      user_id: deleteTarget.user_id,
    });
    if (responseError) {
      setError(responseError.message);
    } else {
      setUsers((current) => current.filter((user) => user.user_id !== deleteTarget.user_id));
      onChanged('Akun admin berhasil dihapus.');
      setDeleteTarget(null);
    }
    setBusy(false);
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">MANAJEMEN AKSES</p>
          <h1>Akun Admin</h1>
          <p className="muted">Buat dan kelola akun yang dapat mengakses seluruh dashboard PPBS.</p>
        </div>
      </div>

      <section className="admin-accounts-layout">
        <form className="panel admin-account-form" onSubmit={(event) => void saveUser(event)}>
          <div className="panel-heading"><div><h2>{editing ? 'Edit akun admin' : 'Tambah akun admin'}</h2><p>{editing ? 'Kosongkan password jika tidak ingin mengubahnya.' : 'Akun baru langsung memiliki akses administrator.'}</p></div><ShieldCheck size={22} /></div>
          <div className="member-form">
            <label>Nama lengkap<input required value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} placeholder="Nama administrator" /></label>
            <label>Email login<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="admin@contoh.com" /></label>
            <label className="admin-password-field">{editing ? 'Password baru (opsional)' : 'Password'}<span className="password-input-wrap"><input required={!editing} minLength={8} type={showPassword ? 'text' : 'password'} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="Minimal 8 karakter" /><button className="password-visibility-button" type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></span></label>
          </div>
          {error && <p className="form-message"><X size={15} />{error}</p>}
          <div className="modal-actions"><button className="secondary-button" type="button" onClick={resetForm} disabled={busy}>{editing ? 'Batal edit' : 'Reset'}</button><button className="primary-button" type="submit" disabled={busy}>{busy ? 'Menyimpan...' : editing ? 'Simpan perubahan' : 'Buat akun admin'}</button></div>
        </form>

        <section className="panel table-panel admin-accounts-table-panel">
          <div className="panel-heading"><div><h2>Daftar akun</h2><p>{users.length} akun administrator terdaftar</p></div><UserCog size={22} /></div>
          {loading ? <p className="empty-state">Memuat akun admin...</p> : users.length === 0 ? <p className="empty-state">Belum ada akun admin.</p> : <div className="table-wrap"><table><thead><tr><th>Administrator</th><th>Email</th><th>Login terakhir</th><th>Aksi</th></tr></thead><tbody>{users.map((user) => <tr key={user.user_id}><td data-label="Administrator"><div className="table-person"><span className="user-table-avatar"><UserCog size={15} /></span><div><b>{user.full_name}</b>{user.user_id === currentUserId && <small>Akun Anda</small>}</div></div></td><td data-label="Email" className="admin-account-email">{user.email}</td><td data-label="Login terakhir">{user.last_sign_in_at ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(user.last_sign_in_at)) : 'Belum pernah login'}</td><td data-label="Aksi"><div className="admin-account-actions"><button className="icon-button" type="button" onClick={() => startEdit(user)} title="Edit akun" aria-label={`Edit ${user.full_name}`}><Edit3 size={16} /></button><button className="icon-button danger-icon-button" type="button" onClick={() => setDeleteTarget(user)} disabled={user.user_id === currentUserId} title={user.user_id === currentUserId ? 'Akun sendiri tidak dapat dihapus' : 'Hapus akun'} aria-label={`Hapus ${user.full_name}`}><Trash2 size={16} /></button></div></td></tr>)}</tbody></table></div>}
        </section>
      </section>
      {deleteTarget && <ConfirmModal title="Hapus akun admin?" description={`Akun ${deleteTarget.full_name} akan dihapus dan tidak bisa digunakan untuk login lagi.`} confirmLabel="Hapus akun" danger busy={busy} onCancel={() => setDeleteTarget(null)} onConfirm={() => void removeUser()} />}
    </>
  );
}
