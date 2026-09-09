import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../shared/api/http';
import { Alert } from '../../shared/ui/Alert';
import { Badge } from '../../shared/ui/Badge';
import { Button } from '../../shared/ui/Button';
import { Input } from '../../shared/ui/Input';
import { setSession } from './session';
import { SessionData } from './types';
import axios from 'axios';

export function LoginPage() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const requestedFullscreen = !document.fullscreenElement && Boolean(document.documentElement.requestFullscreen);

    if (requestedFullscreen) {
      await document.documentElement.requestFullscreen().catch(() => undefined);
    }

    try {
      const response = await api.post<SessionData>('/auth/login', { identifier, password });
      setSession(response.data);
      const home: Record<string, string> = {
        FABRICACION: '/fabricacion', LABORATORIO: '/laboratorio', ENVASADO: '/envasado',
        MONITOREO: '/historial', JEFATURA: '/jefatura', ADMIN: '/admin'
      };
      navigate(home[response.data.user.role] ?? '/tv');
    } catch (requestError) {
      if (requestedFullscreen && document.fullscreenElement) {
        await document.exitFullscreen().catch(() => undefined);
      }
      if (
        axios.isAxiosError(requestError)
        && (requestError.response?.status === 503 || !window.navigator.onLine)
      ) {
        const message = requestError.response?.data?.message;
        setError(typeof message === 'string'
          ? message
          : 'Sin conexión con el servidor de planta. Revisá la red local e intentá nuevamente.');
      } else if (axios.isAxiosError(requestError) && requestError.response?.status === 429) {
        const message = requestError.response.data?.message;
        setError(typeof message === 'string'
          ? message
          : 'Demasiados intentos seguidos. Esperá un momento antes de volver a intentar.');
      } else {
        setError('Credenciales inválidas. Verificá el correo, nombre y contraseña.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page page-enter">
      <div className="login-page__background" />
      <div className="login-page__scrim" />

      <div className="login-shell">
        <div className="login-brand">
          <div className="login-brand__plate">
            <img className="latex-login-logo" src="/brand/grupo-disal-logo.png" alt="Grupo DISAL" />
          </div>
          <p className="login-brand__copy">
            Control de fabricación, calidad, envasado y trazabilidad de la planta de látex.
          </p>
          <div className="login-brand__badges">
            <Badge variant="success">Planta conectada</Badge>
            <Badge variant="primary">Planta de Látex</Badge>
            <span className="dash-period-badge">Sistema operativo</span>
          </div>
        </div>

        <form onSubmit={onSubmit} className="login-form">
          <div>
            <h2>Ingreso seguro</h2>
            <p>Ingresá con tu cuenta corporativa.</p>
          </div>

          <label>
            <span>Correo o nombre</span>
            <Input id="login-identifier" type="text" value={identifier} onChange={(event) => setIdentifier(event.target.value)}
              placeholder="Nombre Apellido o correo@empresa.com" autoComplete="username" required />
          </label>

          <label>
            <span>Contraseña de acceso</span>
            <Input id="login-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••••••" autoComplete="current-password" required />
          </label>

          {error ? <Alert variant="danger">{error}</Alert> : null}

          <Button id="login-submit" type="submit" disabled={loading} size="lg" className="login-form__submit">
            {loading ? 'Autenticando…' : 'Iniciar sesión'}
          </Button>

          <p className="login-form__legal">
            <span>Sistema exclusivo para personal autorizado de la planta.</span>
            <span>© {new Date().getFullYear()} DISAL. Todos los derechos reservados.</span>
          </p>
        </form>
      </div>
    </div>
  );
}
