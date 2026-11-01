import { useEffect, useState, type FormEvent } from 'react';
import { AlertCircle, CalendarDays, Plus, Save, Trash2 } from 'lucide-react';
import { api } from '../../lib/api';
import { formatDate, localDateKey } from '../lib/format';
import type { AttendanceHoliday, PrayerSchedule, Schedule } from '../../types';


type SettingsPageProps = {
  onChanged: (message: string) => void;
  scanRevision: number;
};

const weekDays = [
  { value: 1, label: 'Senin' },
  { value: 2, label: 'Selasa' },
  { value: 3, label: 'Rabu' },
  { value: 4, label: 'Kamis' },
  { value: 5, label: 'Jumat' },
  { value: 6, label: 'Sabtu' },
  { value: 0, label: 'Minggu' },
];
const fullWeek = weekDays.map(({ value }) => value).sort((left, right) => left - right);
const defaultCustomDays = [1, 2, 3, 4, 5, 6];

const prayerOrder: PrayerSchedule['prayer_key'][] = ['subuh', 'zuhur', 'asar', 'magrib', 'isya'];

function dateAfter(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}

export function SettingsPage({ onChanged }: SettingsPageProps) {
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [holidays, setHolidays] = useState<AttendanceHoliday[]>([]);
  const [holidayDate, setHolidayDate] = useState(localDateKey());
  const [holidayName, setHolidayName] = useState('');
  const [prayerSchedules, setPrayerSchedules] = useState<PrayerSchedule[]>([]);
  const [scheduleError, setScheduleError] = useState('');
  const [holidayError, setHolidayError] = useState('');
  const [prayerScheduleError, setPrayerScheduleError] = useState('');
  const [busy, setBusy] = useState(false);
  const [holidayBusy, setHolidayBusy] = useState(false);
  const [holidaysLoading, setHolidaysLoading] = useState(true);
  const [prayerBusy, setPrayerBusy] = useState(false);

  useEffect(() => {
    let current = true;
    void Promise.all([
      api
        .from('schedules')
        .select('id, name, work_start, check_in_end, checkout_start, checkout_end, late_tolerance_minutes, work_days, is_active')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle(),
      api.from<PrayerSchedule>('prayer_schedules')
        .select('id, prayer_key, name, opens_at, closes_at, is_active')
        .order('opens_at'),
      api.from<AttendanceHoliday>('attendance_holidays')
        .select('id, holiday_date, name')
        .order('holiday_date'),
    ]).then(([scheduleResult, prayerResult, holidayResult]) => {
        if (!current) return;
        if (scheduleResult.error) setScheduleError(scheduleResult.error.message);
        else if (scheduleResult.data) setSchedule(scheduleResult.data as Schedule);
        else setScheduleError('Jadwal aktif tidak ditemukan.');
        if (holidayResult.error) setHolidayError(holidayResult.error.message);
        else setHolidays(holidayResult.data ?? []);
        setHolidaysLoading(false);
        if (prayerResult.error) setPrayerScheduleError(prayerResult.error.message);
        else {
          const rows = prayerResult.data ?? [];
          setPrayerSchedules(rows.sort((left, right) => prayerOrder.indexOf(left.prayer_key) - prayerOrder.indexOf(right.prayer_key)));
        }
      });
    return () => { current = false; };
  }, []);

  async function saveHoliday(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setHolidayBusy(true);
    setHolidayError('');
    try {
      const { error } = await api.from('attendance_holidays').insert({
        holiday_date: holidayDate,
        name: holidayName.trim() || null,
      });
      if (error) throw error;

      const { data, error: loadError } = await api.from<AttendanceHoliday>('attendance_holidays')
        .select('id, holiday_date, name')
        .order('holiday_date');
      if (loadError) throw loadError;
      setHolidays(data ?? []);
      setHolidayName('');
      onChanged(`Hari libur ${formatDate(holidayDate)} berhasil ditambahkan.`);
    } catch (error) {
      setHolidayError(error instanceof Error ? error.message : 'Gagal menyimpan hari libur.');
    } finally {
      setHolidayBusy(false);
    }
  }

  async function removeHoliday(holiday: AttendanceHoliday) {
    setHolidayBusy(true);
    setHolidayError('');
    try {
      const { error } = await api.from('attendance_holidays').delete().eq('id', holiday.id);
      if (error) throw error;
      setHolidays((current) => current.filter((item) => item.id !== holiday.id));
      onChanged(`Hari libur ${formatDate(holiday.holiday_date)} berhasil dihapus.`);
    } catch (error) {
      setHolidayError(error instanceof Error ? error.message : 'Gagal menghapus hari libur.');
    } finally {
      setHolidayBusy(false);
    }
  }

  async function saveSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!schedule) return;
    if (schedule.work_days.length === 0) {
      setScheduleError('Pilih minimal satu hari aktif untuk absensi.');
      return;
    }
    if (schedule.check_in_end <= schedule.work_start
      || schedule.checkout_start < schedule.check_in_end
      || schedule.checkout_end <= schedule.checkout_start) {
      setScheduleError('Urutan jam harus: absen masuk dibuka, absen masuk ditutup, absen pulang dibuka, lalu jam tutup absensi harian.');
      return;
    }
    setBusy(true);
    setScheduleError('');
    try {
      const { error } = await api.from('schedules').update({
        name: schedule.name.trim(),
        work_start: schedule.work_start,
        check_in_end: schedule.check_in_end,
        checkout_start: schedule.checkout_start,
        checkout_end: schedule.checkout_end,
        late_tolerance_minutes: schedule.late_tolerance_minutes,
        work_days: schedule.work_days,
      }).eq('id', schedule.id);
      if (error) throw error;
      onChanged('Pengaturan jadwal berhasil disimpan.');
    } catch (error) {
      setScheduleError(error instanceof Error ? error.message : 'Gagal menyimpan jadwal.');
    } finally {
      setBusy(false);
    }
  }

  async function savePrayerSchedules(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const active = prayerSchedules.filter((prayer) => prayer.is_active);
    if (active.some((prayer) => prayer.opens_at >= prayer.closes_at)) {
      setPrayerScheduleError('Jam tutup absen harus setelah jam buka untuk setiap waktu sholat yang aktif.');
      return;
    }
    const sorted = [...active].sort((left, right) => left.opens_at.localeCompare(right.opens_at));
    if (sorted.some((prayer, index) => index > 0 && prayer.opens_at < sorted[index - 1].closes_at)) {
      setPrayerScheduleError('Waktu absen sholat tidak boleh bertumpuk.');
      return;
    }

    setPrayerBusy(true);
    setPrayerScheduleError('');
    try {
      const { error } = await api.rpc('save_prayer_schedules', {
        p_schedules: prayerSchedules.map(({ prayer_key, opens_at, closes_at, is_active }) => ({
          prayer_key,
          opens_at: opens_at.slice(0, 5),
          closes_at: closes_at.slice(0, 5),
          is_active,
        })),
      });
      if (error) throw error;
      onChanged('Jadwal absen sholat berhasil disimpan.');
    } catch (error) {
      setPrayerScheduleError(error instanceof Error ? error.message : 'Gagal menyimpan jadwal absen sholat.');
    } finally {
      setPrayerBusy(false);
    }
  }

  function updatePrayerSchedule(prayerKey: PrayerSchedule['prayer_key'], update: Partial<PrayerSchedule>) {
    setPrayerSchedules((current) => current.map((prayer) => (
      prayer.prayer_key === prayerKey ? { ...prayer, ...update } : prayer
    )));
  }

  return (
    <>
      <div className="page-heading compact">
        <div><p className="eyebrow">KONFIGURASI</p><h1>Pengaturan</h1><p className="muted">Atur hari dan jam absensi harian, serta jadwal absensi sholat.</p></div>
      </div>
      <section className="panel settings-panel">
        <div className="panel-heading"><div><h2>Jadwal absensi harian (WIB)</h2><p>Atur hari aktif, batas absen masuk, dan jendela pulang. Scan di luar hari atau jam aktif tidak dicatat sebagai absensi.</p></div></div>
        {schedule && (
          <form className="settings-form" onSubmit={saveSchedule}>
            <label>Nama jadwal<input value={schedule.name} required onChange={(event) => setSchedule({ ...schedule, name: event.target.value })} /></label>
            <div className="settings-fields">
              <label>Absen masuk dibuka<input type="time" value={schedule.work_start.slice(0, 5)} required onChange={(event) => setSchedule({ ...schedule, work_start: event.target.value })} /></label>
              <label>Toleransi terlambat (menit)<input type="number" min="0" max="240" value={schedule.late_tolerance_minutes} required onChange={(event) => setSchedule({ ...schedule, late_tolerance_minutes: Number(event.target.value) })} /></label>
              <label>Jam tutup absen masuk<input type="time" value={schedule.check_in_end.slice(0, 5)} min={schedule.work_start.slice(0, 5)} max={schedule.checkout_start.slice(0, 5)} required onChange={(event) => setSchedule({ ...schedule, check_in_end: event.target.value })} /></label>
              <label>Absen pulang mulai<input type="time" value={schedule.checkout_start.slice(0, 5)} min={schedule.work_start.slice(0, 5)} required onChange={(event) => setSchedule({ ...schedule, checkout_start: event.target.value })} /></label>
              <label>Jam tutup absensi harian<input type="time" value={schedule.checkout_end.slice(0, 5)} min={schedule.checkout_start.slice(0, 5)} required onChange={(event) => setSchedule({ ...schedule, checkout_end: event.target.value })} /></label>
            </div>
            <div className="day-picker-controls" role="group" aria-label="Pilihan hari absensi">
              <button
                type="button"
                className={`secondary-button${schedule.work_days.length === fullWeek.length ? ' active' : ''}`}
                aria-pressed={schedule.work_days.length === fullWeek.length}
                onClick={() => setSchedule({ ...schedule, work_days: fullWeek })}
              >Seminggu penuh</button>
              <button
                type="button"
                className={`secondary-button${schedule.work_days.length < fullWeek.length ? ' active' : ''}`}
                aria-pressed={schedule.work_days.length < fullWeek.length}
                onClick={() => setSchedule({
                  ...schedule,
                  work_days: schedule.work_days.length === fullWeek.length ? defaultCustomDays : schedule.work_days,
                })}
              >Pilih hari</button>
              <span>{schedule.work_days.length === fullWeek.length ? 'Absensi aktif setiap hari.' : `${schedule.work_days.length} hari dipilih.`}</span>
            </div>
            <fieldset className="day-picker"><legend>Hari aktif</legend>{weekDays.map((day) => (
              <label key={day.value}><input type="checkbox" checked={schedule.work_days.includes(day.value)} onChange={(event) => setSchedule({
                ...schedule,
                work_days: event.target.checked
                  ? [...schedule.work_days, day.value].sort((a, b) => a - b)
                  : schedule.work_days.filter((value) => value !== day.value),
              })} />{day.label}</label>
            ))}</fieldset>
            {scheduleError && <div className="form-message"><AlertCircle size={15} />{scheduleError}</div>}
            <button className="primary-button" disabled={busy}><Save size={16} />Simpan jadwal</button>
          </form>
        )}
        {!schedule && !scheduleError && <p>Memuat jadwal...</p>}
        {!schedule && scheduleError && <div className="form-message"><AlertCircle size={15} />{scheduleError}</div>}
      </section>
      <section className="panel settings-panel">
        <div className="panel-heading"><div><h2>Hari libur absensi</h2><p>Tambahkan tanggal ketika absensi harian ditiadakan, misalnya libur hari ini atau besok. Presensi sholat tetap mengikuti jadwalnya sendiri.</p></div></div>
        <form className="settings-form" onSubmit={(event) => void saveHoliday(event)}>
          <div className="settings-fields holiday-fields">
            <label>Tanggal libur<input type="date" value={holidayDate} required onChange={(event) => setHolidayDate(event.target.value)} /></label>
            <label>Keterangan (opsional)<input value={holidayName} maxLength={255} placeholder="Contoh: Libur nasional" onChange={(event) => setHolidayName(event.target.value)} /></label>
          </div>
          <div className="holiday-action-row">
            <div className="holiday-quick-picks">
              <button type="button" className="secondary-button" onClick={() => setHolidayDate(localDateKey())}>Hari ini</button>
              <button type="button" className="secondary-button" onClick={() => setHolidayDate(dateAfter(localDateKey(), 1))}>Besok</button>
            </div>
            <button type="submit" className="primary-button" disabled={holidayBusy}><Plus size={16} />{holidayBusy ? 'Menyimpan...' : 'Tambah hari libur'}</button>
          </div>
          {holidayError && <div className="form-message"><AlertCircle size={15} />{holidayError}</div>}
        </form>
        <div className="holiday-list" aria-live="polite">
          {holidaysLoading && <p>Memuat hari libur...</p>}
          {!holidaysLoading && holidays.length === 0 && <p>Belum ada tanggal libur yang diatur.</p>}
          {holidays.map((holiday) => (
            <div className="holiday-row" key={holiday.id}>
              <CalendarDays size={17} />
              <div><strong>{formatDate(holiday.holiday_date)}</strong><span>{holiday.name || 'Libur absensi'}</span></div>
              <button type="button" className="icon-button" disabled={holidayBusy} onClick={() => void removeHoliday(holiday)} aria-label={`Hapus hari libur ${formatDate(holiday.holiday_date)}`} title="Hapus hari libur"><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
      </section>
      <section className="panel settings-panel">
        <div className="panel-heading"><div><h2>Jadwal absen sholat (WIB)</h2><p>Scan pada jendela waktu ini dicatat ke presensi sholat, bukan absensi harian. Data presensi sholat tersimpan terpisah dan dapat dilihat di menu Presensi Sholat. Waktu contoh tidak aktif sampai diaktifkan.</p></div></div>
        {prayerSchedules.length > 0 && (
          <form className="settings-form" onSubmit={(event) => void savePrayerSchedules(event)}>
            <div className="prayer-schedule-list">
              {prayerOrder.map((prayerKey) => {
                const prayer = prayerSchedules.find((item) => item.prayer_key === prayerKey);
                if (!prayer) return null;
                return (
                  <div className="prayer-schedule-row" key={prayer.prayer_key}>
                    <label className="prayer-active-toggle">
                      <input type="checkbox" checked={prayer.is_active} onChange={(event) => updatePrayerSchedule(prayer.prayer_key, { is_active: event.target.checked })} />
                      <b>{prayer.name}</b>
                    </label>
                    <label>Absen dibuka<input type="time" value={prayer.opens_at.slice(0, 5)} required onChange={(event) => updatePrayerSchedule(prayer.prayer_key, { opens_at: event.target.value })} /></label>
                    <label>Absen ditutup<input type="time" value={prayer.closes_at.slice(0, 5)} required onChange={(event) => updatePrayerSchedule(prayer.prayer_key, { closes_at: event.target.value })} /></label>
                  </div>
                );
              })}
            </div>
            {prayerScheduleError && <div className="form-message"><AlertCircle size={15} />{prayerScheduleError}</div>}
            <button className="primary-button" disabled={prayerBusy}><Save size={16} />Simpan jadwal sholat</button>
          </form>
        )}
        {prayerSchedules.length === 0 && !prayerScheduleError && <p>Memuat jadwal sholat...</p>}
        {prayerSchedules.length === 0 && prayerScheduleError && <div className="form-message"><AlertCircle size={15} />{prayerScheduleError}</div>}
      </section>
    </>
  );
}
