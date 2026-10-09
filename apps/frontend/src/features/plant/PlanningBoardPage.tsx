import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
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
import { Input, Textarea } from '../../shared/ui/Input';
import { useActivePlant } from './useActivePlant';
import { getSessionUser } from '../auth/session';
import { PackagingPlanningBoard } from './PackagingPlanningBoard';
import './PlanningBoardPage.css';

interface PlanningCard {
  id: string;
  manufacturingOrder: string;
  materialCode: string;
  description: string;
  position: number;
  updatedAt: string;
}

interface PlanningTank {
  id: string;
  number: number;
  name: string;
  capacityKg: number | null;
  state: string;
  activeLot: null | {
    id: string;
    manufacturingOrder: string;
    materialCode: string;
    description: string;
  };
  planningCards: PlanningCard[];
}

interface PlanningBoard {
  plant: { id: string; code: string; name: string };
  tanks: PlanningTank[];
}

interface CardForm {
  tankId: string;
  manufacturingOrder: string;
  materialCode: string;
  description: string;
}

const emptyForm: CardForm = {
  tankId: '',
  manufacturingOrder: '',
  materialCode: '',
  description: ''
};

function apiError(error: unknown) {
  if (typeof error === 'object' && error && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string | string[] } } }).response;
    const message = response?.data?.message;
    if (Array.isArray(message)) return message.join('. ');
    if (message) return message;
  }
  return 'No se pudo completar la operación. Volvé a intentarlo.';
}

