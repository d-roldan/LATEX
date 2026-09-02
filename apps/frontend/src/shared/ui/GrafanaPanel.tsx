import { useState } from 'react';
import { Button } from './Button';

interface GrafanaPanelProps {
  url: string;
  title?: string;
  onClose?: () => void;
}

export function GrafanaPanel({ url, title, onClose }: GrafanaPanelProps) {
  const [isLoading, setIsLoading] = useState(true);

  // Intentamos limpiar la URL un poco si es necesario o agregar parámetros de Grafana
  // Por ejemplo, &kiosk=1 o &embed=true si no están presentes
  const embedUrl = url.includes('?') 
    ? `${url}&kiosk=true` 
    : `${url}?kiosk=true`;

  return (
    <div className="panel animate-in" style={{ height: '600px', display: 'flex', flexDirection: 'column', gap: '1rem', border: '1px solid var(--primary-soft)', background: 'var(--panel-elevated)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '1.2rem' }}>📊</span>
          <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{title || 'Análisis de Datos IoT'}</h3>
        </div>
        {onClose && <Button variant="ghost" size="sm" onClick={onClose}>Cerrar Panel</Button>}
      </div>
      
      <div style={{ flex: 1, position: 'relative', borderRadius: '0.5rem', overflow: 'hidden', background: 'var(--background)' }}>
        {isLoading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--panel)', zIndex: 5 }}>
            <div className="spinner"></div>
            <p style={{ marginLeft: '1rem', color: 'var(--ink-soft)' }}>Conectando con Grafana...</p>
          </div>
        )}
        <iframe
          src={embedUrl}
          width="100%"
          height="100%"
          frameBorder="0"
          onLoad={() => setIsLoading(false)}
          title={title || 'Grafana Dashboard'}
          style={{ border: 'none' }}
        />
      </div>
      
      <div style={{ fontSize: '0.75rem', color: 'var(--ink-soft)', textAlign: 'right' }}>
        Los datos son procesados en tiempo real desde el nodo de borde.
      </div>
    </div>
  );
}
