import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCircle2, ClipboardList, ShieldAlert, ShieldCheck, X } from 'lucide-react';
import { api } from '../api/http';
import { getSessionUser } from '../../features/auth/session';

type NotificationType = 'STAGE_ASSIGNED' | 'STAGE_COMPLETED' | 'QUALITY_CONTROL_PENDING' | 'QUALITY_CONTROL_REJECTED';

interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  orderId?: string | null;
  orderStageId?: string | null;
  readAt?: string | null;
  createdAt: string;
}

const NOTIFICATION_ICON: Record<NotificationType, typeof ClipboardList> = {
  STAGE_ASSIGNED: ClipboardList,
  STAGE_COMPLETED: CheckCircle2,
  QUALITY_CONTROL_PENDING: ShieldCheck,
  QUALITY_CONTROL_REJECTED: ShieldAlert
};

interface NotificationResponse {
  items: NotificationItem[];
  unreadCount: number;
}

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
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [clickingId, setClickingId] = useState<string | null>(null);

  const notifications = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => (await api.get<NotificationResponse>('/notifications', { params: { limit: 30 } })).data,
    refetchInterval: 15000,
    refetchIntervalInBackground: true,
  });

  const readMutation = useMutation({
    mutationFn: async () => api.patch('/notifications/read-all'),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['notifications'] });
      queryClient.setQueryData<NotificationResponse>(['notifications'], current => current
        ? {
            unreadCount: 0,
            items: current.items.map(item => item.readAt
              ? item
              : { ...item, readAt: new Date().toISOString() })
          }
        : current
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  // Se marcan como leídas recién al CERRAR el popover, no al abrirlo: así el usuario
  // llega a ver cuáles eran nuevas (fondo distinto) mientras las está mirando.
  const closePopover = () => {
    setOpen(false);
    if ((notifications.data?.unreadCount ?? 0) > 0) {
      readMutation.mutate();
    }
  };

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) closePopover();
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closePopover();
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const toggle = () => {
    if (open) closePopover();
    else setOpen(true);
  };

  const unread = notifications.data?.unreadCount ?? 0;

  const handleNotificationClick = (item: NotificationItem) => {
    if (!item.orderId) return;
    if (clickingId) return;
    setClickingId(item.id);

    window.setTimeout(() => {
      setClickingId(null);
      closePopover();

    // Un operario no tiene acceso a /orders ni a /supervisor: siempre va a su propio panel,
    // resaltando la etapa puntual de la notificación (se lo asignaron o se la rechazaron).
    if (getSessionUser()?.role === 'OPERARIO') {
      navigate('/operator', { state: { highlightStageId: item.orderStageId ?? undefined } });
      return;
    }

    if (item.type === 'QUALITY_CONTROL_PENDING' || item.type === 'QUALITY_CONTROL_REJECTED') {
      navigate('/supervisor', { state: { highlightOrderId: item.orderId } });
      return;
    }

    navigate('/orders', {
      state: {
        tab: 'production',
        orderId: item.orderId,
        highlightOrderId: item.orderId,
        highlightStageId: item.orderStageId ?? undefined
      }
    });
    }, 180);
  };

  return (
    <div className="notification-center" ref={rootRef}>
      <button
        type="button"
        className={`notification-bell unstyled-button${open ? ' is-open' : ''}`}
        onClick={toggle}
        aria-label={unread ? `${unread} notificaciones nuevas` : 'Notificaciones'}
        aria-expanded={open}
        title="Notificaciones"
      >
        <Bell size={22} />
        {unread > 0 && <span className="notification-bell__dot">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <section className="notification-popover" aria-label="Lista de notificaciones">
          <header>
            <div>
              <h3>Notificaciones</h3>
              <p>{unread ? `${unread} nuevas` : 'Todo está visto'}</p>
            </div>
            <button type="button" className="unstyled-button" onClick={closePopover} aria-label="Cerrar notificaciones">
              <X size={18} />
            </button>
          </header>

          <div className="notification-list">
            {notifications.isLoading ? (
              <div className="notification-empty">Cargando notificaciones…</div>
            ) : notifications.isError ? (
              <div className="notification-empty notification-empty--error">No se pudieron cargar las notificaciones.</div>
            ) : !notifications.data?.items.length ? (
              <div className="notification-empty">
                <Bell size={24} />
                Todavía no tenés notificaciones.
              </div>
            ) : notifications.data.items.map(item => {
              const Icon = NOTIFICATION_ICON[item.type] ?? ClipboardList;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`notification-item unstyled-button${item.readAt ? '' : ' is-unread'}${clickingId === item.id ? ' is-clicking' : ''}`}
                  onClick={() => handleNotificationClick(item)}
                  disabled={!item.orderId}
                >
                  <span className={`notification-item__icon notification-item__icon--${item.type.toLowerCase()}`}>
                    <Icon size={18} />
                  </span>
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.message}</p>
                    <time>{relativeDate(item.createdAt)}</time>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
