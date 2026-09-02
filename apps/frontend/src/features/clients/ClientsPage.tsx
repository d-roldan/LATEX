import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../shared/api/http';
import { Badge } from '../../shared/ui/Badge';
import { Button } from '../../shared/ui/Button';
import { Dialog } from '../../shared/ui/Dialog';
import { Input, Textarea } from '../../shared/ui/Input';
import { Plus, Trash2, UserPlus, Users } from 'lucide-react';

interface ClientContact {
  id?: string;
  name: string;
  role?: string;
  email?: string;
  phone?: string;
}

interface Client {
  id: string;
  name: string;
  cuit?: string;
  industry?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  contacts: ClientContact[];
}

interface ClientListResponse {
  items: Client[];
}

const emptyForm = {
  name: '',
  cuit: '',
  industry: '',
  phone: '',
  email: '',
  address: '',
  notes: '',
  contacts: [] as ClientContact[]
};

const sanitizeContact = (contact: ClientContact): ClientContact => ({
  id: contact.id,
  name: contact.name,
  role: contact.role ?? '',
  email: contact.email ?? '',
  phone: contact.phone ?? ''
});

const sanitizeForm = (formData: typeof emptyForm) => ({
  ...formData,
  contacts: formData.contacts.map(sanitizeContact)
});

