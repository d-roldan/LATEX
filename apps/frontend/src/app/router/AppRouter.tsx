import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ProtectedRoute } from '../../features/auth/ProtectedRoute';
import { AppLayout } from '../../shared/layouts/AppLayout';

const LoginPage = lazy(() =>
  import('../../features/auth/LoginPage').then((module) => ({ default: module.LoginPage }))
);
const PlantBoardPage = lazy(() =>
  import('../../features/plant/PlantBoardPage').then((module) => ({
    default: module.PlantBoardPage
  }))
);
const PlantHistoryPage = lazy(() =>
  import('../../features/plant/PlantHistoryPage').then((module) => ({
    default: module.PlantHistoryPage
  }))
);
const PlantManagementPage = lazy(() =>
  import('../../features/plant/PlantManagementPage').then((module) => ({
    default: module.PlantManagementPage
  }))
);
const PlantTvPage = lazy(() =>
  import('../../features/plant/PlantTvPage').then((module) => ({
    default: module.PlantTvPage
  }))
);
const UsersPage = lazy(() =>
  import('../../features/users/UsersPage').then((module) => ({ default: module.UsersPage }))
);

const page = (sector: 'fabricacion' | 'laboratorio' | 'envasado' | 'monitoreo') => (
  <AppLayout>
    <PlantBoardPage sector={sector} />
  </AppLayout>
);

function RouteLoading() {
  return (
    <main className="route-loading" role="status" aria-live="polite">
      <span className="route-loading__indicator" aria-hidden="true" />
      <strong>Cargando pantalla…</strong>
    </main>
  );
}

function TvRedirect() {
  const location = useLocation();
  return <Navigate to={{ pathname: '/tv', search: location.search }} replace />;
}

export function AppRouter() {
  return (
    <Suspense fallback={<RouteLoading />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/tv" element={<PlantTvPage />} />
        <Route path="/monitoreo" element={<TvRedirect />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<ProtectedRoute allowedRoles={['FABRICACION', 'ADMIN']} />}>
            <Route path="/fabricacion" element={page('fabricacion')} />
          </Route>
          <Route element={<ProtectedRoute allowedRoles={['LABORATORIO', 'ADMIN']} />}>
            <Route path="/laboratorio" element={page('laboratorio')} />
          </Route>
          <Route element={<ProtectedRoute allowedRoles={['ENVASADO', 'ADMIN']} />}>
            <Route path="/envasado" element={page('envasado')} />
          </Route>
          <Route element={<ProtectedRoute allowedRoles={['MONITOREO', 'JEFATURA', 'ADMIN']} />}>
            <Route
              path="/historial"
              element={
                <AppLayout>
                  <PlantHistoryPage />
                </AppLayout>
              }
            />
          </Route>
          <Route element={<ProtectedRoute allowedRoles={['JEFATURA', 'ADMIN']} />}>
            <Route
              path="/jefatura"
              element={
                <AppLayout>
                  <PlantManagementPage />
                </AppLayout>
              }
            />
          </Route>
          <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
            <Route path="/admin" element={<Navigate to="/fabricacion" replace />} />
            <Route
              path="/usuarios"
              element={
                <AppLayout>
                  <UsersPage />
                </AppLayout>
              }
            />
          </Route>
        </Route>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
