import { useEffect, useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { PlantBoardPage } from './PlantBoardPage';
import { ThemeToggle } from '../../shared/components/ThemeToggle';
import { findPublicPlant, publicPlants } from './plantCatalog';

const sectors = ['fabricacion', 'laboratorio', 'envasado'] as const;
const sectorLabels = {
  fabricacion: 'Fabricación',
  laboratorio: 'Laboratorio',
  envasado: 'Envasado'
};

export function PlantTvPage() {
  const [searchParams] = useSearchParams();
  const [isFullscreen, setIsFullscreen] = useState(Boolean(document.fullscreenElement));
  const requestedCode = searchParams.get('plant');
  const selectedPlant = findPublicPlant(requestedCode);
  const requestedSector = searchParams.get('sector');
  const selectedSector = sectors.find((sector) => sector === requestedSector);

  useEffect(() => {
    const updateFullscreenState = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', updateFullscreenState);
    return () => document.removeEventListener('fullscreenchange', updateFullscreenState);
  }, []);

  useEffect(() => {
    if (!selectedPlant || !selectedSector) return;
    const previousTitle = document.title;
    document.title = `${sectorLabels[selectedSector]} · ${selectedPlant.name} · TV`;
    return () => {
      document.title = previousTitle;
    };
  }, [selectedPlant, selectedSector]);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      // Algunos televisores bloquean la API; la pantalla sigue operativa sin ella.
    }
  };

  if (!selectedPlant || !selectedSector) {
    return (
      <main className="plant-main plant-tv plant-tv-setup">
        <ThemeToggle className="plant-theme-toggle plant-tv-setup__theme" />
        <section className="plant-tv-setup__panel" aria-labelledby="tv-setup-title">
          <p className="plant-tv-setup__eyebrow">Pantalla de monitoreo</p>
          <h1 id="tv-setup-title">
            {!selectedPlant
              ? requestedCode
                ? 'La planta indicada no existe'
                : 'Elegí la planta de esta pantalla'
              : 'Elegí el sector de esta pantalla'}
          </h1>
          <p>Cada televisor conserva una planta y un sector explícitos en su dirección.</p>
          <nav className="plant-tv-setup__options" aria-label="Plantas disponibles">
            {selectedPlant
              ? sectors.map((sector) => (
                  <Link key={sector} to={`/tv?plant=${selectedPlant.code}&sector=${sector}`}>
                    <strong>{sectorLabels[sector]}</strong>
                    <span>{selectedPlant.code}</span>
                  </Link>
                ))
              : publicPlants.map((plant) => (
                  <Link key={plant.code} to={`/tv?plant=${plant.code}`}>
                    <strong>{plant.name}</strong>
                    <span>{plant.code}</span>
                  </Link>
                ))}
          </nav>
        </section>
      </main>
    );
  }

  return (
    <main className="plant-main plant-tv">
      <div className="plant-tv__controls">
        <button
          className="plant-fullscreen plant-tv__fullscreen"
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? 'Salir de pantalla completa' : 'Ver en pantalla completa'}
          title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
        >
          {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
          <span>{isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}</span>
        </button>
        <ThemeToggle className="plant-theme-toggle plant-tv__theme-toggle" />
      </div>
      <PlantBoardPage sector="monitoreo" publicPlant={selectedPlant} tvSector={selectedSector} />
    </main>
  );
}
