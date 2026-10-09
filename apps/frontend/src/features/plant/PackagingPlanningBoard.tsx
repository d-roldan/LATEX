import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  CircleDot,
  GripVertical,
  Pencil,
  Plus,
  Trash2
} from 'lucide-react';
import { api } from '../../shared/api/http';
import { Alert } from '../../shared/ui/Alert';
import { Button } from '../../shared/ui/Button';
import { Dialog } from '../../shared/ui/Dialog';
import { Textarea } from '../../shared/ui/Input';

type Dispenser = 'A' | 'B';

interface PackagingOrderSummary {
  packagingOrder: string;
  materialCode: string;
  dispenser: string | null;
  filter: string | null;
  description: string;
}

interface PackagingTank {
  id: string;
  number: number;
  name: string;
  state: string;
  activeLot: null | {
    id: string;
    manufacturingOrder: string;
    materialCode: string;
    description: string;
    packagingOrders: PackagingOrderSummary[];
  };
}

interface PackagingPlanningCard {
  id: string;
  dispenser: Dispenser;
  position: number;
  hooked: boolean;
  notes: string;
  updatedAt: string;
  tank: PackagingTank;
}

interface PackagingPlanningBoardData {
  plant: { id: string; code: string; name: string };
  dispensers: Dispenser[];
  tanks: PackagingTank[];
  cards: PackagingPlanningCard[];
}

interface PackagingForm {
  tankId: string;
  dispenser: Dispenser;
  notes: string;
}

function apiError(error: unknown) {
  if (typeof error === 'object' && error && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string | string[] } } }).response;
    const message = response?.data?.message;
    if (Array.isArray(message)) return message.join('. ');
    if (message) return message;
  }
  return 'No se pudo completar la operación. Volvé a intentarlo.';
}

