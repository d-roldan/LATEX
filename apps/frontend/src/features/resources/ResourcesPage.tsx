import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../shared/api/http';
import { getSessionUser } from '../auth/session';
import { Button } from '../../shared/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../../shared/ui/Card';
import { Dialog } from '../../shared/ui/Dialog';
import { Input, Textarea } from '../../shared/ui/Input';
import { Badge } from '../../shared/ui/Badge';

interface Resource {
  id: string;
  type: 'HUMANO' | 'MAQUINA';
  name: string;
  sector?: string;
  status: string;
  notes?: string;
}

interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  username: string;
  role: 'SUPERVISOR' | 'OPERARIO' | 'ADMIN' | 'DUENO';
  isActive: boolean;
  isProtected?: boolean;
  isSystemOwner?: boolean;
}

type EditableRole = 'SUPERVISOR' | 'OPERARIO' | 'ADMIN';

interface CompanySettings {
  warningTimeDeviationPct: number;
  criticalTimeDeviationPct: number;
  warningCostDeviationPct: number;
  criticalCostDeviationPct: number;
  requireDeliveryChecklist: boolean;
  workOrderCodePrefix: string;
  defaultWorkOrderPriority: number;
}

interface AccessMatrix {
  [role: string]: {
    [module: string]: string[];
  };
}

interface AuditLog {
  id: string;
  createdAt: string;
  entityType: string;
  entityId: string;
  action: string;
  user?: {
    fullName: string;
    role: string;
  } | null;
}

