import { useEffect, useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { PlantBoardPage } from './PlantBoardPage';

export function PlantTvPage() {
  const [isFullscreen, setIsFullscreen] = useState(Boolean(document.fullscreenElement));

  useEffect(() => {
    const updateFullscreenState = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', updateFullscreenState);
    return () => document.removeEventListener('fullscreenchange', updateFullscreenState);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      // Algunos televisores bloquean la API; la pantalla sigue operativa sin ella.
    }
  };

  return (
    <main className="plant-main plant-tv">
      <button
        className="plant-fullscreen plant-tv__fullscreen"
        onClick={toggleFullscreen}
        aria-label={isFullscreen ? 'Salir de pantalla completa' : 'Ver en pantalla completa'}
        title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
      >
        {isFullscreen ? <Minimize2 size={20}/> : <Maximize2 size={20}/>}
        <span>{isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}</span>
      </button>
      <PlantBoardPage sector="monitoreo" />
    </main>
  );
}
