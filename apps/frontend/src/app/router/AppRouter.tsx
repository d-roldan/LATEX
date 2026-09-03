import { Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from '../../features/auth/LoginPage';
import { ProtectedRoute } from '../../features/auth/ProtectedRoute';
import { PlantBoardPage } from '../../features/plant/PlantBoardPage';
import { PlantHistoryPage } from '../../features/plant/PlantHistoryPage';
import { PlantManagementPage } from '../../features/plant/PlantManagementPage';
import { PlantTvPage } from '../../features/plant/PlantTvPage';
import { UsersPage } from '../../features/users/UsersPage';
import { AppLayout } from '../../shared/layouts/AppLayout';

const page = (sector: 'fabricacion' | 'laboratorio' | 'envasado' | 'monitoreo') => (
  <AppLayout><PlantBoardPage sector={sector} /></AppLayout>
);

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/tv" element={<PlantTvPage />} />
      <Route path="/monitoreo" element={<Navigate to="/tv" replace />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<ProtectedRoute allowedRoles={['FABRICACION', 'ADMIN']} />}><Route path="/fabricacion" element={page('fabricacion')} /></Route>
        <Route element={<ProtectedRoute allowedRoles={['LABORATORIO', 'ADMIN']} />}><Route path="/laboratorio" element={page('laboratorio')} /></Route>
        <Route element={<ProtectedRoute allowedRoles={['ENVASADO', 'ADMIN']} />}><Route path="/envasado" element={page('envasado')} /></Route>
        <Route element={<ProtectedRoute allowedRoles={['MONITOREO', 'JEFATURA', 'ADMIN']} />}>
          <Route path="/historial" element={<AppLayout><PlantHistoryPage /></AppLayout>} />
        </Route>
        <Route element={<ProtectedRoute allowedRoles={['JEFATURA', 'ADMIN']} />}>
          <Route path="/jefatura" element={<AppLayout><PlantManagementPage /></AppLayout>} />
        </Route>
        <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
          <Route path="/admin" element={<Navigate to="/fabricacion" replace />} />
          <Route path="/usuarios" element={<AppLayout><UsersPage /></AppLayout>} />
        </Route>
      </Route>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
