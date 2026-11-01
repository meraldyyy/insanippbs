import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Clock3, Maximize2, Minimize2, Radio } from 'lucide-react';
import { StudentPhoto } from './StudentPhoto';
import { UsbRfidScanner } from './UsbRfidScanner';
import { attendanceStatusLabel, localDateKey, parseTimestamp } from '../lib/format';
import { api } from '../../lib/api';
import { attendanceMonitorChannelName, type AttendanceMonitorEvent } from '../lib/attendanceMonitor';

function isAttendanceMonitorEvent(value: unknown): value is AttendanceMonitorEvent {
  if (typeof value !== 'object' || value === null) return false;
  const event = value as Partial<AttendanceMonitorEvent>;
  return typeof event.id === 'string'
    && typeof event.result === 'string'
    && typeof event.message === 'string'
    && (event.fullName === null || typeof event.fullName === 'string')
    && (event.className === null || typeof event.className === 'string')
    && (event.photoPath === null || typeof event.photoPath === 'string')
    && (event.status === null || typeof event.status === 'string')
    && typeof event.time === 'string';
}

export function AttendanceMonitorPage() {
  const [now, setNow] = useState(() => new Date());
  const [attendanceEvent, setAttendanceEvent] = useState<AttendanceMonitorEvent | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState('');
  const [scanError, setScanError] = useState('');
  const channelRef = useRef<BroadcastChannel | null>(null);
  const scanInProgress = useRef(false);
  const clearEventTimer = useRef<number | null>(null);

  const showAttendanceEvent = useCallback((event: AttendanceMonitorEvent) => {
    setAttendanceEvent(event);
    if (clearEventTimer.current !== null) window.clearTimeout(clearEventTimer.current);
    clearEventTimer.current = window.setTimeout(() => {
      setAttendanceEvent(null);
      clearEventTimer.current = null;
    }, 8000);
  }, []);

  useEffect(() => {
    const clock = window.setInterval(() => setNow(new Date()), 1000);
    const channel = new BroadcastChannel(attendanceMonitorChannelName);
    channelRef.current = channel;
    const syncFullscreen = () => setFullscreen(Boolean(document.fullscreenElement));
    channel.onmessage = (message: MessageEvent<unknown>) => {
      if (!isAttendanceMonitorEvent(message.data)) return;
      showAttendanceEvent(message.data);
    };
    document.addEventListener('fullscreenchange', syncFullscreen);
    return () => {
      window.clearInterval(clock);
      if (clearEventTimer.current !== null) window.clearTimeout(clearEventTimer.current);
      channelRef.current = null;
      document.removeEventListener('fullscreenchange', syncFullscreen);
      channel.close();
    };
  }, [showAttendanceEvent]);

  const handleRfidScan = useCallback(async (uid: string) => {
    if (scanInProgress.current) return;
    scanInProgress.current = true;
    setScanError('');
    try {
      const { data, error } = await api.rpc('process_rfid_scan', { p_card_uid: uid });
      if (error) throw error;
      const result = Array.isArray(data) ? data[0] : data;
      if (!result) throw new Error('Server tidak mengembalikan hasil scan.');
      if (typeof result.scan_result === 'string' && result.scan_result.startsWith('prayer_')) {
        const event: AttendanceMonitorEvent = {
          id: crypto.randomUUID(),
          result: result.scan_result,
          message: result.display_message,
          fullName: result.student_name ?? null,
          className: result.class_name ?? null,
          photoPath: null,
          status: null,
          time: new Intl.DateTimeFormat('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
            timeZone: 'Asia/Jakarta',
          }).format(new Date()),
        };
        showAttendanceEvent(event);
        channelRef.current?.postMessage(event);
        return;
      }

      const normalizedUid = uid.toUpperCase().replace(/[^A-F0-9]/g, '');
      let fullName: string | null = result.student_name ?? null;
      let className: string | null = result.class_name ?? null;
      let photoPath: string | null = null;
      let status: string | null = result.attendance_status ?? null;
      let attendanceTime = new Date().toISOString();
      let detailError = '';
      try {
        const { data: cards, error: cardsError } = await api
          .from<{ student_id: string; uid: string }>('cards')
          .select('student_id, uid')
          .eq('uid', uid);
        if (cardsError) throw cardsError;
        let card = (cards ?? []).find((item) => item.uid.toUpperCase().replace(/[^A-F0-9]/g, '') === normalizedUid);
        if (!card) {
          const { data: allCards, error: allCardsError } = await api.from<{ student_id: string; uid: string }>('cards').select('student_id, uid');
          if (allCardsError) throw allCardsError;
          card = (allCards ?? []).find((item) => item.uid.toUpperCase().replace(/[^A-F0-9]/g, '') === normalizedUid);
        }
        if (card) {
          const { data: student, error: studentError } = await api
            .from<{ full_name: string; class_name: string; photo_url: string | null }>('students')
            .select('full_name, class_name, photo_url')
            .eq('id', card.student_id)
            .maybeSingle();
          if (studentError) throw studentError;
          if (student) {
            fullName = student.full_name;
            className = student.class_name;
            photoPath = student.photo_url;
          }
          const { data: attendance, error: attendanceError } = await api
            .from<{ check_in_at: string | null; check_out_at: string | null; status: string }>('attendance')
            .select('check_in_at, check_out_at, status')
            .eq('student_id', card.student_id)
            .eq('attendance_date', localDateKey())
            .maybeSingle();
          if (attendanceError) throw attendanceError;
          if (attendance) {
            status = attendance.status;
            attendanceTime = result.scan_result === 'check_out'
              ? attendance.check_out_at ?? attendance.check_in_at ?? attendanceTime
              : attendance.check_in_at ?? attendanceTime;
          }
        }
      } catch (error) {
        detailError = error instanceof Error ? error.message : 'Data foto dan waktu absensi tidak berhasil dimuat.';
      }

      const event: AttendanceMonitorEvent = {
        id: crypto.randomUUID(),
        result: result.scan_result,
        message: result.display_message,
        fullName,
        className,
        photoPath,
        status,
        time: new Intl.DateTimeFormat('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
          timeZone: 'Asia/Jakarta',
        }).format(parseTimestamp(attendanceTime)),
      };
      showAttendanceEvent(event);
      channelRef.current?.postMessage(event);
      if (detailError) setScanError(`Presensi berhasil dicatat. Data foto atau waktu detail gagal dimuat: ${detailError}`);
    } catch (error) {
      setScanError(error instanceof Error ? error.message : 'Scan kartu gagal diproses.');
    } finally {
      scanInProgress.current = false;
    }
  }, [showAttendanceEvent]);

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
      setFullscreenError('');
    } catch (error) {
      setFullscreenError(error instanceof Error ? error.message : 'Mode layar penuh tidak dapat diaktifkan.');
    }
  }

  const day = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  }).format(now);
  const clock = new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'Asia/Jakarta',
  }).format(now);
  const resultMessage = attendanceEvent?.result === 'check_out'
    ? 'Presensi pulang tercatat'
    : attendanceEvent?.result === 'check_in'
      ? 'Presensi hadir tercatat'
      : attendanceEvent?.result === 'duplicate'
        ? 'Presensi sudah tercatat'
        : attendanceEvent?.message ?? '';

  return (
    <main className="attendance-monitor">
      <UsbRfidScanner onScan={handleRfidScan} />
      <section className="monitor-brand-panel">
        <img className="monitor-logo" src="/logoppbs.jpeg" alt="Logo Pondok Pesantren Baitussalam" />
        <p className="monitor-eyebrow">SISTEM PRESENSI</p>
        <h1>INSANI-PPBS</h1>
        <p className="monitor-brand-caption">Pondok Pesantren Baitussalam</p>
        <div className="monitor-live"><i /> MONITOR PRESENSI AKTIF</div>
      </section>

      <section className="monitor-content">
        <header className="monitor-clock">
          <div><p>{day}</p><strong><Clock3 size={24} aria-hidden="true" />{clock}</strong></div>
          <button className="monitor-fullscreen-button" type="button" onClick={() => void toggleFullscreen()} aria-label={fullscreen ? 'Keluar dari layar penuh' : 'Tampilkan layar penuh'}>
            {fullscreen ? <Minimize2 size={19} /> : <Maximize2 size={19} />}
          </button>
        </header>
        {fullscreenError && <p className="monitor-fullscreen-error" role="status">{fullscreenError}</p>}
        {scanError && <p className="monitor-scan-error" role="alert">{scanError}</p>}
        <div className={`monitor-confirmation${attendanceEvent ? ' has-attendance' : ''}`} aria-live="polite" aria-atomic="true">
          {attendanceEvent ? (
            <>
              <p className={`monitor-result-label ${attendanceEvent.result}`}>
                {attendanceEvent.result === 'check_in' || attendanceEvent.result === 'check_out'
                  ? <Check size={17} aria-hidden="true" />
                  : <Radio size={17} aria-hidden="true" />}
                {resultMessage}
              </p>
              {attendanceEvent.fullName ? (
                <div className="monitor-student">
                  <StudentPhoto
                    studentId={attendanceEvent.id}
                    fullName={attendanceEvent.fullName}
                    photoPath={attendanceEvent.photoPath}
                    large
                  />
                  <div className="monitor-student-info">
                    <h2>{attendanceEvent.fullName}</h2>
                    <p>{attendanceEvent.className || 'Kelas belum ditentukan'}</p>
                    {attendanceEvent.status && <span className={`monitor-status ${attendanceEvent.status}`}>{attendanceStatusLabel(attendanceEvent.status)}</span>}
                  </div>
                </div>
              ) : (
                <div className="monitor-message">{attendanceEvent.message}</div>
              )}
              <p className="monitor-attendance-time">
                <span>{attendanceEvent.result === 'check_out' ? 'Jam pulang' : 'Jam hadir'}</span>
                <strong>{attendanceEvent.time}</strong>
              </p>
            </>
          ) : (
            <div className="monitor-ready">
              <span className="monitor-ready-icon"><Radio size={32} aria-hidden="true" /></span>
              <h2>Siap menerima presensi</h2>
              <p>Silakan tempelkan kartu santri pada reader.</p>
            </div>
          )}
        </div>
        <footer className="monitor-footer">Presensi santri • Pondok Pesantren Baitussalam</footer>
      </section>
    </main>
  );
}
