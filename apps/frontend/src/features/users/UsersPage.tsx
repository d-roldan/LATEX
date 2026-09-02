import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../shared/api/http';
import { Badge } from '../../shared/ui/Badge';
import { Button } from '../../shared/ui/Button';
import { Dialog } from '../../shared/ui/Dialog';
import { Input } from '../../shared/ui/Input';

interface UserItem {
  id: string;
  fullName: string;
  email: string;
  username: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

const ROLES = [
  { value: 'FABRICACION', label: 'Fabricación' },
  { value: 'LABORATORIO', label: 'Laboratorio' },
  { value: 'ENVASADO', label: 'Envasado' },
  { value: 'MONITOREO', label: 'Monitoreo' },
  { value: 'ADMIN', label: 'Administrador' }
];

const ROLE_LABELS: Record<string, string> = {
  FABRICACION: 'Fabricación',
  LABORATORIO: 'Laboratorio',
  ENVASADO: 'Envasado',
  MONITOREO: 'Monitoreo',
  ADMIN: 'Admin'
};

const ROLE_COLORS: Record<string, 'default' | 'primary' | 'warning' | 'success'> = {
  FABRICACION: 'primary',
  LABORATORIO: 'warning',
  ENVASADO: 'success',
  MONITOREO: 'default',
  ADMIN: 'success'
};

const emptyForm = {
  fullName: '',
  email: '',
  username: '',
  role: 'FABRICACION',
  password: ''
};

export function UsersPage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [filterRole, setFilterRole] = useState('');
  const [confirmToggle, setConfirmToggle] = useState<UserItem | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<UserItem | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [modalInfo, setModalInfo] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: ['users', filterRole],
    queryFn: async () => {
      const response = await api.get<UserItem[]>('/users', {
        params: { role: filterRole || undefined }
      });
      return response.data;
    }
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post('/users', {
        fullName: form.fullName,
        email: form.email,
        username: form.username,
        role: form.role,
        password: form.password
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      closeModal();
    },
    onError: (error: { response?: { data?: { message?: string } } }) => {
      setFormError(error.response?.data?.message ?? 'No se pudo crear el usuario.');
    }
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => {
      await api.patch(`/users/${id}/role`, { role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setActionError(null);
    },
    onError: (error: { response?: { data?: { message?: string } } }) => {
      setActionError(error.response?.data?.message ?? 'No se pudo cambiar el rol.');
    }
  });

  const updateProfileMutation = useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      await api.patch(`/users/${id}/profile`, {
        fullName: form.fullName,
        email: form.email,
        username: form.username
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      closeModal();
    },
    onError: (error: { response?: { data?: { message?: string } } }) => {
      setFormError(error.response?.data?.message ?? 'No se pudo actualizar el usuario.');
    }
  });

