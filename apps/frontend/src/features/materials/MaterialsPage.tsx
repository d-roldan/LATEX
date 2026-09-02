import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Save } from 'lucide-react';
import { api } from '../../shared/api/http';
import { Badge } from '../../shared/ui/Badge';
import { Button } from '../../shared/ui/Button';
import { Dialog } from '../../shared/ui/Dialog';
import { Input } from '../../shared/ui/Input';

interface MaterialMovement { id: string; type: string; quantity: number; unitCost: number; note?: string; createdAt: string; }
interface Material { id: string; name: string; category?: string; unit: string; unitCost: number; stock: number; movements: MaterialMovement[]; }

type SortKey = 'name' | 'category' | 'stock' | 'unitCost';
type SortDir = 'asc' | 'desc';

const emptyForm = { name: '', category: '', unit: 'kg', unitCost: 0, stock: 0 };
const emptyEditForm = { name: '', category: '', unit: '', unitCost: 0 };

export function MaterialsPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  // quantity is stored as string to allow typing "-" before the digits
  const [adjustMap, setAdjustMap] = useState<Record<string, { quantityStr: string; unitCost: number; note: string }>>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [adjustError, setAdjustError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Filters & Sort
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const listQuery = useQuery({
    queryKey: ['materials'],
    queryFn: async () => (await api.get<Material[]>('/materials')).data
  });

  const categories = useMemo(() => {
    const cats = new Set<string>();
    listQuery.data?.forEach(m => { if(m.category) cats.add(m.category); });
    return Array.from(cats).sort();
  }, [listQuery.data]);

  const filteredAndSorted = useMemo(() => {
    let data = listQuery.data ?? [];
    if (search.trim()) {
      const q = search.toLowerCase();
      data = data.filter(x => x.name.toLowerCase().includes(q) || (x.category || '').toLowerCase().includes(q));
    }
    if (catFilter) data = data.filter(x => x.category === catFilter);

    return [...data].sort((a, b) => {
      let valA: string | number = a[sortKey] || '';
      let valB: string | number = b[sortKey] || '';
      if (typeof valA === 'number') return sortDir === 'asc' ? valA - (valB as number) : (valB as number) - valA;
      return sortDir === 'asc' ? String(valA).localeCompare(String(valB)) : String(valB).localeCompare(String(valA));
    });
  }, [listQuery.data, search, catFilter, sortKey, sortDir]);

  const createMutation = useMutation({
    mutationFn: async () => api.post('/materials', form),
    onSuccess: () => { queryClient.invalidateQueries({queryKey:['materials']}); setForm(emptyForm); setIsModalOpen(false); setFormError(null); },
    onError: () => setFormError('Error al crear material.')
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: typeof emptyEditForm }) => api.patch(`/materials/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey:['materials']});
      setEditingMaterial(null);
      setEditForm(emptyEditForm);
      setEditError(null);
    },
    onError: (err: any) => setEditError(err?.response?.data?.message || 'Error al actualizar material.')
  });

  const adjustMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: { quantity: number; unitCost: number; note: string } }) => api.post(`/materials/${id}/adjust-stock`, payload),
    onSuccess: () => { queryClient.invalidateQueries({queryKey:['materials']}); setAdjustError(null); },
    onError: () => setAdjustError('Error al ajustar stock.')
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/materials/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey:['materials']});
      setDeleteConfirmId(null);
      setEditingMaterial(null);
      setEditForm(emptyEditForm);
    },
    onError: (err: any) => { setDeleteConfirmId(null); setAdjustError(err?.response?.data?.message || 'Error al eliminar material. Puede estar en uso.'); }
  });

  const toggleSort = (k: SortKey) => { setSortKey(k); setSortDir(sortKey === k && sortDir === 'asc' ? 'desc' : 'asc'); };
  const openEditModal = (material: Material) => {
    setEditingMaterial(material);
    setEditForm({
      name: material.name,
      category: material.category || '',
      unit: material.unit,
      unitCost: Number(material.unitCost)
    });
    setEditError(null);
  };
  const closeEditModal = () => {
    if (updateMutation.isPending) return;
    setEditingMaterial(null);
    setEditForm(emptyEditForm);
    setEditError(null);
  };
  const getSortIcon = (k: SortKey) => sortKey === k ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ' ↕';

  return (
    <div className="stack-lg page-enter">
      <header className="page-hero panel stagger-1">
        <div className="page-hero__left">
          <p className="eyebrow" style={{ color: 'var(--accent-lime)' }}>📦 PAÑOL Y DEPOSITOS</p>
          <h2 className="page-hero__title">Gestión de Materiales</h2>
          <p className="page-hero__sub">Control de inventario operativo, ajustes manuales y trazabilidad.</p>
        </div>
        <div className="page-hero__actions">
          <Badge variant="primary">{filteredAndSorted.length} items activos</Badge>
          <Button type="button" onClick={() => setIsModalOpen(true)}>+ Nuevo Material</Button>
        </div>
      </header>

      <section className="stagger-2">
        <div className="control-bar" style={{ gap: '0.75rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Catálogo de Stock</h3>
          <Input type="search" placeholder="🔍 Buscar material o categoría..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1, minWidth: '200px', padding: '0.45rem 0.75rem', background: 'var(--panel)', height: '100%' }} />
          <select value={catFilter} onChange={e => setCatFilter(e.target.value)} style={{ padding: '0.45rem 0.75rem', border: '1px solid var(--border)', borderRadius: '0.5rem', background: 'var(--panel)', color: 'var(--ink)' }}>
            <option value="">Todas las Categorías</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {adjustError && (
          <div className="dash-no-alerts" style={{ background: 'var(--color-danger-surface)', color: 'var(--destructive)', borderColor: 'color-mix(in srgb, var(--color-danger) 30%, transparent)', marginBottom: '1rem' }}>
            <span>❌</span> {adjustError}
          </div>
        )}

        <div className="premium-table-wrap">
          <table className="premium-table interactive" id="materials-table">
            <thead>
              <tr>
                <th onClick={() => toggleSort('name')} style={{cursor:'pointer'}}>Insumo / Material{getSortIcon('name')}</th>
                <th onClick={() => toggleSort('category')} style={{cursor:'pointer'}}>Categoría{getSortIcon('category')}</th>
                <th onClick={() => toggleSort('stock')} style={{cursor:'pointer', textAlign:'right'}}>Stock Dispon.{getSortIcon('stock')}</th>
                <th onClick={() => toggleSort('unitCost')} style={{cursor:'pointer', textAlign:'right'}}>Costo Unit.{getSortIcon('unitCost')}</th>
                <th style={{ textAlign: 'center' }}>Ajuste y Acciones</th>
              </tr>
            </thead>
            <tbody>
              {listQuery.isLoading ? <tr><td colSpan={5} className="empty-state">Cargando...</td></tr> : filteredAndSorted.length ? filteredAndSorted.map(m => {
                const isLow = Number(m.stock) <= 0;
                const locA = adjustMap[m.id] ?? { quantityStr: '0', unitCost: Number(m.unitCost), note: '' };
                return (
                  <tr key={m.id}>
                    <td className="strong-cell">{m.name}</td>
                    <td>{m.category ? <Badge variant="default">{m.category}</Badge> : '-'}</td>
                    <td className="numeric-cell" style={{textAlign:'right', color: isLow?'var(--destructive)':'var(--success)', fontWeight:800}}>{Number(m.stock)} <span style={{fontSize:'0.7em',color:'var(--ink-soft)'}}>{m.unit}</span></td>
                    <td className="numeric-cell" style={{textAlign:'right'}}>${Number(m.unitCost).toLocaleString('es-AR')}</td>
                    <td className="materials-row-actions">
                      <div className="inline-actions" style={{ background: 'color-mix(in srgb, var(--panel-elevated) 40%, transparent 60%)', padding: '0.2rem', borderRadius: '0.5rem' }}>
                        <Input type="number" style={{width:'80px', padding:'0.3rem', height:'30px'}} value={locA.quantityStr} onChange={e => setAdjustMap({...adjustMap, [m.id]: {...locA, quantityStr: e.target.value}})} />
                        <Button className="materials-row-action-button" size="sm" type="button" variant="secondary" onClick={() => adjustMutation.mutate({id:m.id, payload:{ quantity: parseFloat(locA.quantityStr) || 0, unitCost: locA.unitCost, note: locA.note }})}>Ajustar</Button>
                      </div>
                      <Button className="materials-row-action-button" variant="outline" size="sm" onClick={() => openEditModal(m)} title="Editar material"><Pencil size={14} /> Editar</Button>
                    </td>
                  </tr>
                );
              }) : <tr><td colSpan={5} className="empty-state">No se encontraron materiales.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {/* MODAL ALTA */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen} disableClose={createMutation.isPending} title="Alta de Material">
        <form className="form-grid" onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }}>
          <div className="form-section">
            <h4 className="form-section__title">Identificación</h4>
            <div className="form-grid-2">
              <label>Nombre<Input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required /></label>
              <label>Categoría<Input value={form.category} onChange={e=>setForm({...form,category:e.target.value})} /></label>
            </div>
          </div>
          <div className="form-section">
            <h4 className="form-section__title">Parámetros</h4>
            <div className="form-grid-2" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
              <label>Unidad<Input value={form.unit} onChange={e=>setForm({...form,unit:e.target.value})} required /></label>
              <label>Costo Inicial ($)<Input type="number" step="0.01" min={0} value={form.unitCost} onChange={e=>setForm({...form,unitCost:Number(e.target.value)})} required /></label>
              <label>Stock Físico<Input type="number" step="0.01" min={0} value={form.stock} onChange={e=>setForm({...form,stock:Number(e.target.value)})} /></label>
            </div>
          </div>
          {formError && <p className="error-text">❌ {formError}</p>}
          <Button type="submit" disabled={createMutation.isPending}>Crear Material</Button>
        </form>
      </Dialog>

      {/* MODAL EDICION */}
      <Dialog open={!!editingMaterial} onOpenChange={(open)=>!open&&closeEditModal()} disableClose={updateMutation.isPending} title="Editar Material">
        <form className="form-grid" onSubmit={(e: FormEvent) => {
          e.preventDefault();
          if (!editingMaterial) return;
          updateMutation.mutate({ id: editingMaterial.id, payload: editForm });
        }}>
          <div className="form-section">
            <h4 className="form-section__title">Datos del material</h4>
            <div className="form-grid-2">
              <label>Nombre<Input value={editForm.name} onChange={e=>setEditForm({...editForm,name:e.target.value})} required /></label>
              <label>Categoria<Input value={editForm.category} onChange={e=>setEditForm({...editForm,category:e.target.value})} /></label>
            </div>
          </div>
          <div className="form-section">
            <h4 className="form-section__title">Precio y unidad</h4>
            <div className="form-grid-2">
              <label>Unidad<Input value={editForm.unit} onChange={e=>setEditForm({...editForm,unit:e.target.value})} required /></label>
              <label>Costo / Precio unitario ($)<Input type="number" step="0.01" min={0} value={editForm.unitCost} onChange={e=>setEditForm({...editForm,unitCost:Number(e.target.value)})} required /></label>
            </div>
          </div>
          {editError && <p className="error-text">Error: {editError}</p>}
          <div style={{display:'flex',gap:'0.75rem',justifyContent:'space-between'}}>
            <Button
              type="button"
              variant="destructive"
              onClick={() => editingMaterial && setDeleteConfirmId(editingMaterial.id)}
              disabled={updateMutation.isPending || deleteMutation.isPending}
            >
              Eliminar
            </Button>
            <div style={{display:'flex',gap:'0.75rem'}}>
            <Button type="button" variant="secondary" onClick={closeEditModal} disabled={updateMutation.isPending}>Cancelar</Button>
            <Button type="submit" disabled={updateMutation.isPending}><Save size={16} /> Guardar cambios</Button>
            </div>
          </div>
        </form>
      </Dialog>

      {/* CONFIRMAR ELIMINACION */}
      <Dialog open={!!deleteConfirmId} onOpenChange={(o)=>!o&&setDeleteConfirmId(null)} title="⚠️ Eliminar Material" description="¿Eliminar este material? Se ocultara del catalogo activo y se conservara su historial.">
        <div style={{display:'flex',gap:'1rem',paddingTop:'0.5rem'}}>
          <Button variant="destructive" onClick={()=>deleteConfirmId && deleteMutation.mutate(deleteConfirmId)}>Sí, Eliminar</Button>
          <Button variant="secondary" onClick={()=>setDeleteConfirmId(null)}>Cancelar</Button>
        </div>
      </Dialog>
    </div>
  );
}