export function PlanningBoardPage() {
  const { active, plants, select, isLoading: plantsLoading } = useActivePlant();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<PlanningCard | null>(null);
  const [form, setForm] = useState<CardForm>(emptyForm);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteCard, setDeleteCard] = useState<PlanningCard | null>(null);
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [view, setView] = useState<'manufacturing' | 'packaging'>(() =>
    getSessionUser()?.role === 'ENVASADO' ? 'packaging' : 'manufacturing'
  );

  const isLatex = active?.code === 'LATEX';
  const board = useQuery({
    queryKey: ['plant-planning-board', active?.code],
    queryFn: async () =>
      (await api.get<PlanningBoard>(`/plants/${active!.code}/planning-board`)).data,
    enabled: isLatex,
    refetchInterval: 15_000
  });

  const tanks = useMemo(() => board.data?.tanks ?? [], [board.data?.tanks]);
  const cardsById = useMemo(
    () => new Map(tanks.flatMap((tank) => tank.planningCards.map((card) => [card.id, card]))),
    [tanks]
  );

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ['plant-planning-board', active?.code] });

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        manufacturingOrder: form.manufacturingOrder,
        materialCode: form.materialCode,
        description: form.description
      };
      if (editing) {
        await api.patch(`/plants/LATEX/planning-cards/${editing.id}`, payload);
      } else {
        await api.post('/plants/LATEX/planning-cards', { ...payload, tankId: form.tankId });
      }
    },
    onSuccess: async () => {
      setDialogOpen(false);
      setMessage(editing ? 'Tarjeta actualizada.' : 'Tarjeta agregada a la planificación.');
      await refresh();
    }
  });

  const move = useMutation({
    mutationFn: async ({
      cardId,
      tankId,
      position
    }: {
      cardId: string;
      tankId: string;
      position: number;
    }) => {
      await api.patch(`/plants/LATEX/planning-cards/${cardId}/position`, { tankId, position });
    },
    onSuccess: refresh
  });

  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/plants/LATEX/planning-cards/${id}`),
    onSuccess: async () => {
      setDeleteCard(null);
      setMessage('Tarjeta eliminada de la planificación.');
      await refresh();
    }
  });

  const openCreate = (tankId: string) => {
    setEditing(null);
    setForm({ ...emptyForm, tankId });
    setMessage(null);
    setDialogOpen(true);
  };

  const openEdit = (tankId: string, card: PlanningCard) => {
    setEditing(card);
    setForm({
      tankId,
      manufacturingOrder: card.manufacturingOrder,
      materialCode: card.materialCode,
      description: card.description
    });
    setMessage(null);
    setDialogOpen(true);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    save.mutate();
  };

  const moveToAdjacentTank = (tankIndex: number, card: PlanningCard, direction: -1 | 1) => {
    const target = tanks[tankIndex + direction];
    if (target)
      move.mutate({ cardId: card.id, tankId: target.id, position: target.planningCards.length });
  };

  const dropCard = (tankId: string, position: number) => {
    if (!draggedCardId || !cardsById.has(draggedCardId)) return;
    const sourceTank = tanks.find((tank) =>
      tank.planningCards.some((card) => card.id === draggedCardId)
    );
    const sourcePosition = sourceTank?.planningCards.findIndex((card) => card.id === draggedCardId);
    const adjustedPosition =
      sourceTank?.id === tankId && sourcePosition !== undefined && sourcePosition < position
        ? position - 1
        : position;
    move.mutate({ cardId: draggedCardId, tankId, position: adjustedPosition });
    setDraggedCardId(null);
  };

  if (plantsLoading || !active) {
    return <div className="planning-state">Cargando plantas…</div>;
  }

  if (!isLatex) {
    const latexAvailable = plants.some((plant) => plant.code === 'LATEX');
    return (
      <section className="planning-state">
        <h1>Pizarra de planificación</h1>
        <p>Esta primera versión está habilitada únicamente para la planta Látex.</p>
        {latexAvailable ? (
          <Button onClick={() => void select('LATEX')}>Ir a la pizarra de Látex</Button>
        ) : null}
      </section>
    );
  }

  return (
    <section className="planning-page">
      <header className="plant-page-head planning-page-head">
        <div>
          <h1>Pizarra de planificación</h1>
        </div>
      </header>

      <div className="planning-tabs" role="tablist" aria-label="Tipo de planificación">
        <button
          type="button"
          role="tab"
          aria-selected={view === 'manufacturing'}
          className={view === 'manufacturing' ? 'is-active' : ''}
          onClick={() => setView('manufacturing')}
        >
          Pizarra de fabricación
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'packaging'}
          className={view === 'packaging' ? 'is-active' : ''}
          onClick={() => setView('packaging')}
        >
          Pizarra de envasado
        </button>
      </div>

      {view === 'manufacturing' ? (
        <>
          {message ? <Alert variant="success">{message}</Alert> : null}
          {board.isError || move.isError ? (
            <Alert variant="danger">{apiError(board.error ?? move.error)}</Alert>
          ) : null}
          {board.isLoading ? <div className="planning-state">Cargando pizarra…</div> : null}

          {board.data ? (
            <div className="planning-board" aria-label="Planificación por tanque">
              {tanks.map((tank, tankIndex) => (
                <section
                  className="planning-column"
                  key={tank.id}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => dropCard(tank.id, tank.planningCards.length)}
                >
                  <header className="planning-column__header">
                    <div>
                      <h2>{tank.name}</h2>
                      <span>
                        {tank.capacityKg
                          ? `${tank.capacityKg.toLocaleString('es-AR')} kg`
                          : 'Sin capacidad informada'}
                      </span>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => openCreate(tank.id)}>
                      <Plus size={16} /> Agregar
                    </Button>
                  </header>

                  <div className="planning-column__cards">
                    {tank.activeLot ? (
                      <article className="planning-card planning-card--current">
                        <div className="planning-card__status">
                          <CircleDot size={15} /> En curso · {tank.state}
                        </div>
                        <strong>OF {tank.activeLot.manufacturingOrder}</strong>
                        <span>Material {tank.activeLot.materialCode}</span>
                        <p>{tank.activeLot.description}</p>
                      </article>
                    ) : (
                      <div className="planning-column__empty-current">Tanque sin lote activo</div>
                    )}

                    {tank.planningCards.map((card, cardIndex) => (
                      <div
                        key={card.id}
                        className="planning-drop-zone"
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => {
                          event.stopPropagation();
                          dropCard(tank.id, cardIndex);
                        }}
                      >
                        <article
                          className={`planning-card ${draggedCardId === card.id ? 'is-dragging' : ''}`}
                          draggable={!move.isPending}
                          onDragStart={() => setDraggedCardId(card.id)}
                          onDragEnd={() => setDraggedCardId(null)}
                        >
                          <div className="planning-card__topline">
                            <span className="planning-card__order">
                              <GripVertical size={16} /> Próximo {cardIndex + 1}
                            </span>
                            <div className="planning-card__actions">
                              <button
                                onClick={() => openEdit(tank.id, card)}
                                aria-label={`Editar OF ${card.manufacturingOrder}`}
                              >
                                <Pencil size={15} />
                              </button>
                              <button
                                onClick={() => setDeleteCard(card)}
                                aria-label={`Eliminar OF ${card.manufacturingOrder}`}
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </div>
                          <strong>OF {card.manufacturingOrder}</strong>
                          <span>Material {card.materialCode}</span>
                          <p>{card.description}</p>
                          <div className="planning-card__move" aria-label="Mover tarjeta">
                            <button
                              disabled={tankIndex === 0 || move.isPending}
                              onClick={() => moveToAdjacentTank(tankIndex, card, -1)}
                              aria-label="Mover al tanque anterior"
                            >
                              <ArrowLeft size={15} />
                            </button>
                            <button
                              disabled={cardIndex === 0 || move.isPending}
                              onClick={() =>
                                move.mutate({
                                  cardId: card.id,
                                  tankId: tank.id,
                                  position: cardIndex - 1
                                })
                              }
                              aria-label="Subir en la planificación"
                            >
                              <ArrowUp size={15} />
                            </button>
                            <button
                              disabled={
                                cardIndex === tank.planningCards.length - 1 || move.isPending
                              }
                              onClick={() =>
                                move.mutate({
                                  cardId: card.id,
                                  tankId: tank.id,
                                  position: cardIndex + 1
                                })
                              }
                              aria-label="Bajar en la planificación"
                            >
                              <ArrowDown size={15} />
                            </button>
                            <button
                              disabled={tankIndex === tanks.length - 1 || move.isPending}
                              onClick={() => moveToAdjacentTank(tankIndex, card, 1)}
                              aria-label="Mover al tanque siguiente"
                            >
                              <ArrowRight size={15} />
                            </button>
                          </div>
                        </article>
                      </div>
                    ))}
                    {tank.planningCards.length === 0 ? (
                      <button
                        className="planning-column__empty"
                        onClick={() => openCreate(tank.id)}
                      >
                        <Plus size={18} /> Agregar la próxima fabricación
                      </button>
                    ) : null}
                  </div>
                </section>
              ))}
            </div>
          ) : null}

          <Dialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            title={editing ? 'Editar tarjeta' : 'Nueva tarjeta'}
            description={
              editing
                ? 'Actualizá la información del lote planificado.'
                : `Agregá el próximo lote para ${tanks.find((tank) => tank.id === form.tankId)?.name ?? 'el tanque'}.`
            }
            disableClose={save.isPending}
          >
            <form className="planning-form" onSubmit={submit}>
              <label>
                OF (8 dígitos)
                <Input
                  autoFocus
                  inputMode="numeric"
                  pattern="\d{8}"
                  maxLength={8}
                  required
                  value={form.manufacturingOrder}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      manufacturingOrder: event.target.value.replace(/\D/g, '').slice(0, 8)
                    })
                  }
                />
              </label>
              <label>
                Material (6 dígitos)
                <Input
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  required
                  value={form.materialCode}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      materialCode: event.target.value.replace(/\D/g, '').slice(0, 6)
                    })
                  }
                />
              </label>
              <label>
                Descripción
                <Textarea
                  maxLength={180}
                  required
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                />
              </label>
              {save.isError ? <Alert variant="danger">{apiError(save.error)}</Alert> : null}
              <div className="planning-form__actions">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setDialogOpen(false)}
                  disabled={save.isPending}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={save.isPending}>
                  {save.isPending ? 'Guardando…' : 'Guardar tarjeta'}
                </Button>
              </div>
            </form>
          </Dialog>

          <Dialog
            open={Boolean(deleteCard)}
            onOpenChange={(open) => !open && setDeleteCard(null)}
            title="Eliminar tarjeta"
            description="Esta acción quita el lote de la planificación; no afecta lotes ya iniciados."
            disableClose={remove.isPending}
          >
            <div className="planning-delete">
              <p>
                ¿Querés eliminar la OF <strong>{deleteCard?.manufacturingOrder}</strong>?
              </p>
              {remove.isError ? <Alert variant="danger">{apiError(remove.error)}</Alert> : null}
              <div className="planning-form__actions">
                <Button
                  variant="ghost"
                  onClick={() => setDeleteCard(null)}
                  disabled={remove.isPending}
                >
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
      ) : (
        <PackagingPlanningBoard />
      )}
    </section>
  );
}
