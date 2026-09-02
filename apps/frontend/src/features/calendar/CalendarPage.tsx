import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../shared/api/http';
import {
  ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon,
  Clock, X, Trash2, Edit2, Info, ClipboardList, Repeat
} from 'lucide-react';
import { Button } from '../../shared/ui/Button';
import { Dialog } from '../../shared/ui/Dialog';
import { Input, Textarea } from '../../shared/ui/Input';
import { Badge } from '../../shared/ui/Badge';

interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  type: 'manual' | 'work-order';
  externalId?: string;
  // Recurrencia
  recurrence?: RecurrenceRule;
  recurrenceId?: string; // ID del evento padre
  isRecurrenceInstance?: boolean;
}

interface RecurrenceRule {
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly';
  endDate?: string; // YYYY-MM-DD
  count?: number; // maximo de repeticiones
}

interface WorkOrder {
  id: string;
  code: string;
  title: string;
  commitmentDate?: string;
  productionStatus: string;
}

type ViewMode = 'month' | 'week';

const STORAGE_KEY = 'disal.calendar.events';
const LEGACY_STORAGE_KEY = 'disal.calendar.events';

const RECURRENCE_OPTIONS: { value: RecurrenceRule['frequency'] | 'none'; label: string }[] = [
  { value: 'none', label: 'No se repite' },
  { value: 'daily', label: 'Todos los dias' },
  { value: 'weekly', label: 'Cada semana' },
  { value: 'biweekly', label: 'Cada 2 semanas' },
  { value: 'monthly', label: 'Cada mes' }
];

function addDaysToDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function generateRecurrences(
  event: Omit<CalendarEvent, 'type'>,
  startDate: string,
  endDate: string
): Omit<CalendarEvent, 'type'>[] {
  if (!event.recurrence) return [];

  const instances: Omit<CalendarEvent, 'type'>[] = [];
  const rule = event.recurrence;
  const start = new Date(event.date + 'T12:00:00');
  const end = rule.endDate ? new Date(rule.endDate + 'T12:00:00') : new Date(endDate + 'T12:00:00');
  const viewStart = new Date(startDate + 'T00:00:00');
  const viewEnd = new Date(endDate + 'T23:59:59');
  const maxCount = rule.count || 365;

  let current = new Date(start);
  let count = 0;

  while (current <= end && current <= viewEnd && count < maxCount) {
    if (current > start && current >= viewStart) {
      const dateStr = current.toISOString().split('T')[0];
      instances.push({
        ...event,
        id: `${event.id}-rec-${dateStr}`,
        date: dateStr,
        recurrenceId: event.id,
        isRecurrenceInstance: true
      });
    }
    count++;

    switch (rule.frequency) {
      case 'daily':
        current.setDate(current.getDate() + 1);
        break;
      case 'weekly':
        current.setDate(current.getDate() + 7);
        break;
      case 'biweekly':
        current.setDate(current.getDate() + 14);
        break;
      case 'monthly':
        current.setMonth(current.getMonth() + 1);
        break;
    }
  }

  return instances;
}

