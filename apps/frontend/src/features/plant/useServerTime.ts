import { useEffect, useRef, useState } from 'react';
import { api } from '../../shared/api/http';

const SYNC_INTERVAL_MS = 30_000;
const MAX_SYNC_AGE_MS = 120_000;

export function useServerTime(enabled: boolean) {
  const anchor = useRef<{ serverMs: number; monotonicMs: number } | null>(null);
  const [nowMs, setNowMs] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const sync = async () => {
      const start = performance.now();
      try {
        const response = await api.get<{ now: string }>('/health/time', {
          headers: { 'Cache-Control': 'no-cache' }
        });
        const end = performance.now();
        const serverMs = Date.parse(response.data.now);
        if (!active || !Number.isFinite(serverMs)) return;
        anchor.current = { serverMs: serverMs + (end - start) / 2, monotonicMs: end };
        setNowMs(anchor.current.serverMs);
      } catch {
        // Se conserva la última referencia mientras todavía sea reciente.
      }
    };
    const tick = () => {
      const reference = anchor.current;
      const elapsed = reference ? performance.now() - reference.monotonicMs : 0;
      setNowMs(reference && elapsed <= MAX_SYNC_AGE_MS ? reference.serverMs + elapsed : null);
    };
    void sync();
    const syncId = window.setInterval(() => void sync(), SYNC_INTERVAL_MS);
    const tickId = window.setInterval(tick, 1000);
    return () => {
      active = false;
      anchor.current = null;
      window.clearInterval(syncId);
      window.clearInterval(tickId);
    };
  }, [enabled]);

  return nowMs;
}
