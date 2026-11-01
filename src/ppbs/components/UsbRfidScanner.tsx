import { useEffect, useRef } from 'react';

type UsbRfidScannerProps = {
  onScan: (uid: string) => void;
};

const MAX_KEY_INTERVAL_MS = 100;
const SCAN_IDLE_MS = 180;
const MIN_UID_LENGTH = 4;
const MAX_UID_LENGTH = 64;

export function UsbRfidScanner({ onScan }: UsbRfidScannerProps) {
  const onScanRef = useRef(onScan);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    let buffer = '';
    let lastKeyAt = 0;
    let idleTimer = 0;
    let lastScan = '';
    let lastScanAt = 0;

    function submitScan() {
      const uid = buffer.replace(/[^a-f\d]/gi, '').toUpperCase();
      buffer = '';
      if (uid.length < MIN_UID_LENGTH || uid.length > MAX_UID_LENGTH) return;

      const now = Date.now();
      if (uid === lastScan && now - lastScanAt < 1500) return;
      lastScan = uid;
      lastScanAt = now;
      onScanRef.current(uid);
    }

    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target;
      if (target instanceof HTMLElement && target.closest('input, textarea, select, [contenteditable="true"]')) {
        buffer = '';
        window.clearTimeout(idleTimer);
        return;
      }

      if (event.key === 'Enter' || event.key === 'Tab') {
        if (buffer.length >= MIN_UID_LENGTH) {
          event.preventDefault();
          window.clearTimeout(idleTimer);
          submitScan();
        }
        return;
      }

      if (event.key.length !== 1 || !/^[a-f\d:\-\s]$/i.test(event.key)) {
        if (event.key !== 'Shift' && event.key !== 'Control' && event.key !== 'Alt') {
          buffer = '';
          window.clearTimeout(idleTimer);
        }
        return;
      }

      const now = Date.now();
      if (lastKeyAt && now - lastKeyAt > MAX_KEY_INTERVAL_MS) buffer = '';
      lastKeyAt = now;
      buffer += event.key;
      event.preventDefault();
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(submitScan, SCAN_IDLE_MS);
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.clearTimeout(idleTimer);
    };
  }, []);

  return null;
}