  const toggleMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.patch('/users/toggle-active', { id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setConfirmToggle(null);
      setActionError(null);
    },
    onError: (error: { response?: { data?: { message?: string } } }) => {
      setActionError(error.response?.data?.message ?? 'No se pudo cambiar el estado del usuario.');
    }
  });

  const updatePasswordMutation = useMutation({
    mutationFn: async ({ id, password }: { id: string; password: string }) => {
      await api.patch(`/users/${id}/password`, { password });
    },
    onSuccess: () => {
      setNewPassword('');
      setActionError(null);
    },
    onError: (error: { response?: { data?: { message?: string } } }) => {
      setActionError(error.response?.data?.message ?? 'No se pudo cambiar la contrasena.');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setConfirmDelete(null);
      setActionError(null);
    },
    onError: (error: { response?: { data?: { message?: string } } }) => {
      setActionError(error.response?.data?.message ?? 'No se pudo eliminar el usuario.');
    }
  });

  const editingUser = useMemo(
    () => listQuery.data?.find((u) => u.id === editingId) ?? null,
    [listQuery.data, editingId]
  );

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormError(null);
    setModalInfo(null);
    setActionError(null);
    setIsModalOpen(true);
  };

  const openEdit = (user: UserItem) => {
    setEditingId(user.id);
    setForm({ fullName: user.fullName, email: user.email, username: user.username, role: user.role, password: '' });
    setNewPassword('');
    setFormError(null);
    setActionError(null);
    setModalInfo(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (createMutation.isPending || updateProfileMutation.isPending) return;
    setIsModalOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    setFormError(null);
    setNewPassword('');
    setModalInfo(null);
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    setActionError(null);
    setModalInfo(null);
    if (editingId) {
      const changedFields: string[] = [];

      if (
        form.fullName !== editingUser?.fullName ||
        form.email !== editingUser?.email ||
        form.username !== editingUser?.username
      ) {
        changedFields.push('datos');
        updateProfileMutation.mutate({ id: editingId });
      }

      if (form.role !== editingUser?.role) {
        changedFields.push('puesto');
        updateRoleMutation.mutate({ id: editingId, role: form.role });
      }

      if (newPassword.trim()) {
        changedFields.push('contrasena');
        updatePasswordMutation.mutate({ id: editingId, password: newPassword });
      }

      if (changedFields.length === 0) {
        setModalInfo('No se detectaron cambios para guardar.');
      } else {
        setModalInfo(`Cambios guardados: ${changedFields.join(', ')}.`);
      }
    } else {
      createMutation.mutate();
    }
  };

  const isPending =
    createMutation.isPending ||
    updateProfileMutation.isPending ||
    updateRoleMutation.isPending ||
    updatePasswordMutation.isPending;

  return (
    <div className="stack-lg page-enter">

      {/* ── HERO ─────────────────────────────────────────── */}
      <header className="page-hero panel stagger-1">
        <div className="page-hero__left">
          <p className="eyebrow" style={{ color: 'var(--accent-cyan)' }}>👥 MÓDULO USUARIOS</p>
          <h2 className="page-hero__title">Gestión de Equipo</h2>
          <p className="page-hero__sub">Alta, baja y modificación de usuarios del sistema. Asignación de roles y accesos.</p>
        </div>
        <div className="page-hero__actions">
          <Badge variant="primary">Control de acceso</Badge>
          <Button type="button" onClick={openCreate}>
            + Nuevo Usuario
          </Button>
        </div>
      </header>

      {/* ── FILTROS ──────────────────────────────────────── */}
      <section className="stagger-2">
        <div className="control-bar">
          <div className="control-bar__filters">
            <select
              className="control-bar__select"
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
            >
              <option value="">Todos los roles</option>
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <div className="dash-period-badge">
            {listQuery.data?.length ?? 0} usuarios
          </div>
        </div>

        {/* ── TABLA ─────────────────────────────────────── */}
        {actionError ? <p className="error-text">Error: {actionError}</p> : null}
        <div className="premium-table-wrap">
          <table className="premium-table interactive" id="users-table">
            <thead>
              <tr>
                <th>Nombre completo</th>
                <th>Email</th>
                <th>Usuario</th>
                <th>Rol</th>
                <th>Estado</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {listQuery.isLoading ? (
                <tr><td colSpan={6} className="empty-state">Cargando usuarios...</td></tr>
              ) : listQuery.data?.length ? (
                listQuery.data.map((user) => (
                  <tr key={user.id} style={!user.isActive ? { opacity: 0.55 } : {}}>
                    <td className="strong-cell">
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{
                          width: '2rem', height: '2rem', borderRadius: '50%',
                          background: 'var(--primary)', display: 'flex', alignItems: 'center',
                          justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: 'white', flexShrink: 0
                        }}>
                          {user.fullName.charAt(0).toUpperCase()}
                        </span>
                        {user.fullName}
                      </span>
                    </td>
                    <td style={{ color: 'var(--ink-soft)', fontSize: '0.88rem' }}>{user.email}</td>
                    <td style={{ color: 'var(--ink-soft)', fontSize: '0.88rem', fontWeight: 700 }}>{user.username}</td>
                    <td>
                      <Badge variant={ROLE_COLORS[user.role] ?? 'default'}>
                        {ROLE_LABELS[user.role] ?? user.role}
                      </Badge>
                    </td>
                    <td>
                      <Badge variant={user.isActive ? 'success' : 'destructive'}>
                        {user.isActive ? '● Activo' : '○ Inactivo'}
                      </Badge>
                    </td>
                    <td className="row-actions" style={{ justifyContent: 'flex-end' }}>
                      <Button variant="secondary" size="sm" type="button" onClick={() => openEdit(user)}>
                        Editar
                      </Button>
                      <Button
                        variant={user.isActive ? 'destructive' : 'secondary'}
                        size="sm"
                        type="button"
                        onClick={() => setConfirmToggle(user)}
                      >
                        {user.isActive ? 'Suspender' : 'Activar'}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        type="button"
                        onClick={() => setConfirmDelete(user)}
                      >
                        Eliminar
                      </Button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6}>
                    <div className="empty-state">
                      <span className="empty-state__icon">👥</span>
                      <p>No se encontraron usuarios.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── MODAL CREAR/EDITAR ──────────────────────────── */}
      <Dialog
        open={isModalOpen}
        onOpenChange={(open) => { if (!open) closeModal(); else setIsModalOpen(true); }}
        disableClose={isPending}
        title={editingId ? 'Editar Usuario' : 'Nuevo Usuario'}
        description={editingId && editingUser ? `Modificando datos de: ${editingUser.fullName}` : 'Completá los datos para crear un nuevo acceso al sistema.'}
      >
        <form className="form-grid" onSubmit={onSubmit}>
          <div className="form-section">
            <h4 className="form-section__title">Datos del Usuario</h4>
            <div className="form-grid-2">
              <label>
                Nombre completo
                <Input
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  required
                  placeholder="Ej: Juan García"
                />
              </label>
              <label>
                Email de acceso
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                  placeholder="juan@disal-industria.com"
                />
              </label>
              <label>
                Nombre de usuario
                <Input
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase() })}
                  required
                  minLength={3}
                  maxLength={40}
                  pattern="[a-zA-Z0-9._-]+"
                  placeholder="juan.garcia"
                  autoComplete="username"
                />
              </label>
            </div>
          </div>

          <div className="form-section">
            <h4 className="form-section__title">Rol y Acceso</h4>
            <div className="form-grid-2">
              <label>
                Rol en el sistema
                <select
                  className="control-bar__select"
                  style={{ width: '100%', padding: '0.6rem' }}
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                >
                  {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </label>
              <label>
                {editingId ? 'Nueva contrasena' : 'Contrasena inicial'}
                <Input
                  type="password"
                  value={editingId ? newPassword : form.password}
                  onChange={(e) => editingId ? setNewPassword(e.target.value) : setForm({ ...form, password: e.target.value })}
                  required={!editingId}
                  minLength={6}
                  placeholder={editingId ? 'Dejar vacio para no cambiar' : 'Minimo 6 caracteres'}
                />
              </label>
            </div>
            {form.role && (
              <div style={{ marginTop: '0.8rem', padding: '0.7rem', background: 'color-mix(in srgb, var(--primary) 8%, transparent)', borderRadius: '0.5rem', fontSize: '0.82rem', color: 'var(--ink-soft)' }}>
                {form.role === 'OPERARIO' && '👷 El operario puede ver y gestionar solo sus OTs asignadas.'}
                {form.role === 'SUPERVISOR' && '🔭 El supervisor puede gestionar todas las OTs y asignar recursos, sin gestión de usuarios.'}
                {form.role === 'DUENO' && '🏭 El dueño tiene acceso completo: usuarios, reportes, auditoría y toda la gestión.'}
                {form.role === 'ADMIN' && '⚙️ El administrador técnico tiene acceso completo al sistema.'}
              </div>
            )}
          </div>

          {modalInfo && (
            <p style={{ color: 'var(--success)', fontWeight: 700, margin: 0 }}>
              {modalInfo}
            </p>
          )}
          {formError && <p className="error-text">Error: {formError}</p>}
          {actionError && <p className="error-text">Error: {actionError}</p>}

          <div style={{ display: 'flex', gap: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Guardando...' : editingId ? 'Guardar Cambios' : 'Crear Usuario'}
            </Button>
            <Button variant="secondary" type="button" onClick={closeModal} disabled={isPending}>
              Cancelar
            </Button>
          </div>
        </form>
      </Dialog>

      {/* ── MODAL CONFIRMAR TOGGLE ─────────────────────── */}
      <Dialog
        open={Boolean(confirmToggle)}
        onOpenChange={(open) => { if (!open) setConfirmToggle(null); }}
        disableClose={toggleMutation.isPending}
        title={confirmToggle?.isActive ? 'Suspender usuario' : 'Activar usuario'}
        description={confirmToggle?.isActive
          ? `¿Suspender a ${confirmToggle?.fullName}? No podrá ingresar al sistema.`
          : `¿Activar a ${confirmToggle?.fullName}? Podrá ingresar al sistema nuevamente.`}
      >
        <div style={{ display: 'flex', gap: '1rem', paddingTop: '0.5rem' }}>
          <Button
            type="button"
            variant={confirmToggle?.isActive ? 'destructive' : 'default'}
            disabled={toggleMutation.isPending}
            onClick={() => { if (confirmToggle) toggleMutation.mutate(confirmToggle.id); }}
          >
            {toggleMutation.isPending ? 'Procesando...' : confirmToggle?.isActive ? 'Sí, suspender' : 'Sí, activar'}
          </Button>
          <Button variant="secondary" type="button" onClick={() => setConfirmToggle(null)} disabled={toggleMutation.isPending}>
            Cancelar
          </Button>
        </div>
      </Dialog>

      <Dialog
        open={Boolean(confirmDelete)}
        onOpenChange={(open) => { if (!open) setConfirmDelete(null); }}
        disableClose={deleteMutation.isPending}
        title="Eliminar usuario"
        description={`Se dara de baja el acceso de ${confirmDelete?.fullName}. El historial queda conservado.`}
      >
        <div style={{ display: 'flex', gap: '1rem', paddingTop: '0.5rem' }}>
          <Button
            type="button"
            variant="destructive"
            disabled={deleteMutation.isPending}
            onClick={() => { if (confirmDelete) deleteMutation.mutate(confirmDelete.id); }}
          >
            {deleteMutation.isPending ? 'Eliminando...' : 'Si, eliminar'}
          </Button>
          <Button variant="secondary" type="button" onClick={() => setConfirmDelete(null)} disabled={deleteMutation.isPending}>
            Cancelar
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