interface AuditLogPage {
  items: AuditLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const emptyForm = {
  type: 'MAQUINA' as 'HUMANO' | 'MAQUINA',
  name: '',
  sector: '',
  status: 'DISPONIBLE',
  notes: ''
};

const emptyUserForm = {
  fullName: '',
  email: '',
  username: '',
  role: 'OPERARIO' as EditableRole,
  password: 'ChangeMe123!'
};

export function ResourcesPage() {
  const sessionUser = getSessionUser();
  const canManageProfiles = sessionUser?.role === 'ADMIN' || sessionUser?.role === 'DUENO';
  const queryClient = useQueryClient();

  const [form, setForm] = useState(emptyForm);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingResourceId, setEditingResourceId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDeleteResource, setConfirmDeleteResource] = useState<Resource | null>(null);

  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [newUser, setNewUser] = useState(emptyUserForm);
  const [userFormError, setUserFormError] = useState<string | null>(null);
  const [userDrafts, setUserDrafts] = useState<Record<string, { fullName: string; email: string; username: string }>>({});
  const [passwordDrafts, setPasswordDrafts] = useState<Record<string, string>>({});
  const [passwordFeedback, setPasswordFeedback] = useState<
    Record<string, { type: 'success' | 'error'; message: string }>
  >({});
  const [settingsDraft, setSettingsDraft] = useState<CompanySettings | null>(null);
  const [settingsFeedback, setSettingsFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [searchResource, setSearchResource] = useState('');
  
  const [searchUser, setSearchUser] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  const listQuery = useQuery({
    queryKey: ['resources'],
    queryFn: async () => {
      const response = await api.get<Resource[]>('/resources');
      return response.data;
    }
  });

  const usersQuery = useQuery({
    queryKey: ['resource-user-profiles'],
    queryFn: async () => {
      const response = await api.get<UserProfile[]>('/users');
      return response.data;
    },
    enabled: canManageProfiles
  });

  const settingsQuery = useQuery({
    queryKey: ['company-settings'],
    queryFn: async () => {
      const response = await api.get<CompanySettings>('/companies/settings');
      return response.data;
    },
    enabled: canManageProfiles
  });

  const accessMatrixQuery = useQuery({
    queryKey: ['access-matrix'],
    queryFn: async () => {
      const response = await api.get<AccessMatrix>('/companies/access-matrix');
      return response.data;
    },
    enabled: canManageProfiles
  });

  const auditQuery = useQuery({
    queryKey: ['audit-logs'],
    queryFn: async () => {
      const response = await api.get<AuditLogPage>('/audit-logs', { params: { limit: 40 } });
      return response.data.items;
    }
  });

  const filteredResources = useMemo(() => {
    let data = listQuery.data ?? [];
    if (searchResource.trim()) {
      const q = searchResource.toLowerCase();
      data = data.filter(r => r.name.toLowerCase().includes(q) || (r.sector || '').toLowerCase().includes(q));
    }
    return data;
  }, [listQuery.data, searchResource]);

  const filteredUsers = useMemo(() => {
    let data = usersQuery.data ?? [];
    if (searchUser.trim()) {
      const q = searchUser.toLowerCase();
      data = data.filter(
        u =>
          u.fullName.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.username.toLowerCase().includes(q)
      );
    }
    if (roleFilter) {
      data = data.filter(u => u.role === roleFilter);
    }
    return data;
  }, [usersQuery.data, searchUser, roleFilter]);

  useEffect(() => {
    if (!usersQuery.data) return;
    const nextDrafts: Record<string, { fullName: string; email: string; username: string }> = {};
    usersQuery.data.forEach((user) => {
      nextDrafts[user.id] = {
        fullName: user.fullName,
        email: user.email,
        username: user.username
      };
    });
    setUserDrafts(nextDrafts);
  }, [usersQuery.data]);

  useEffect(() => {
    if (!settingsQuery.data) return;
    setSettingsDraft(settingsQuery.data);
  }, [settingsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingResourceId) {
        await api.patch(`/resources/${editingResourceId}`, form);
      } else {
        await api.post('/resources', form);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources'] });
      setForm(emptyForm);
      setEditingResourceId(null);
      setIsModalOpen(false);
      setFormError(null);
    },
    onError: () => {
      setFormError(editingResourceId ? 'No se pudo actualizar el recurso.' : 'No se pudo crear el recurso. Verifica los datos e intenta nuevamente.');
    }
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await api.patch(`/resources/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources'] });
    }
  });

  const deleteResourceMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/resources/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources'] });
      setConfirmDeleteResource(null);
      setFormError(null);
    },
    onError: (error: any) => {
      const backendMessage = error?.response?.data?.message;
      setFormError(Array.isArray(backendMessage)
        ? backendMessage.join(', ')
        : backendMessage || 'No se pudo eliminar el recurso.');
    }
  });

  const createUserMutation = useMutation({
    mutationFn: async () => {
      await api.post('/users', newUser);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resource-user-profiles'] });
      setNewUser(emptyUserForm);
      setIsUserModalOpen(false);
      setUserFormError(null);
    },
    onError: () => {
      setUserFormError('No se pudo crear el usuario. Verificá usuario, email, rol y contraseña.');
    }
  });

  const profileMutation = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: EditableRole }) => {
      await api.patch(`/users/${id}/role`, { role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resource-user-profiles'] });
    }
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: { fullName: string; email: string; username: string } }) => {
      await api.patch(`/users/${id}/profile`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resource-user-profiles'] });
    }
  });

  const updatePasswordMutation = useMutation({
    mutationFn: async ({ id, password }: { id: string; password: string }) => {
      await api.patch(`/users/${id}/password`, { password });
    },
    onSuccess: (_, variables) => {
      setPasswordDrafts((current) => ({ ...current, [variables.id]: '' }));
      setPasswordFeedback((current) => ({
        ...current,
        [variables.id]: { type: 'success', message: 'Contraseña actualizada.' }
      }));
    },
    onError: (error: any, variables) => {
      const backendMessage = error?.response?.data?.message;
      const message = Array.isArray(backendMessage)
        ? backendMessage.join(', ')
        : (backendMessage as string) || 'No se pudo actualizar la contraseña.';

      setPasswordFeedback((current) => ({
        ...current,
        [variables.id]: { type: 'error', message }
      }));
    }
  });

  const toggleUserMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.patch('/users/toggle-active', { id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resource-user-profiles'] });
    }
  });

  const settingsMutation = useMutation({
    mutationFn: async () => {
      if (!settingsDraft) {
        throw new Error('Sin configuracion para guardar');
      }
      await api.patch('/companies/settings', settingsDraft);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-settings'] });
      queryClient.invalidateQueries({ queryKey: ['productivity-report'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setSettingsFeedback({ type: 'success', text: 'Configuracion base de la empresa guardada correctamente.' });
    },
    onError: (error: any) => {
      const backendMessage = error?.response?.data?.message;
      const message = Array.isArray(backendMessage)
        ? backendMessage.join(', ')
        : (backendMessage as string) || 'No se pudo guardar la configuracion.';
      setSettingsFeedback({ type: 'error', text: message });
    }
  });

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    saveMutation.mutate();
  };

  const onCreateUser = (event: FormEvent) => {
    event.preventDefault();
    setUserFormError(null);
    createUserMutation.mutate();
  };

  const closeModal = () => {
    if (saveMutation.isPending) {
      return;
    }
    setIsModalOpen(false);
    setEditingResourceId(null);
    setForm(emptyForm);
    setFormError(null);
  };

  const closeUserModal = () => {
    if (createUserMutation.isPending) {
      return;
    }
    setIsUserModalOpen(false);
    setNewUser(emptyUserForm);
    setUserFormError(null);
  };

  return (
    <div className="stack-lg page-enter">
      
      {/* ── HERO HEADER ─────────────────────────────────────────────── */}
      <header className="page-hero panel stagger-1">
        <div className="page-hero__left">
          <p className="eyebrow" style={{ color: 'var(--primary)', letterSpacing: '0.15em' }}>⚙️ CONFIGURACIÓN DE PLANTA</p>
          <h2 className="page-hero__title">Recursos y Capacidad</h2>
          <p className="page-hero__sub">Administracion de estaciones de trabajo, personal operativo y configuracion central del negocio.</p>
        </div>
        <div className="page-hero__actions">
          <Badge variant="primary">{listQuery.data?.length || 0} Nodos en Planta</Badge>
          <Button type="button" onClick={() => { setFormError(null); setEditingResourceId(null); setForm(emptyForm); setIsModalOpen(true); }}>
            + Nueva Estacion
          </Button>
        </div>
      </header>


      {/* ── LISTADO ESTACIONES Y MAQUINAS ─────────────────────────────── */}
      <section className="stagger-2">
        <div className="control-bar" style={{ gap: '0.75rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Máquinas y Estaciones</h3>
          <Input type="search" placeholder="🔍 Buscar recurso o sector..." value={searchResource} onChange={e => setSearchResource(e.target.value)} style={{ flex: 1, minWidth: '200px', padding: '0.45rem 0.75rem', background: 'var(--panel)', height: '100%' }} />
        </div>

        <div className="premium-table-wrap">
           <table className="premium-table interactive" id="resources-table">
             <thead>
               <tr>
                 <th style={{ width: '80px', color: 'var(--ink-soft)', fontSize: '0.72rem' }}>ID</th>
                 <th>Identificador</th>
                 <th>Sector</th>
                 <th>Estado Actual</th>
                 <th style={{ textAlign: 'right' }}>Disponibilidad / Acciones</th>
               </tr>
             </thead>
             <tbody>
                {listQuery.isLoading ? (
                  <tr><td colSpan={5} className="empty-state">Cargando parque mecanizado...</td></tr>
                ) : filteredResources.length ? (
                   filteredResources.map((resource: Resource) => (
                     <tr key={resource.id}>
                       <td>
                         <span style={{
                           fontFamily: 'Geist Mono, monospace',
                           fontSize: '0.7rem',
                           color: 'var(--ink-soft)',
                           background: 'var(--panel-soft)',
                           padding: '0.15rem 0.4rem',
                           borderRadius: '0.3rem',
                           border: '1px solid var(--border)',
                           letterSpacing: '0.04em',
                           cursor: 'help'
                         }}
                           title={resource.id}
                         >
                           #{resource.id.slice(0, 6).toUpperCase()}
                         </span>
                       </td>
                       <td className="strong-cell">{resource.name}</td>
                       <td>{resource.sector ?? <span style={{ color: 'var(--ink-soft)' }}>-</span>}</td>
                       <td>
                         <Badge variant={
                           resource.status === 'DISPONIBLE' ? 'success' : 
                           resource.status === 'MANTENIMIENTO' ? 'warning' : 'destructive'}
                         >
                           {resource.status}
                         </Badge>
                       </td>
                       <td style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem', alignItems: 'center' }}>
                         <select
                           className="control-bar__select"
                           value={resource.status}
                           onChange={(e) => statusMutation.mutate({ id: resource.id, status: e.target.value })}
                           style={{ padding: '0.4rem', borderRadius: '0.4rem', border: '1px solid var(--border)', background: 'var(--panel)' }}
                         >
                           <option value="DISPONIBLE">DISPONIBLE</option>
                           <option value="OCUPADO">OCUPADO</option>
                           <option value="MANTENIMIENTO">MANTENIMIENTO</option>
                           <option value="FUERA_DE_LINEA">FUERA_DE_LINEA</option>
                         </select>
                         <Button
                           variant="secondary"
                           size="sm"
                           type="button"
                           onClick={() => {
                             setEditingResourceId(resource.id);
                             setForm({
                               type: resource.type,
                               name: resource.name,
                               sector: resource.sector ?? '',
                               status: resource.status,
                               notes: resource.notes ?? ''
                             });
                             setFormError(null);
                             setIsModalOpen(true);
                           }}
                         >
                           Editar
                         </Button>
                         <Button
                           variant="destructive"
                           size="sm"
                           type="button"
                           onClick={() => setConfirmDeleteResource(resource)}
                         >
                           Eliminar
                         </Button>
                       </td>
                     </tr>
                   ))
                ) : (
                  <tr>
                    <td colSpan={5}>
                      <div className="empty-state">
                        <span className="empty-state__icon">🏗️</span>
                        <p>No existen nodos productivos dados de alta.</p>
                      </div>
                    </td>
                  </tr>
                )}
             </tbody>
           </table>
        </div>
      </section>

      {/* ── AREA RESERVADA ADMIN / SUPERVISOR ──────────────────────── */}
      {canManageProfiles ? (
        <div className="stagger-3 stack-lg" style={{ marginTop: '1rem' }}>
          
          <div className="dash-no-alerts" style={{ background: 'color-mix(in srgb, var(--primary) 10%, transparent)', color: 'var(--primary)', borderColor: 'color-mix(in srgb, var(--color-info) 30%, transparent)', margin: 0 }}>
            <span>🔐</span> <strong>Area Restringida:</strong> Estas viendo configuraciones exclusivas porque tu nivel de acceso actual te lo permite.
          </div>

          <section>
            <div className="control-bar" style={{ gap: '0.75rem', flexWrap: 'wrap' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Cuentas de Acceso</h3>
              <div style={{ flex: 1, display: 'flex', gap: '0.5rem', minWidth: '300px' }}>
                <Input type="search" placeholder="🔍 Buscar nombre, usuario o email..." value={searchUser} onChange={e => setSearchUser(e.target.value)} style={{ flex: 1, padding: '0.45rem 0.75rem', background: 'var(--panel)', height: '100%' }} />
                <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} style={{ padding: '0.45rem 0.75rem', border: '1px solid var(--border)', borderRadius: '0.5rem', background: 'var(--panel)' }}>
                  <option value="">Todos los Roles</option>
                  <option value="DUENO">OWNER</option>
                  <option value="ADMIN">ADMIN</option>
                  <option value="SUPERVISOR">SUPERVISOR</option>
                  <option value="OPERARIO">OPERARIO</option>
                </select>
              </div>
              <Button type="button" size="sm" onClick={() => { setUserFormError(null); setIsUserModalOpen(true); }} style={{ height: '100%' }}>
                + Invitar
              </Button>
            </div>
            
            <div className="premium-table-wrap">
              <table className="premium-table interactive" id="resource-users-table">
                <thead>
                  <tr>
                    <th>Nombre y Apellido</th>
                    <th>Usuario</th>
                    <th>Correo</th>
                    <th>Nivel Acceso</th>
                    <th>Credenciales</th>
                    <th style={{ textAlign: 'right' }}>Administracion</th>
                  </tr>
                </thead>
                <tbody>
                  {usersQuery.isLoading ? (
                    <tr><td colSpan={6} className="empty-state">Leyendo directorio activo...</td></tr>
                  ) : filteredUsers.length ? (
                    filteredUsers.map((user: UserProfile) => {
                      const draft = userDrafts[user.id] ?? {
                        fullName: user.fullName,
                        email: user.email,
                        username: user.username
                      };
                      const passwordDraft = passwordDrafts[user.id] ?? '';
                      const feedback = passwordFeedback[user.id];
                      const isOwnerAccount = Boolean(user.isProtected || user.isSystemOwner);

                      return (
                        <tr key={user.id}>
                          <td>
                            <Input
                              style={{ width: '100%', padding: '0.4rem', height: '32px' }}
                              value={draft.fullName}
                              onChange={(event) => setUserDrafts((current) => ({ ...current, [user.id]: { ...draft, fullName: event.target.value } }))}
                            />
                          </td>
                          <td>
                            <Input
                              style={{ width: '100%', padding: '0.4rem', height: '32px' }}
                              value={draft.username}
                              onChange={(event) => setUserDrafts((current) => ({
                                ...current,
                                [user.id]: { ...draft, username: event.target.value.toLowerCase() }
                              }))}
                            />
                          </td>
                          <td>
                            <Input
                              type="email"
                              style={{ width: '100%', padding: '0.4rem', height: '32px' }}
                              value={draft.email}
                              onChange={(event) => setUserDrafts((current) => ({ ...current, [user.id]: { ...draft, email: event.target.value } }))}
                            />
                          </td>
                          <td>
                            {user.role === 'DUENO' ? (
                              <Badge variant="default">OWNER</Badge>
                            ) : (
                              <select
                                style={{ padding: '0.4rem', height: '32px', borderRadius: '0.3rem', border: '1px solid var(--border)', background: 'var(--panel)', fontSize: '0.8rem' }}
                                value={user.role}
                                onChange={(event) => profileMutation.mutate({ id: user.id, role: event.target.value as EditableRole })}
                                disabled={profileMutation.isPending}
                              >
                                <option value="SUPERVISOR">SUPERVISOR</option>
                                <option value="OPERARIO">OPERADOR PLANTA</option>
                                <option value="ADMIN">ADMINISTRADOR</option>
                              </select>
                            )}
                          </td>
                          <td style={{ minWidth: '220px' }}>
                            <div className="inline-actions">
                                <Input
                                  type="password"
                                  style={{ width: '120px', padding: '0.4rem', height: '32px', fontSize: '0.8rem' }}
                                  value={passwordDraft}
                                  onChange={(event) => setPasswordDrafts((current) => ({ ...current, [user.id]: event.target.value }))}
                                  placeholder="Nuevo pass..."
                                />
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => updatePasswordMutation.mutate({ id: user.id, password: passwordDraft })}
                                  disabled={updatePasswordMutation.isPending || passwordDraft.length < 6}
                                >
                                  Fijar
                                </Button>
                            </div>
                            {feedback ? <div style={{ fontSize: '0.7rem', color: feedback.type === 'error' ? 'var(--destructive)' : 'var(--success)', marginTop: '0.2rem' }}>{feedback.message}</div> : null}
                          </td>
                          <td className="row-actions" style={{ justifyContent: 'flex-end', gap: '0.4rem' }}>
                             <Button
                              variant={user.isActive ? 'destructive' : 'default'}
                              type="button"
                              size="sm"
                              onClick={() => toggleUserMutation.mutate(user.id)}
                              disabled={toggleUserMutation.isPending || isOwnerAccount}
                             >
                               {user.isActive ? 'Suspender' : 'Habilitar'}
                             </Button>
                             <Button
                              type="button"
                              size="sm"
                              onClick={() => updateUserMutation.mutate({ id: user.id, payload: draft })}
                              disabled={updateUserMutation.isPending}
                             >
                               Guardar
                             </Button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr><td colSpan={5}>Sin usuarios en directorio.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="form-grid-2">
            <Card>
              <CardHeader>
                <CardTitle>Configuracion Sensible del Negocio</CardTitle>
                <p style={{ fontSize: '0.85rem', color: 'var(--ink-soft)', marginTop: '0.2rem' }}>Ajusta los umbrales financieros y operativos globales.</p>
              </CardHeader>
              <CardContent>
                {settingsDraft ? (
                  <div className="form-grid" style={{ gap: '1.5rem' }}>
                    
                    <div>
                      <h5 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--ink)' }}>Limites de Alarma (Generador de Eventos)</h5>
                      <div className="form-grid-2" style={{ marginTop: '0.8rem' }}>
                        <label>Warning Horas Demás (%) <Input type="number" min={0} value={settingsDraft.warningTimeDeviationPct} onChange={(e) => setSettingsDraft({ ...settingsDraft, warningTimeDeviationPct: Number(e.target.value) })} /></label>
                        <label>Critico Horas Demás (%) <Input type="number" min={0} value={settingsDraft.criticalTimeDeviationPct} onChange={(e) => setSettingsDraft({ ...settingsDraft, criticalTimeDeviationPct: Number(e.target.value) })} /></label>
                        <label>Warning Costos Extra (%) <Input type="number" min={0} value={settingsDraft.warningCostDeviationPct} onChange={(e) => setSettingsDraft({ ...settingsDraft, warningCostDeviationPct: Number(e.target.value) })} /></label>
                        <label>Critico Costos Extra (%) <Input type="number" min={0} value={settingsDraft.criticalCostDeviationPct} onChange={(e) => setSettingsDraft({ ...settingsDraft, criticalCostDeviationPct: Number(e.target.value) })} /></label>
                      </div>
                    </div>

                    <div>
                      <h5 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--ink)' }}>Metadatos de Produccion</h5>
                      <div className="form-grid-2" style={{ marginTop: '0.8rem' }}>
                        <label>Formato Prefijo Ordenes <Input value={settingsDraft.workOrderCodePrefix} onChange={(e) => setSettingsDraft({ ...settingsDraft, workOrderCodePrefix: e.target.value })} /></label>
                        <label>Prioridad Inicial Defecto <Input type="number" min={1} max={5} value={settingsDraft.defaultWorkOrderPriority} onChange={(e) => setSettingsDraft({ ...settingsDraft, defaultWorkOrderPriority: Number(e.target.value) })} /></label>
                        <label style={{ gridColumn: '1 / -1' }}>
                          Requerir Checklist Final al Entregar Partes
                          <select 
                             value={settingsDraft.requireDeliveryChecklist ? 'SI' : 'NO'} 
                             onChange={(e) => setSettingsDraft({ ...settingsDraft, requireDeliveryChecklist: e.target.value === 'SI' })}
                             style={{ padding: '0.5rem', borderRadius: '0.4rem', border: '1px solid var(--border)', background: 'var(--panel)', width: '100%' }}
                          >
                            <option value="SI">SI (Exigible)</option>
                            <option value="NO">NO (Libre paso)</option>
                          </select>
                        </label>
                      </div>
                    </div>

                    <div style={{ paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                      <Button type="button" onClick={() => settingsMutation.mutate()} disabled={settingsMutation.isPending} style={{ width: '100%' }}>
                        {settingsMutation.isPending ? 'Propagando...' : 'Aplicar Reglas Globales'}
                      </Button>
                      {settingsFeedback ? (
                        <div style={{ padding: '0.6rem', background: settingsFeedback.type === 'error' ? 'var(--color-danger-surface)' : 'var(--color-success-surface)', color: settingsFeedback.type === 'error' ? 'var(--destructive)' : 'var(--success)', marginTop: '1rem', borderRadius: 'var(--radius-sm)', fontSize: 'var(--font-size-sm)' }}>
                          {settingsFeedback.text}
                        </div>
                      ) : null}
                    </div>

                  </div>
                ) : (
                  <p>Cargando configuracion core...</p>
                )}
              </CardContent>
            </Card>

            <div className="form-grid">
              
              <Card>
                <CardHeader>
                  <CardTitle>Auditoria Trazabilidad (Ultimas 40 Acciones)</CardTitle>
                </CardHeader>
                <CardContent style={{ maxHeight: '400px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                  {auditQuery.isLoading ? (
                    <p>Leyendo registros...</p>
                  ) : (
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.4rem' }}>
                      {(auditQuery.data ?? []).map((log) => (
                        <li key={log.id} style={{ fontSize: '0.8rem', padding: '0.6rem', background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: '0.4rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--ink-soft)', marginBottom: '0.2rem' }}>
                            <span>{new Date(log.createdAt).toLocaleString('es-AR', {day: '2-digit', month:'short', hour:'2-digit', minute:'2-digit'})}</span>
                            <strong>{log.action}</strong>
                          </div>
                          <div>
                            <strong style={{ color: 'var(--ink)' }}>{log.entityType} ({log.entityId.substring(0,6)}...)</strong> por <em>{log.user?.fullName ?? 'Sistema'}</em>
                          </div>
                        </li>
                      ))}
                      {!auditQuery.data?.length ? <li><span>Registro limpio.</span></li> : null}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Matriz de Autorizaciones Vigente</CardTitle>
                </CardHeader>
                <CardContent>
                  {accessMatrixQuery.isLoading ? (
                    <p>Consultando base de privilegios...</p>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                      {Object.entries(accessMatrixQuery.data ?? {}).map(([role, modules]) => (
                        <div key={role} style={{ background: 'color-mix(in srgb, var(--panel-elevated) 40%, transparent 60%)', padding: '1rem', borderRadius: '0.6rem' }}>
                          <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--primary)', marginBottom: '0.8rem' }}>Rol: {role}</h4>
                          <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.8rem', display: 'grid', gap: '0.4rem' }}>
                            {Object.entries(modules).map(([moduleName, permissions]) => (
                               <li key={`${role}-${moduleName}`} style={{ display: 'flex', flexDirection: 'column' }}>
                                 <strong style={{ color: 'var(--ink)' }}>{moduleName}</strong>
                                 <span style={{ color: 'var(--ink-soft)' }}>{permissions.join(', ')}</span>
                               </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

            </div>

          </section>

        </div>
      ) : null}

      {/* ── MODAL ALTA MAQUINAS ─────────────────────────────────────── */}
      <Dialog
        open={isModalOpen}
        onOpenChange={(open) => {
          if (!open) closeModal();
          else setIsModalOpen(true);
        }}
        disableClose={saveMutation.isPending}
        title={editingResourceId ? 'Editar Recurso' : 'Crear Nueva Maquina'}
        description={editingResourceId ? 'Modificá los datos del recurso seleccionado.' : 'Agrega una maquina o estacion productiva a la planta.'}
      >
        <form className="form-grid" onSubmit={onSubmit}>
          <div className="form-section">
            <h4 className="form-section__title">Parametros</h4>
            <div className="form-grid-2">
              <label>
                Nombre del Recurso
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="Ej: Torno CNC 1" />
              </label>
              <label>
                Area / Sector Planta
                <Input value={form.sector} onChange={(e) => setForm({ ...form, sector: e.target.value })} placeholder="Ej: Mecanizado Ligero" />
              </label>
            </div>
            <label style={{ marginTop: '1rem' }}>
              Notas u Observaciones Mantenimiento
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Año reparacion, caracteristicas clave..." />
            </label>
          </div>

          {formError ? <p className="error-text">❌ {formError}</p> : null}
          <div style={{ display: 'flex', gap: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
            <Button type="submit" disabled={saveMutation.isPending}>{saveMutation.isPending ? (editingResourceId ? 'Actualizando...' : 'Agregando...') : (editingResourceId ? 'Guardar Cambios' : 'Dar de Alta en Planta')}</Button>
            <Button variant="secondary" type="button" onClick={closeModal} disabled={saveMutation.isPending}>Cancelar</Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={Boolean(confirmDeleteResource)}
        onOpenChange={(open) => { if (!open) setConfirmDeleteResource(null); }}
        disableClose={deleteResourceMutation.isPending}
        title="Eliminar recurso"
        description={`Se dara de baja "${confirmDeleteResource?.name ?? 'este recurso'}" del listado activo.`}
      >
        <div style={{ display: 'flex', gap: '1rem', paddingTop: '0.5rem' }}>
          <Button
            type="button"
            variant="destructive"
            disabled={deleteResourceMutation.isPending}
            onClick={() => { if (confirmDeleteResource) deleteResourceMutation.mutate(confirmDeleteResource.id); }}
          >
            {deleteResourceMutation.isPending ? 'Eliminando...' : 'Si, eliminar'}
          </Button>
          <Button variant="secondary" type="button" onClick={() => setConfirmDeleteResource(null)} disabled={deleteResourceMutation.isPending}>
            Cancelar
          </Button>
        </div>
      </Dialog>

      {/* ── MODAL CREAR USUARIO ─────────────────────────────────────── */}
      <Dialog
        open={isUserModalOpen}
        onOpenChange={(open) => {
          if (!open) closeUserModal();
          else setIsUserModalOpen(true);
        }}
        disableClose={createUserMutation.isPending}
        title="Invitar Nueva Cuenta al MES"
        description="Agrega un empleado para que pueda acceder al software."
      >
        <form className="form-grid" onSubmit={onCreateUser}>
          <div className="form-section">
            <h4 className="form-section__title">Credenciales e Identidad</h4>
            <div className="form-grid-2">
              <label>
                Nombre Completo DNI
                <Input value={newUser.fullName} onChange={(event) => setNewUser({ ...newUser, fullName: event.target.value })} required />
              </label>
              <label>
                Email
                <Input type="email" value={newUser.email} onChange={(event) => setNewUser({ ...newUser, email: event.target.value })} required />
              </label>
              <label>
                Nombre de Usuario
                <Input
                  value={newUser.username}
                  onChange={(event) => setNewUser({ ...newUser, username: event.target.value.toLowerCase() })}
                  required
                  minLength={3}
                  maxLength={40}
                  pattern="[a-zA-Z0-9._-]+"
                  placeholder="nombre.apellido"
                />
              </label>
              <label>
                Contraseña Temporal
                <Input type="text" value={newUser.password} onChange={(event) => setNewUser({ ...newUser, password: event.target.value })} required minLength={6} />
              </label>
            </div>
            <label style={{ marginTop: '1rem' }}>
              Perfil de Seguridad (Rol)
              <select
                value={newUser.role}
                onChange={(event) => setNewUser({ ...newUser, role: event.target.value as EditableRole })}
                style={{ width: '100%', padding: '0.6rem', border: '1px solid var(--border)', borderRadius: '0.5rem', background: 'var(--panel)' }}
              >
                <option value="OPERARIO">OPERADOR DE PLANTA (Vista Limitada Terminal)</option>
                <option value="SUPERVISOR">SUPERVISOR (Gestion Produccion)</option>
                <option value="ADMIN">ADMINISTRADOR (Gestion y Configuracion)</option>
              </select>
            </label>
          </div>
          {userFormError ? <p className="error-text">❌ {userFormError}</p> : null}
          <div style={{ display: 'flex', gap: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
            <Button type="submit" disabled={createUserMutation.isPending}>
              {createUserMutation.isPending ? 'Creando...' : 'Otorgar Acceso'}
            </Button>
            <Button variant="secondary" type="button" onClick={closeUserModal} disabled={createUserMutation.isPending}>
              Cancelar
            </Button>
          </div>
        </form>
      </Dialog>

    </div>
  );
}
