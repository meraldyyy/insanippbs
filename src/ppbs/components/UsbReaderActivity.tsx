import { useEffect, useState } from 'react';
import { AlertCircle, CreditCard, Keyboard } from 'lucide-react';
import { api } from '../../lib/api';
import { parseTimestamp } from '../lib/format';

type LatestScan = {
  scanned_at: string;
  result: string;
};

type UsbReaderActivityProps = {
  scanRevision?: number;
  compact?: boolean;
};

const RECENT_ACTIVITY_MS = 5 * 60 * 1000;

function relativeTime(value: string, now: number) {
  const date = parseTimestamp(value);
  const elapsedMinutes = Math.max(0, Math.floor((now - date.getTime()) / 60_000));
  if (elapsedMinutes < 1) return 'baru saja';
  if (elapsedMinutes < 60) return `${elapsedMinutes} menit yang lalu`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours} jam yang lalu`;
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Jakarta',
  }).format(date);
}

export function UsbReaderActivity({ scanRevision = 0, compact = false }: UsbReaderActivityProps) {
  const [latestScan, setLatestScan] = useState<LatestScan | null>(null);
  const [error, setError] = useState('');
  const [now, setNow] = useState(0);

  useEffect(() => {
    let mounted = true;

    async function refresh() {
      const { data, error: queryError } = await api
        .from<LatestScan>('scan_logs')
        .select('scanned_at, result')
        .order('scanned_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!mounted) return;
      if (queryError) {
        setError(queryError.message);
        return;
      }
      setError('');
      setLatestScan(data);
      setNow(Date.now());
    }

    void refresh();
    const interval = window.setInterval(() => void refresh(), 30_000);
    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, [scanRevision]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(interval);
  }, []);

  const activeRecently = latestScan !== null && now - parseTimestamp(latestScan.scanned_at).getTime() < RECENT_ACTIVITY_MS;
  const status = latestScan
    ? activeRecently ? 'Ada scan dalam 5 menit terakhir' : 'Belum ada scan terbaru'
    : 'Belum pernah ada scan';

  return (
    <section className={`panel ${compact ? 'mini-panel' : 'settings-panel'}`}>
      <div className="panel-heading">
        <div><h2>Reader USB otomatis</h2><p>Reader keyboard · tidak perlu konfigurasi</p></div>
        {compact ? <Keyboard size={19} /> : <CreditCard size={22} />}
      </div>
      <div className="usb-hid-status">
        <span className={`status-dot ${activeRecently ? 'connected' : ''}`} />
        <b>{error ? 'Status reader tidak dapat dimuat' : status}</b>
      </div>
      {latestScan && !error && (
        <div className="usb-reader-last-scan">
          Reader USB keyboard · Scan terakhir: {relativeTime(latestScan.scanned_at, now)} · {latestScan.result.replace(/_/g, ' ')}
        </div>
      )}
      {error && <div className="form-message"><AlertCircle size={15} />{error}</div>}
      <p className="form-hint">Status ini berdasarkan waktu scan terakhir, bukan deteksi kabel USB. Reader yang idle dan reader yang rusak/dicabut tidak dapat dibedakan oleh mode keyboard.</p>
    </section>
  );
}
