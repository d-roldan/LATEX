import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Beaker, Bell, Boxes, Check, CheckCheck, Factory, Music2, Play, Volume2, VolumeX, X } from 'lucide-react';
import { api } from '../api/http';
import { NotificationSound, notificationSoundOptions, playNotificationSound, previewNotificationSound, unlockNotificationSound } from '../utils/notificationSound';
import { getSessionUser } from '../../features/auth/session';
import { useActivePlant } from '../../features/plant/useActivePlant';

type PlantSector = 'FABRICACION' | 'LABORATORIO' | 'ENVASADO';
type SectorFilter = PlantSector | 'TODOS';

interface NotificationItem {
  id: string;
  type: 'TANK_ACTION_REQUIRED';
  title: string;
  message: string;
  tankId: string;
  targetSector: PlantSector;
  readAt?: string | null;
  createdAt: string;
}

interface NotificationResponse {
  items: NotificationItem[];
  unreadCount: number;
}

const sectorMeta = {
  FABRICACION: { label: 'Fabricación', route: '/fabricacion', icon: Factory },
  LABORATORIO: { label: 'Laboratorio', route: '/laboratorio', icon: Beaker },
  ENVASADO: { label: 'Envasado', route: '/envasado', icon: Boxes }
} as const;

function relativeDate(value: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return 'Ahora';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'Ayer' : `Hace ${days} días`;
}

