const UPDATE_INTERVAL_MS = 60 * 60 * 1000;

export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator) || !window.isSecureContext) {
    return;
  }

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none'
      });

      await registration.update();
      window.setInterval(() => void registration.update(), UPDATE_INTERVAL_MS);
    } catch (error) {
      console.warn('No se pudo registrar el modo instalable de DISAL', error);
    }
  });
}