function getWeekDays(date: Date): Date[] {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    days.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

function formatDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [manualEvents, setManualEvents] = useState<Omit<CalendarEvent, 'type'>[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Omit<CalendarEvent, 'type'> | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [isDayDetailOpen, setIsDayDetailOpen] = useState(false);

  const [form, setForm] = useState({
    title: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    time: '09:00',
    recurrenceFreq: 'none' as RecurrenceRule['frequency'] | 'none',
    recurrenceEndDate: '',
    recurrenceCount: 0
  });

  const ordersQuery = useQuery({
    queryKey: ['orders-calendar'],
    queryFn: async () => (await api.get<WorkOrder[]>('/orders', { params: { tab: 'production' } })).data
  });

  // Load manual events
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
    if (saved) {
      try {
        setManualEvents(JSON.parse(saved));
        localStorage.setItem(STORAGE_KEY, saved);
        localStorage.removeItem(LEGACY_STORAGE_KEY);
      } catch (e) { console.error(e); }
    }
  }, []);

  // Save manual events
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(manualEvents));
  }, [manualEvents]);

  const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  const firstDayOfMonth = (y: number, m: number) => new Date(y, m, 1).getDay();

  const handlePrevMonth = () => {
    if (viewMode === 'week') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() - 7));
    } else {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
    }
  };
  const handleNextMonth = () => {
    if (viewMode === 'week') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + 7));
    } else {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
    }
  };
  const handleToday = () => setCurrentDate(new Date());

  const monthName = currentDate.toLocaleString('es-ES', { month: 'long' });
  const year = currentDate.getFullYear();

  // Rango visible del calendario para generar recurrencias
  const viewRange = useMemo(() => {
    if (viewMode === 'week') {
      const weekDays = getWeekDays(currentDate);
      return {
        start: formatDateStr(weekDays[0]),
        end: formatDateStr(weekDays[6])
      };
    }
    const currYear = currentDate.getFullYear();
    const currMonth = currentDate.getMonth();
    const firstDay = new Date(currYear, currMonth, 1);
    const startOffset = firstDay.getDay();
    const viewStart = new Date(firstDay);
    viewStart.setDate(viewStart.getDate() - startOffset);
    const viewEnd = new Date(viewStart);
    viewEnd.setDate(viewEnd.getDate() + 41);
    return { start: formatDateStr(viewStart), end: formatDateStr(viewEnd) };
  }, [currentDate, viewMode]);

  const allEvents = useMemo(() => {
    const woEvents: CalendarEvent[] = (ordersQuery.data || [])
      .filter(wo => wo.commitmentDate)
      .map(wo => ({
        id: wo.id,
        title: `OP: ${wo.code} - ${wo.title}`,
        description: `Estado: ${wo.productionStatus}`,
        date: wo.commitmentDate!.split('T')[0],
        time: '08:00',
        type: 'work-order' as const,
        externalId: wo.id
      }));

    const manualEventsTyped: CalendarEvent[] = manualEvents.map(e => ({ ...e, type: 'manual' as const }));

    // Generar recurrencias
    const recurrences: CalendarEvent[] = manualEvents
      .filter(e => e.recurrence)
      .flatMap(e => generateRecurrences(e, viewRange.start, viewRange.end))
      .map(e => ({ ...e, type: 'manual' as const }));

    return [...woEvents, ...manualEventsTyped, ...recurrences];
  }, [ordersQuery.data, manualEvents, viewRange]);

  const calendarDays = useMemo(() => {
    if (viewMode === 'week') {
      const weekDays = getWeekDays(currentDate);
      return weekDays.map(d => {
        const dateStr = formatDateStr(d);
        return {
          day: d.getDate(),
          date: dateStr,
          isPadding: false,
          events: allEvents.filter(e => e.date === dateStr).sort((a, b) => a.time.localeCompare(b.time)),
          key: `week-${dateStr}`
        };
      });
    }

    const currYear = currentDate.getFullYear();
    const currMonth = currentDate.getMonth();
    const totalDays = daysInMonth(currYear, currMonth);
    const startOffset = firstDayOfMonth(currYear, currMonth);

    const prevMonthDate = new Date(currYear, currMonth - 1);
    const prevMonthTotalDays = daysInMonth(prevMonthDate.getFullYear(), prevMonthDate.getMonth());

    const days = [];

    for (let i = startOffset - 1; i >= 0; i--) {
      const day = prevMonthTotalDays - i;
      const dateStr = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      days.push({ day, date: dateStr, isPadding: true, events: allEvents.filter(e => e.date === dateStr), key: `prev-${day}` });
    }

    for (let i = 1; i <= totalDays; i++) {
      const dateStr = `${currYear}-${String(currMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      days.push({ day: i, date: dateStr, isPadding: false, events: allEvents.filter(e => e.date === dateStr).sort((a, b) => a.time.localeCompare(b.time)), key: `curr-${i}` });
    }

    const nextMonthDate = new Date(currYear, currMonth + 1);
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const dateStr = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      days.push({ day: i, date: dateStr, isPadding: true, events: allEvents.filter(e => e.date === dateStr), key: `next-${i}` });
    }

    return days;
  }, [currentDate, allEvents, viewMode]);

  const handleOpenCreate = (date?: string) => {
    setEditingEvent(null);
    setForm({ title: '', description: '', date: date || new Date().toISOString().split('T')[0], time: '09:00', recurrenceFreq: 'none', recurrenceEndDate: '', recurrenceCount: 0 });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (event: CalendarEvent) => {
    if (event.type === 'work-order') return alert(`Orden de Producción: ${event.title}. Gestionála desde Control de Producción.`);
    if (event.isRecurrenceInstance) {
      // Buscar evento padre
      const parent = manualEvents.find(e => e.id === event.recurrenceId);
      if (parent) {
        setEditingEvent(parent);
        setForm({
          title: parent.title,
          description: parent.description,
          date: parent.date,
          time: parent.time,
          recurrenceFreq: parent.recurrence?.frequency || 'none',
          recurrenceEndDate: parent.recurrence?.endDate || '',
          recurrenceCount: parent.recurrence?.count || 0
        });
        setIsModalOpen(true);
        return;
      }
    }
    setEditingEvent(event as Omit<CalendarEvent, 'type'>);
    setForm({
      title: event.title,
      description: event.description,
      date: event.date,
      time: event.time,
      recurrenceFreq: event.recurrence?.frequency || 'none',
      recurrenceEndDate: event.recurrence?.endDate || '',
      recurrenceCount: event.recurrence?.count || 0
    });
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const recurrence: RecurrenceRule | undefined = form.recurrenceFreq !== 'none'
      ? {
        frequency: form.recurrenceFreq as RecurrenceRule['frequency'],
        endDate: form.recurrenceEndDate || undefined,
        count: form.recurrenceCount || undefined
      }
      : undefined;

    if (editingEvent) {
      setManualEvents(manualEvents.map(ev => ev.id === editingEvent.id
        ? { ...ev, title: form.title, description: form.description, date: form.date, time: form.time, recurrence }
        : ev
      ));
    } else {
      const newEvent = {
        id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Date.now().toString(),
        title: form.title,
        description: form.description,
        date: form.date,
        time: form.time,
        recurrence
      };
      setManualEvents([...manualEvents, newEvent]);
    }
    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    if (confirm('Eliminar evento y todas sus repeticiones?')) {
      setManualEvents(manualEvents.filter(e => e.id !== id));
    }
  };

  const handleDayClick = (dateStr: string) => {
    setSelectedDay(dateStr);
    setIsDayDetailOpen(true);
  };

  const todayStr = new Date().toISOString().split('T')[0];

  const selectedDayEvents = useMemo(() => {
    if (!selectedDay) return [];
    return allEvents.filter(e => e.date === selectedDay).sort((a, b) => a.time.localeCompare(b.time));
  }, [selectedDay, allEvents]);

  // Hours for week view
  const HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 7:00 to 20:00

  return (
    <div className="calendar-page-container stack-lg page-enter">
      <style>{`
        .calendar-grid-fixed {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          background: var(--border);
          gap: 1px;
          border: 1px solid var(--border);
          border-radius: 1rem;
          overflow: hidden;
          box-shadow: var(--shadow-sm);
        }
        .calendar-day-cell {
          background: var(--panel);
          height: ${viewMode === 'week' ? '500px' : '140px'};
          min-width: 0;
          display: flex;
          flex-direction: column;
          padding: 0.6rem;
          transition: background 0.2s;
          position: relative;
          cursor: pointer;
        }
        .calendar-day-cell:hover {
          background: color-mix(in srgb, var(--primary) 3%, var(--panel) 97%);
        }
        .calendar-day-cell.is-padding {
          opacity: 0.4;
          background: color-mix(in srgb, var(--background), transparent 80%);
        }
        .calendar-day-cell.is-today {
          background: color-mix(in srgb, var(--primary) 5%, var(--panel));
        }
        .calendar-day-cell.is-today .day-number {
          background: var(--primary);
          color: white;
          width: 26px;
          height: 26px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          font-size: 0.8rem;
        }
        .day-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 0.4rem;
        }
        .day-number {
          font-size: 0.85rem;
          font-weight: 700;
          color: var(--ink-soft);
        }
        .events-container {
          flex: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 3px;
          padding-right: 2px;
        }
        .events-container::-webkit-scrollbar { width: 3px; }
        .events-container::-webkit-scrollbar-thumb { background: var(--border); border-radius: 10px; }

        .calendar-event-pill {
          font-size: 0.68rem;
          padding: 2px 6px;
          border-radius: 4px;
          cursor: pointer;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          display: flex;
          align-items: center;
          gap: 3px;
          transition: transform 0.1s, box-shadow 0.15s;
          border: 1px solid transparent;
        }
        .calendar-event-pill:hover { transform: translateY(-1px); box-shadow: var(--shadow-sm); }
        .event-wo {
          background: color-mix(in srgb, var(--primary) 15%, var(--panel));
          color: var(--primary);
          border-left: 3px solid var(--primary);
        }
        .event-manual {
          background: color-mix(in srgb, var(--color-success) 15%, var(--panel));
          color: var(--color-success);
          border-left: 3px solid var(--color-success);
        }
        .event-recurring {
          position: relative;
        }
        .event-recurring::after {
          content: '';
          position: absolute;
          top: 2px;
          right: 4px;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--color-industrial);
        }

        .view-toggle {
          display: flex;
          background: var(--background);
          border-radius: 0.5rem;
          border: 1px solid var(--border);
          overflow: hidden;
        }
        .view-toggle button {
          padding: 0.4rem 0.8rem;
          border: none;
          background: transparent;
          cursor: pointer;
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--ink-soft);
          transition: all 0.15s;
        }
        .view-toggle button.active {
          background: var(--primary);
          color: white;
        }

        .day-event-count {
          position: absolute;
          top: 4px;
          right: 6px;
          font-size: 0.6rem;
          background: var(--primary);
          color: white;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
        }

        @media (max-width: 768px) {
          .calendar-grid-fixed {
            grid-template-columns: 1fr;
            background: transparent;
            border: none;
            gap: 0.75rem;
          }
          .calendar-day-cell {
            height: auto;
            min-height: 60px;
            border-radius: 0.75rem;
            border: 1px solid var(--border);
            box-shadow: var(--shadow-sm);
          }
          .calendar-day-cell.is-padding { display: none; }
          .calendar-weekday-header { display: none; }
          .events-container { overflow-y: visible; }
        }
      `}</style>

      <header className="page-hero panel stagger-1">
        <div className="page-hero__left">
          <p className="eyebrow" style={{ color: 'var(--primary)' }}>AGENDA CENTRALIZADA</p>
          <h2 className="page-hero__title">Planificacion y Eventos</h2>
          <p className="page-hero__sub">Sincronización de entregas de planta y agenda institucional.</p>
        </div>
        <div className="page-hero__actions">
          <div className="view-toggle">
            <button className={viewMode === 'month' ? 'active' : ''} onClick={() => setViewMode('month')}>Mes</button>
            <button className={viewMode === 'week' ? 'active' : ''} onClick={() => setViewMode('week')}>Semana</button>
          </div>
          <Button variant="secondary" onClick={handleToday} style={{ gap: '0.5rem' }}>
            <Clock size={16} /> Hoy
          </Button>
          <Button onClick={() => handleOpenCreate()}>+ Nuevo Evento</Button>
        </div>
      </header>

      <section className="panel stagger-2" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
            <h2 style={{ textTransform: 'capitalize', margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>
              {viewMode === 'week'
                ? `Semana del ${currentDate.getDate()} ${monthName}`
                : `${monthName}`
              }
              {' '}<span style={{ color: 'var(--ink-soft)', fontWeight: 400 }}>{year}</span>
            </h2>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Badge variant="primary" style={{ fontSize: '0.7rem' }}>OTs</Badge>
              <Badge variant="success">Manuales</Badge>
              <Badge variant="info">Repetitivos</Badge>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--background)', padding: '4px', borderRadius: '0.6rem', border: '1px solid var(--border)' }}>
            <Button variant="ghost" size="sm" onClick={handlePrevMonth}><ChevronLeft size={20} /></Button>
            <Button variant="ghost" size="sm" onClick={handleNextMonth}><ChevronRight size={20} /></Button>
          </div>
        </div>

        <div className="calendar-grid-fixed">
          {['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'].map(d => (
            <div key={d} className="calendar-weekday-header" style={{ background: 'var(--background)', padding: '0.75rem', textAlign: 'center', fontSize: '0.7rem', fontWeight: 800, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {d}
            </div>
          ))}
          {calendarDays.map((d) => (
            <div
              key={d.key}
              className={`calendar-day-cell ${d.isPadding ? 'is-padding' : ''} ${d.date === todayStr ? 'is-today' : ''}`}
              onClick={() => !d.isPadding && handleDayClick(d.date)}
              onDoubleClick={() => !d.isPadding && handleOpenCreate(d.date)}
            >
              <div className="day-header">
                <span className="day-number">{d.day}</span>
                {d.events.length > 3 && viewMode === 'month' && (
                  <span className="day-event-count">{d.events.length}</span>
                )}
              </div>
              <div className="events-container">
                {(viewMode === 'month' ? d.events.slice(0, 3) : d.events).map(event => (
                  <div
                    key={event.id}
                    className={`calendar-event-pill ${event.type === 'work-order' ? 'event-wo' : 'event-manual'} ${event.isRecurrenceInstance || event.recurrence ? 'event-recurring' : ''}`}
                    onClick={(e) => { e.stopPropagation(); handleOpenEdit(event); }}
                    title={`${event.time} - ${event.title}${event.recurrence || event.isRecurrenceInstance ? ' (Repetitivo)' : ''}`}
                  >
                    {event.type === 'work-order' ? <ClipboardList size={10} /> : event.recurrence || event.isRecurrenceInstance ? <Repeat size={10} /> : <CalendarIcon size={10} />}
                    <span style={{ fontWeight: 700, fontSize: '0.62rem', marginRight: '1px' }}>{event.time}</span>
                    <span style={{ fontWeight: 500 }}>{event.title}</span>
                  </div>
                ))}
                {d.events.length > 3 && viewMode === 'month' && (
                  <span style={{ fontSize: '0.65rem', color: 'var(--primary)', fontWeight: 600, cursor: 'pointer', paddingLeft: '4px' }}>
                    +{d.events.length - 3} mas
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* MODAL: DETALLE DEL DIA */}
      <Dialog open={isDayDetailOpen} onOpenChange={setIsDayDetailOpen} title={selectedDay ? `Eventos del ${new Date(selectedDay + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}` : 'Detalle del dia'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingTop: '0.5rem' }}>
          {selectedDayEvents.length === 0 ? (
            <p style={{ color: 'var(--ink-soft)', textAlign: 'center', padding: '2rem 0' }}>No hay eventos para este dia.</p>
          ) : (
            selectedDayEvents.map(event => (
              <div key={event.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '0.6rem 0.8rem', borderRadius: '0.5rem',
                background: event.type === 'work-order' ? 'color-mix(in srgb, var(--primary) 10%, var(--panel) 90%)' : 'color-mix(in srgb, var(--color-success) 10%, var(--panel) 90%)',
                border: `1px solid ${event.type === 'work-order' ? 'color-mix(in srgb, var(--primary) 25%, transparent 75%)' : 'color-mix(in srgb, var(--color-success) 25%, transparent 75%)'}`
              }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                    {event.time} — {event.title}
                    {(event.recurrence || event.isRecurrenceInstance) && (
                      <Repeat size={12} style={{ marginLeft: '4px', verticalAlign: 'middle', color: 'var(--color-industrial)' }} />
                    )}
                  </div>
                  {event.description && <div style={{ fontSize: '0.75rem', color: 'var(--ink-soft)', marginTop: '2px' }}>{event.description}</div>}
                </div>
                {event.type === 'manual' && !event.isRecurrenceInstance && (
                  <div style={{ display: 'flex', gap: '0.3rem' }}>
                    <Button variant="secondary" size="sm" onClick={() => { setIsDayDetailOpen(false); handleOpenEdit(event); }}>
                      <Edit2 size={14} />
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(event.id)}>
                      <Trash2 size={14} />
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
            <Button onClick={() => { setIsDayDetailOpen(false); handleOpenCreate(selectedDay || undefined); }}>+ Agregar Evento</Button>
            <Button variant="secondary" onClick={() => setIsDayDetailOpen(false)}>Cerrar</Button>
          </div>
        </div>
      </Dialog>

      {/* MODAL: CREAR/EDITAR EVENTO */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen} title={editingEvent ? 'Editar Evento' : 'Nuevo Evento'}>
        <form onSubmit={handleSubmit} className="stack-md" style={{ paddingTop: '1rem' }}>
          <label className="form-label">Titulo del Evento
            <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required placeholder="Resumen del evento..." />
          </label>
          <div className="form-grid-2">
            <label className="form-label">Fecha
              <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required />
            </label>
            <label className="form-label">Hora
              <Input type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} required />
            </label>
          </div>
          <label className="form-label">Notas Adicionales
            <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Instrucciones, recordatorios, etc." rows={3} />
          </label>

          {/* Recurrencia */}
          <div style={{ background: 'color-mix(in srgb, var(--color-industrial) 5%, var(--panel) 95%)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid color-mix(in srgb, var(--color-industrial) 20%, transparent)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <Repeat size={16} style={{ color: 'var(--color-industrial)' }} />
              <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Repetir evento</span>
            </div>
            <select
              value={form.recurrenceFreq}
              onChange={e => setForm({ ...form, recurrenceFreq: e.target.value as typeof form.recurrenceFreq })}
              style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border)', borderRadius: '0.4rem', background: 'var(--panel)', marginBottom: '0.5rem' }}
            >
              {RECURRENCE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            {form.recurrenceFreq !== 'none' && (
              <div className="form-grid-2" style={{ marginTop: '0.5rem' }}>
                <label style={{ fontSize: '0.75rem' }}>Repetir hasta (fecha)
                  <Input type="date" value={form.recurrenceEndDate} onChange={e => setForm({ ...form, recurrenceEndDate: e.target.value })} />
                </label>
                <label style={{ fontSize: '0.75rem' }}>O maximo N veces
                  <Input type="number" min="0" max="365" value={form.recurrenceCount} onChange={e => setForm({ ...form, recurrenceCount: Number(e.target.value) })} placeholder="Ej: 10" />
                </label>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginTop: '1.5rem', borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
            {editingEvent && (
              <Button type="button" variant="destructive" onClick={() => { handleDelete(editingEvent.id); setIsModalOpen(false); }}>
                <Trash2 size={16} /> Eliminar
              </Button>
            )}
            <div style={{ display: 'flex', gap: '0.75rem', marginLeft: 'auto' }}>
              <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
              <Button type="submit">{editingEvent ? 'Guardar Cambios' : 'Agendar Evento'}</Button>
            </div>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
