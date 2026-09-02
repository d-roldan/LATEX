import { useEffect } from 'react';

const HIGHLIGHT_MS = 3200;
const POLL_INTERVAL_MS = 150;
const POLL_TIMEOUT_MS = 4000;

/**
 * Al llegar a una pantalla desde una notificación, hace scroll hasta el elemento
 * con ese id y le agrega un resplandor que titila unas veces para orientar la mirada.
 * Reintenta encontrar el elemento por un rato porque puede aparecer recién cuando
 * termina de cargar la data (listas que dependen de un fetch).
 *
 * `trigger` es un valor que cambia en cada navegación (por ejemplo location.key o un
 * nonce armado a mano). Sin él, clickear dos veces seguidas la misma notificación no
 * volvería a disparar el resaltado porque el id de destino sería idéntico al anterior.
 */
export function useHighlightTarget(id?: string | null, trigger?: unknown) {
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    let highlightTimeout: ReturnType<typeof setTimeout> | undefined;
    const startedAt = Date.now();

    const tryHighlight = () => {
      if (cancelled) return;
      const el = document.getElementById(id);
      if (!el) {
        if (Date.now() - startedAt < POLL_TIMEOUT_MS) {
          setTimeout(tryHighlight, POLL_INTERVAL_MS);
        }
        return;
      }
      el.classList.remove('notif-highlight');
      // Forzar reflow para poder re-disparar la animación si ya estaba aplicada.
      void el.offsetWidth;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('notif-highlight');
      highlightTimeout = setTimeout(() => el.classList.remove('notif-highlight'), HIGHLIGHT_MS);
    };

    tryHighlight();

    return () => {
      cancelled = true;
      if (highlightTimeout) clearTimeout(highlightTimeout);
      document.getElementById(id)?.classList.remove('notif-highlight');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, trigger]);
}