export function ClientsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: ['clients', search],
    queryFn: async () => {
      const response = await api.get<ClientListResponse>('/clients', {
        params: {
          search: search || undefined
        }
      });
      return response.data;
    }
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = sanitizeForm(form);
      if (editingId) {
        // En edición, por ahora mandamos el form completo
        // El backend debe manejar la actualización de campos básicos y contactos si se desea
        await api.patch(`/clients/${editingId}`, payload);
      } else {
        await api.post('/clients', payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      setForm(emptyForm);
      setEditingId(null);
      setIsModalOpen(false);
      setFormError(null);
    },
    onError: () => {
      setFormError('No se pudo guardar el cliente. Revisa los datos e intenta nuevamente.');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/clients/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      setDeleteConfirmId(null);
    }
  });

  const selected = useMemo(
    () => listQuery.data?.items.find((client) => client.id === editingId) ?? null,
    [listQuery.data?.items, editingId]
  );

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (form.contacts.length === 0) {
      setFormError('Se requiere al menos un contacto.');
      return;
    }
    setFormError(null);
    saveMutation.mutate();
  };

  const closeModal = () => {
    if (saveMutation.isPending) return;
    setIsModalOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    setFormError(null);
  };

  const addContactRow = () => {
    setForm({
      ...form,
      contacts: [...form.contacts, { name: '', role: '', email: '', phone: '' }]
    });
  };

  const updateContact = (index: number, field: keyof ClientContact, value: string) => {
    const newContacts = [...form.contacts];
    newContacts[index] = { ...newContacts[index], [field]: value };
    setForm({ ...form, contacts: newContacts });
  };

  const removeContactRow = (index: number) => {
    setForm({
      ...form,
      contacts: form.contacts.filter((_, i) => i !== index)
    });
  };

  return (
    <div className="stack-lg page-enter">
      
      {/* ── HERO HEADER ─────────────────────────────────────────────── */}
      <header className="page-hero panel stagger-1">
        <div className="page-hero__left">
          <p className="eyebrow" style={{ color: 'var(--accent-orange)' }}>📁 MODULO CLIENTES</p>
          <h2 className="page-hero__title">Directorio Comercial</h2>
          <p className="page-hero__sub">Gestion de cuentas, contactos y facturacion.</p>
        </div>
        <div className="page-hero__actions">
          <Badge variant="primary">CRM Integrado</Badge>
          <Button
            type="button"
            onClick={() => {
              setEditingId(null);
              setForm({ ...emptyForm, contacts: [{ name: '', role: '', email: '', phone: '' }] });
              setFormError(null);
              setIsModalOpen(true);
            }}
          >
            <UserPlus size={16} className="mr-2" /> Nuevo Cliente
          </Button>
        </div>
      </header>

      {/* ── FILTROS Y TABLA ─────────────────────────────────────────── */}
      <section className="stagger-2">
        
        <div className="control-bar">
          <div className="control-bar__filters">
            <Input
              className="control-bar__input"
              placeholder="🔍 Buscar por nombre, CUIT, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="dash-period-badge">
            {listQuery.data?.items.length || 0} registros
          </div>
        </div>

        <div className="premium-table-wrap">
          <table className="premium-table interactive" id="clients-table">
            <thead>
              <tr>
                <th>Nombre / Razon Social</th>
                <th>CUIT</th>
                <th>Rubro</th>
                <th>Contacto Principal</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {listQuery.isLoading ? (
                <tr><td colSpan={5} className="empty-state">Cargando directorio...</td></tr>
              ) : listQuery.data?.items.length ? (
                listQuery.data.items.map((client) => (
                  <tr key={client.id}>
                    <td className="strong-cell">{client.name}</td>
                    <td><code style={{ fontSize: '0.8rem' }}>{client.cuit || '-'}</code></td>
                    <td><Badge variant="default">{client.industry || 'No def.'}</Badge></td>
                    <td>
                      {client.contacts && client.contacts.length > 0 ? (
                        <div className="stack-xs">
                          <strong>{client.contacts[0].name}</strong>
                          {client.contacts.length > 1 && (
                            <small style={{ color: 'var(--ink-soft)' }}>+{client.contacts.length - 1} más</small>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--ink-soft)' }}>-</span>
                      )}
                    </td>
                    <td className="row-actions" style={{ justifyContent: 'flex-end' }}>
                      <Button
                        variant="secondary"
                        size="sm"
                        type="button"
                        onClick={() => {
                          setEditingId(client.id);
                          setForm({
                            name: client.name,
                            cuit: client.cuit ?? '',
                            industry: client.industry ?? '',
                            phone: client.phone ?? '',
                            email: client.email ?? '',
                            address: client.address ?? '',
                            notes: client.notes ?? '',
                            contacts: (client.contacts ?? []).map(sanitizeContact)
                          });
                          setIsModalOpen(true);
                        }}
                      >
                        Editar
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        type="button"
                        onClick={() => setDeleteConfirmId(client.id)}
                      >
                        Baja
                      </Button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5}>
                    <div className="empty-state">
                      <span className="empty-state__icon">📂</span>
                      <p>No se encontraron clientes.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── MODAL ─────────────────────────────────────────────────── */}
      <Dialog
        open={isModalOpen}
        onOpenChange={(open) => {
          if (!open) closeModal();
          else setIsModalOpen(true);
        }}
        disableClose={saveMutation.isPending}
        title={editingId ? 'Editar Cliente' : 'Alta de Cliente'}
        description={selected ? `Modificando datos de: ${selected.name}` : 'Completa la ficha para registrar una nueva cuenta.'}
      >
        <form className="form-grid" onSubmit={onSubmit} style={{ maxWidth: '700px' }}>
          
          <div className="form-section">
            <h4 className="form-section__title">Datos Principales</h4>
            <div className="form-grid-2">
              <label>
                Nombre / Razon Social
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="Ej: Industria Aceros SA" />
              </label>
              <label>
                CUIT
                <Input value={form.cuit} onChange={(e) => setForm({ ...form, cuit: e.target.value })} placeholder="Ej: 30-12345678-9" />
              </label>
              <label>
                Rubro / Industria
                <Input value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} placeholder="Ej: Metalúrgica" />
              </label>
              <label>
                Dirección Fiscal
                <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Calle 123, Parque Industrial" />
              </label>
            </div>
          </div>

          <div className="form-section" style={{ background: 'var(--panel-soft)', padding: '1rem', borderRadius: '0.6rem', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h4 className="form-section__title" style={{ margin: 0 }}>👥 Personas de Contacto</h4>
              <Button type="button" variant="secondary" size="sm" onClick={addContactRow}>
                <Plus size={14} className="mr-1" /> Nuevo Contacto
              </Button>
            </div>
            
            <div className="stack-md">
              {form.contacts.map((contact, idx) => (
                <div key={idx} style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '1fr 1fr 1fr 1fr auto', 
                  gap: '0.5rem', 
                  alignItems: 'end',
                  padding: '0.75rem',
                  background: 'var(--panel)',
                  borderRadius: '0.4rem',
                  border: '1px solid var(--border)'
                }}>
                  <label style={{ fontSize: '0.75rem' }}>
                    Nombre
                    <Input value={contact.name} onChange={(e) => updateContact(idx, 'name', e.target.value)} required placeholder="Nombre..." />
                  </label>
                  <label style={{ fontSize: '0.75rem' }}>
                    Cargo
                    <Input value={contact.role} onChange={(e) => updateContact(idx, 'role', e.target.value)} placeholder="Ej: Compras" />
                  </label>
                  <label style={{ fontSize: '0.75rem' }}>
                    Email
                    <Input type="email" value={contact.email} onChange={(e) => updateContact(idx, 'email', e.target.value)} placeholder="email@..." />
                  </label>
                  <label style={{ fontSize: '0.75rem' }}>
                    Teléfono
                    <Input value={contact.phone} onChange={(e) => updateContact(idx, 'phone', e.target.value)} placeholder="Tel..." />
                  </label>
                  <Button 
                    type="button" 
                    variant="destructive" 
                    size="sm" 
                    onClick={() => removeContactRow(idx)}
                    style={{ padding: '0.4rem', height: '36px' }}
                    title="Quitar contacto"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              ))}
              {form.contacts.length === 0 && (
                <p style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--ink-soft)', padding: '1rem' }}>
                  Agrega al menos una persona de contacto.
                </p>
              )}
            </div>
          </div>

          <label>
            Observaciones Internas
            <Textarea 
              value={form.notes} 
              onChange={(e) => setForm({ ...form, notes: e.target.value })} 
              placeholder="Condiciones de pago especiales, etc." 
              rows={2}
            />
          </label>

          {formError ? <p className="error-text">❌ {formError}</p> : null}

          <div style={{ display: 'flex', gap: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Guardando...' : 'Guardar Ficha'}
            </Button>
            <Button variant="secondary" type="button" onClick={closeModal} disabled={saveMutation.isPending}>
              Cancelar
            </Button>
          </div>
        </form>
      </Dialog>

      {/* MODAL CONFIRMAR ELIMINAR */}
      <Dialog 
        open={!!deleteConfirmId} 
        onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }} 
        title="⚠️ Confirmar Operación" 
        description="¿Dar de baja a este cliente? Esta acción no se deshace."
      >
        <div style={{ display: 'flex', gap: '1rem', paddingTop: '0.5rem' }}>
          <Button variant="destructive" onClick={() => deleteConfirmId && deleteMutation.mutate(deleteConfirmId)} disabled={deleteMutation.isPending}>
            {deleteMutation.isPending ? 'Borrando...' : 'Sí, Eliminar'}
          </Button>
          <Button variant="secondary" onClick={() => setDeleteConfirmId(null)} disabled={deleteMutation.isPending}>
            Cancelar
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