export function NotificationBell() {
  const { active } = useActivePlant();
  const user = getSessionUser();
  const isAdmin = user?.role === 'ADMIN';
  const userSector = (['FABRICACION', 'LABORATORIO', 'ENVASADO'] as const).find(sector => sector === user?.role);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);
  const knownIdsRef = useRef<Set<string> | null>(null);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<SectorFilter>(() => isAdmin ? 'TODOS' : userSector ?? 'TODOS');
  const [soundPickerOpen, setSoundPickerOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('plant.notifications.sound') !== 'off');
  const [selectedSound, setSelectedSound] = useState<NotificationSound>(() => {
    const stored = localStorage.getItem('plant.notifications.soundChoice');
    return notificationSoundOptions.some(option => option.id === stored) ? stored as NotificationSound : 'campana';
  });

  const notifications = useQuery({
    queryKey: ['plant-notifications', active?.code],
    enabled: Boolean(active),
    queryFn: async () => (await api.get<NotificationResponse>('/notifications', { params: { limit: 50, plant: active?.code } })).data,
    refetchInterval: 3000,
    refetchIntervalInBackground: true
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => api.patch(`/notifications/${id}/read`),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['plant-notifications'] });
      queryClient.setQueryData<NotificationResponse>(['plant-notifications'], current => current ? {
        unreadCount: Math.max(0, current.unreadCount - (current.items.some(item => item.id === id && !item.readAt) ? 1 : 0)),
        items: current.items.map(item => item.id === id ? { ...item, readAt: item.readAt ?? new Date().toISOString() } : item)
      } : current);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['plant-notifications'] })
  });

  const markAllRead = useMutation({
    mutationFn: async () => api.patch('/notifications/read-all', undefined, { params: { plant: active?.code } }),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['plant-notifications'] });
      queryClient.setQueryData<NotificationResponse>(['plant-notifications'], current => current ? {
        unreadCount: 0,
        items: current.items.map(item => ({ ...item, readAt: item.readAt ?? new Date().toISOString() }))
      } : current);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['plant-notifications'] })
  });

  useEffect(() => {
    if (!notifications.data) return;
    const currentIds = new Set(notifications.data.items.map(item => item.id));
    if (knownIdsRef.current === null) {
      knownIdsRef.current = currentIds;
      return;
    }
    const hasNewUnread = notifications.data.items.some(item => !item.readAt && !knownIdsRef.current?.has(item.id));
    knownIdsRef.current = currentIds;
    if (!hasNewUnread || !soundEnabled) return;

    playNotificationSound(selectedSound);
  }, [notifications.data, selectedSound, soundEnabled]);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  const unread = notifications.data?.unreadCount ?? 0;
  const counts = useMemo(() => Object.fromEntries(
    (Object.keys(sectorMeta) as PlantSector[]).map(sector => [sector, notifications.data?.items.filter(item => item.targetSector === sector && !item.readAt).length ?? 0])
  ) as Record<PlantSector, number>, [notifications.data]);
  const visibleItems = notifications.data?.items.filter(item => isAdmin
    ? filter === 'TODOS' || item.targetSector === filter
    : item.targetSector === userSector
  ) ?? [];

  const toggleSound = () => {
    const enabled = !soundEnabled;
    if (enabled) unlockNotificationSound();
    setSoundEnabled(enabled);
    localStorage.setItem('plant.notifications.sound', enabled ? 'on' : 'off');
  };

  const chooseSound = (sound: NotificationSound) => {
    setSelectedSound(sound);
    localStorage.setItem('plant.notifications.soundChoice', sound);
    void previewNotificationSound(sound);
  };

  const openNotification = (item: NotificationItem) => {
    if (!item.readAt) markRead.mutate(item.id);
    setOpen(false);
    navigate(`${sectorMeta[item.targetSector].route}?plant=${active?.code ?? 'LATEX'}`, {
      state: { highlightTankId: item.tankId, notificationId: item.id, highlightNonce: Date.now() }
    });
  };

  return (
    <div className="notification-center plant-notification-center" ref={rootRef}>
      <button type="button" className={`notification-bell unstyled-button${open ? ' is-open' : ''}${unread ? ' has-unread' : ''}`} onClick={() => setOpen(value => !value)} aria-label={unread ? `${unread} notificaciones nuevas` : 'Notificaciones'} aria-expanded={open} title="Notificaciones por sector">
        <Bell size={21}/>
        {unread > 0 ? <span className="notification-bell__dot">{unread > 99 ? '99+' : unread}</span> : null}
      </button>

      {open ? (
        <section className="notification-popover plant-notification-popover" aria-label="Notificaciones de planta">
          <header>
            <div><h3>Acciones pendientes</h3><p>{unread ? `${unread} sin leer` : 'Todo está visto'}</p></div>
            <div className="notification-header-actions">
              <button type="button" onClick={toggleSound} aria-label={soundEnabled ? 'Silenciar notificaciones' : 'Activar sonido'} title={soundEnabled ? 'Sonido activado' : 'Sonido desactivado'}>{soundEnabled ? <Volume2 size={18}/> : <VolumeX size={18}/>}</button>
              <button type="button" onClick={() => setSoundPickerOpen(value => !value)} aria-label="Elegir sonido de notificación" aria-expanded={soundPickerOpen} title="Elegir sonido"><Music2 size={18}/></button>
              {soundPickerOpen ? (
                <div className="notification-sound-picker" role="dialog" aria-label="Elegir sonido de notificación">
                  <div className="notification-sound-picker__head"><div><strong>Sonido de notificación</strong><span>Elegí un tono para escucharlo.</span></div><button type="button" onClick={() => setSoundPickerOpen(false)} aria-label="Cerrar selector"><X size={16}/></button></div>
                  <div className="notification-sound-picker__list">
                    {notificationSoundOptions.map(option => (
                      <button key={option.id} type="button" className={selectedSound === option.id ? 'is-selected' : ''} onClick={() => chooseSound(option.id)}>
                        <span className="notification-sound-picker__play">{selectedSound === option.id ? <Check size={16}/> : <Play size={15}/>}</span>
                        <span><strong>{option.label}</strong><small>{option.description}</small></span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              {unread ? <button type="button" onClick={() => markAllRead.mutate()} aria-label="Marcar todas como leídas" title="Marcar todas como leídas"><CheckCheck size={18}/></button> : null}
              <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar notificaciones"><X size={18}/></button>
            </div>
          </header>

          {isAdmin ? (
            <div className="notification-sector-tabs" role="tablist" aria-label="Filtrar por sector">
              <button className={filter === 'TODOS' ? 'is-active' : ''} onClick={() => setFilter('TODOS')}>Todos</button>
              {(Object.keys(sectorMeta) as PlantSector[]).map(sector => (
                <button key={sector} className={filter === sector ? 'is-active' : ''} onClick={() => setFilter(sector)}>{sectorMeta[sector].label}{counts[sector] ? <b>{counts[sector]}</b> : null}</button>
              ))}
            </div>
          ) : null}

          <div className="notification-list">
            {notifications.isLoading ? <div className="notification-empty">Cargando…</div> :
              notifications.isError ? <div className="notification-empty notification-empty--error">No se pudieron cargar las notificaciones.</div> :
              !visibleItems.length ? <div className="notification-empty"><Bell size={24}/>No hay acciones para este sector.</div> :
              visibleItems.map(item => {
                const meta = sectorMeta[item.targetSector];
                const Icon = meta.icon;
                return (
                  <button key={item.id} type="button" className={`notification-item unstyled-button sector-${item.targetSector.toLowerCase()}${item.readAt ? '' : ' is-unread'}`} onClick={() => openNotification(item)}>
                    <span className="notification-item__icon"><Icon size={18}/></span>
                    <div><span className="notification-sector-label">{meta.label}</span><strong>{item.title}</strong><p>{item.message}</p><time>{relativeDate(item.createdAt)}</time></div>
                  </button>
                );
              })}
          </div>
          <p className="notification-sound-status">{soundEnabled ? `Sonido activo: ${notificationSoundOptions.find(option => option.id === selectedSound)?.label}.` : 'El aviso sonoro está silenciado.'}</p>
        </section>
      ) : null}
      <span className="sr-only" aria-live="polite">{unread ? `${unread} acciones nuevas` : ''}</span>
    </div>
  );
}
