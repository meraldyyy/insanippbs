import { ArrowLeft, CreditCard, Edit3, UserRound, Users } from 'lucide-react';
import { StudentPhoto } from '../components/StudentPhoto';
import type { Student } from '../../types';

type StudentDetailPageProps = {
  student: Student;
  canEdit: boolean;
  onBack: () => void;
  onEdit: () => void;
};

export function StudentDetailPage({ student, canEdit, onBack, onEdit }: StudentDetailPageProps) {
  return (
    <div className="student-detail-page">
      <div className="page-heading compact">
        <div>
          <button type="button" className="back-button" onClick={onBack}><ArrowLeft size={15} />Kembali ke data santri</button>
          <p className="eyebrow">DETAIL SANTRI</p>
          <h1>{student.full_name}</h1>
          <p className="muted">Profil lengkap dan informasi pendukung santri.</p>
        </div>
        {canEdit && <button type="button" className="primary-button" onClick={onEdit}><Edit3 size={16} />Edit data santri</button>}
      </div>

      <section className="student-detail-hero panel">
        <StudentPhoto studentId={student.id} fullName={student.full_name} photoPath={student.photo_url} large />
        <div className="student-detail-identity">
          <span className="eyebrow">SANTRI</span>
          <h2>{student.full_name}</h2>
          <p><code>{student.student_code}</code> · {student.class_name}</p>
          <span className={`status-badge ${student.is_active ? 'active' : 'inactive'}`}><i />{student.is_active ? 'Aktif' : 'Nonaktif'}</span>
        </div>
      </section>

      <div className="student-detail-grid">
        <section className="panel student-detail-card">
          <div className="student-detail-card-heading"><UserRound size={17} /><h2>Data pribadi</h2></div>
          <dl className="student-detail-fields">
            <div><dt>Nama lengkap</dt><dd>{student.full_name}</dd></div>
            <div><dt>NIS</dt><dd>{student.student_code}</dd></div>
            <div><dt>Kelas</dt><dd>{student.class_name}</dd></div>
            <div><dt>Tempat, tanggal lahir</dt><dd>{student.birth_place_date || 'Belum diisi'}</dd></div>
            <div><dt>Status</dt><dd>{student.is_active ? 'Aktif' : 'Nonaktif'}</dd></div>
          </dl>
        </section>

        <section className="panel student-detail-card">
          <div className="student-detail-card-heading"><Users size={17} /><h2>Orang tua / wali</h2></div>
          <dl className="student-detail-fields">
            <div><dt>Nama orang tua / wali</dt><dd>{student.parent_name || 'Belum diisi'}</dd></div>
            <div><dt>Sumber data akun student</dt><dd className="detail-note">Field ini akan digunakan saat akun student dibuat.</dd></div>
          </dl>
        </section>

        <section className="panel student-detail-card">
          <div className="student-detail-card-heading"><CreditCard size={17} /><h2>Kartu RFID</h2></div>
          {student.rfid_cards.length > 0
            ? <div className="student-detail-card-list">{student.rfid_cards.map((card) => <div className="student-detail-card-row" key={card.uid}><code>{card.uid}</code><span className={`status-badge ${card.is_active ? 'active' : 'inactive'}`}><i />{card.is_active ? 'Aktif' : 'Nonaktif'}</span></div>)}</div>
            : <p className="detail-empty">Belum ada kartu RFID yang terdaftar.</p>}
        </section>
      </div>
    </div>
  );
}