export function PackagingPlanningBoard() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<PackagingForm>({ tankId: '', dispenser: 'A', notes: '' });
  const [editing, setEditing] = useState<PackagingPlanningCard | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteCard, setDeleteCard] = useState<PackagingPlanningCard | null>(null);
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const board = useQuery({
    queryKey: ['packaging-planning-board', 'LATEX'],
    queryFn: async () =>
      (await api.get<PackagingPlanningBoardData>('/plants/LATEX/packaging-planning-board')).data,
    refetchInterval: 15_000
  });

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ['packaging-planning-board', 'LATEX'] });

  const cards = useMemo(
    () => [...(board.data?.cards ?? [])].sort((a, b) => a.position - b.position),
    [board.data?.cards]
  );

  const activeByDispenser = useMemo(() => {
    const result: Record<Dispenser, PackagingTank[]> = { A: [], B: [] };
    for (const tank of board.data?.tanks ?? []) {
      const dispenser = tank.activeLot?.packagingOrders[0]?.dispenser;
      if (tank.state === 'ENVASANDO' && (dispenser === 'A' || dispenser === 'B')) {
        result[dispenser].push(tank);
      }
    }
    return result;
  }, [board.data?.tanks]);

  const selectableTanks = useMemo(() => {
    const plannedTankIds = new Set(
      (board.data?.cards ?? [])
        .filter((card) => card.id !== editing?.id)
        .map((card) => card.tank.id)
    );
    return (board.data?.tanks ?? []).filter(
      (tank) => tank.state !== 'ENVASANDO' && !plannedTankIds.has(tank.id)
    );
  }, [board.data?.cards, board.data?.tanks, editing?.id]);

  const save = useMutation({
    mutationFn: async () => {
      if (editing) {
        await api.patch(`/plants/LATEX/packaging-planning-cards/${editing.id}`, {
          tankId: form.tankId,
          hooked: editing.hooked,
          notes: form.notes
        });
      } else {
        await api.post('/plants/LATEX/packaging-planning-cards', form);
      }
    },
    onSuccess: async () => {
      setDialogOpen(false);
      setMessage(editing ? 'Planificación actualizada.' : 'Tanque agregado a la planificación.');
      await refresh();
    }
  });

  const move = useMutation({
    mutationFn: async ({
      cardId,
      dispenser,
      position
    }: {
      cardId: string;
      dispenser: Dispenser;
      position: number;
    }) => {
      await api.patch(`/plants/LATEX/packaging-planning-cards/${cardId}/position`, {
        dispenser,
        position
      });
    },
    onSuccess: refresh
  });

  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/plants/LATEX/packaging-planning-cards/${id}`),
    onSuccess: async () => {
      setDeleteCard(null);
      setMessage('Tanque eliminado de la planificación.');
      await refresh();
    }
  });

  const toggleHooked = useMutation({
    mutationFn: async (card: PackagingPlanningCard) =>
      api.patch(`/plants/LATEX/packaging-planning-cards/${card.id}`, {
        tankId: card.tank.id,
        hooked: !card.hooked,
        notes: card.notes
      }),
    onSuccess: refresh
  });

  const openCreate = (dispenser: Dispenser) => {
    setEditing(null);
    setForm({ tankId: '', dispenser, notes: '' });
    setMessage(null);
    setDialogOpen(true);
  };

  const openEdit = (card: PackagingPlanningCard) => {
    setEditing(card);
    setForm({ tankId: card.tank.id, dispenser: card.dispenser, notes: card.notes });
    setMessage(null);
    setDialogOpen(true);
  };

  const dropCard = (dispenser: Dispenser, position: number) => {
    if (!draggedCardId) return;
    const source = board.data?.cards.find((card) => card.id === draggedCardId);
    if (!source) return;
    move.mutate({ cardId: source.id, dispenser, position });
    setDraggedCardId(null);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    save.mutate();
  };

  if (board.isLoading) return <div className="planning-state">Cargando pizarra…</div>;
  if (board.isError) return <Alert variant="danger">{apiError(board.error)}</Alert>;

  return (
    <>
      {message ? <Alert variant="success">{message}</Alert> : null}
      {move.isError || toggleHooked.isError ? (
        <Alert variant="danger">{apiError(move.error ?? toggleHooked.error)}</Alert>
      ) : null}

      <div className="packaging-board" aria-label="Planificación de envasado Devree">
        {(['A', 'B'] as const).map((dispenser) => {
          const dispenserCards = cards.filter((card) => card.dispenser === dispenser);

          return (
            <section
              className="planning-column packaging-column"
              key={dispenser}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => dropCard(dispenser, Math.max(cards.length - 1, 0))}
            >
              <header className="planning-column__header">
                <div>
                  <span>Devree</span>
                  <h2>Dosificadora {dispenser}</h2>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openCreate(dispenser)}
                  disabled={cards.length >= 4 || selectableTanks.length === 0}
                >
                  <Plus size={16} /> Agregar
                </Button>
              </header>

              <div className="packaging-column__current">
                {activeByDispenser[dispenser].map((tank) => {
                  const order = tank.activeLot?.packagingOrders[0];
                  return (
                    <article className="planning-card planning-card--current" key={tank.id}>
                      <div className="planning-card__status">
                        <CircleDot size={15} /> Envasando ahora
                      </div>
                      <strong>{tank.name}</strong>
                      <span>
                        OF {tank.activeLot?.manufacturingOrder} · OE {order?.packagingOrder}
                      </span>
                      <p>{order?.description || tank.activeLot?.description}</p>
                    </article>
                  );
                })}
              </div>

              <div className="planning-column__cards">
                {dispenserCards.map((card) => (
                  <article
                    className={`planning-card ${draggedCardId === card.id ? 'is-dragging' : ''}`}
                    draggable={!move.isPending}
                    key={card.id}
                    onDragStart={() => setDraggedCardId(card.id)}
                    onDragEnd={() => setDraggedCardId(null)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.stopPropagation();
                      dropCard(dispenser, card.position);
                    }}
                  >
                    <div className="planning-card__topline">
                      <span className="planning-card__order">
                        <GripVertical size={16} /> {card.position + 1}° posición
                      </span>
                      <div className="planning-card__actions">
                        <label className="packaging-hook-check">
                          <input
                            type="checkbox"
                            checked={card.hooked}
                            disabled={toggleHooked.isPending}
                            onChange={() => toggleHooked.mutate(card)}
                            aria-label={`${card.hooked ? 'Desmarcar' : 'Marcar'} ${card.tank.name} como enganchado`}
                          />
                        </label>
                        <button
                          onClick={() => openEdit(card)}
                          aria-label={`Editar ${card.tank.name}`}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => setDeleteCard(card)}
                          aria-label={`Eliminar ${card.tank.name}`}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                    <strong>{card.tank.name}</strong>
                    {card.tank.activeLot ? (
                      <>
                        <span>
                          OF {card.tank.activeLot.manufacturingOrder} · Material{' '}
                          {card.tank.activeLot.materialCode}
                        </span>
                        <p>{card.tank.activeLot.description}</p>
                      </>
                    ) : (
                      <span>Sin lote activo</span>
                    )}
                    {card.notes ? <p className="packaging-card__notes">{card.notes}</p> : null}
                    <div className="planning-card__move" aria-label="Mover tarjeta">
                      <button
                        disabled={card.position === 0 || move.isPending}
                        onClick={() =>
                          move.mutate({
                            cardId: card.id,
                            dispenser,
                            position: card.position - 1
                          })
                        }
                        aria-label="Subir en la planificación"
                      >
                        <ArrowUp size={15} />
                      </button>
                      <button
                        disabled={card.position === cards.length - 1 || move.isPending}
                        onClick={() =>
                          move.mutate({
                            cardId: card.id,
                            dispenser,
                            position: card.position + 1
                          })
                        }
                        aria-label="Bajar en la planificación"
                      >
                        <ArrowDown size={15} />
                      </button>
                      <button
                        disabled={move.isPending}
                        onClick={() =>
                          move.mutate({
                            cardId: card.id,
                            dispenser: dispenser === 'A' ? 'B' : 'A',
                            position: card.position
                          })
                        }
                        aria-label="Mover a la otra dosificadora"
                      >
                        <ArrowLeftRight size={15} />
                      </button>
                    </div>
                  </article>
                ))}

                {dispenserCards.length === 0 ? (
                  <div className="planning-column__empty">Sin tanques planificados</div>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>

      <Dialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? 'Editar tanque planificado' : `Agregar a dosificadora ${form.dispenser}`}
        description="Elegí el tanque y agregá sólo las indicaciones operativas necesarias."
        disableClose={save.isPending}
      >
        <form className="planning-form" onSubmit={submit}>
          <label>
            Tanque
            <select
              className="planning-select"
              autoFocus
              required
              value={form.tankId}
              onChange={(event) => setForm({ ...form, tankId: event.target.value })}
            >
              <option value="">Seleccionar tanque</option>
              {selectableTanks.map((tank) => (
                <option key={tank.id} value={tank.id}>
                  {tank.name} ·{' '}
                  {tank.activeLot ? `OF ${tank.activeLot.manufacturingOrder}` : tank.state}
                </option>
              ))}
            </select>
          </label>
          <label>
            Indicaciones (opcional)
            <Textarea
              maxLength={300}
              placeholder="Ej.: filtro 1, lavado de manifold, color 2"
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
            />
          </label>
          {save.isError ? <Alert variant="danger">{apiError(save.error)}</Alert> : null}
          <div className="planning-form__actions">
            <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={save.isPending || !form.tankId}>
              {save.isPending ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={Boolean(deleteCard)}
        onOpenChange={(open) => !open && setDeleteCard(null)}
        title="Eliminar de la planificación"
        description="El tanque deja de figurar en la cola de Devree."
        disableClose={remove.isPending}
      >
        <div className="planning-delete">
          <p>
            ¿Querés eliminar <strong>{deleteCard?.tank.name}</strong>?
          </p>
          {remove.isError ? <Alert variant="danger">{apiError(remove.error)}</Alert> : null}
          <div className="planning-form__actions">
            <Button variant="ghost" onClick={() => setDeleteCard(null)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={() => deleteCard && remove.mutate(deleteCard.id)}
              disabled={remove.isPending}
            >
              {remove.isPending ? 'Eliminando…' : 'Eliminar'}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
