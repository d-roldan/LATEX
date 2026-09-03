import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Clock3, Radio, RefreshCw, WifiOff } from 'lucide-react';
import { api } from '../../shared/api/http';
import { Button } from '../../shared/ui/Button';
import { Dialog } from '../../shared/ui/Dialog';
import { Input } from '../../shared/ui/Input';

type Sector = 'fabricacion' | 'laboratorio' | 'envasado' | 'monitoreo';
type TankState = 'VACIO' | 'FABRICANDO' | 'LABORATORIO' | 'AJUSTE' | 'RECHAZADO' | 'APROBADO' | 'ENVASANDO' | 'FUERA_DE_SERVICIO';
type Action = 'start' | 'sendLab' | 'quality' | 'packaging' | 'newOrder' | 'correctOrder' | 'finish' | 'emptyRejected' | 'serviceOut' | 'serviceIn' | 'correctLot';
type PendingRequest = { path: string; method: 'post' | 'patch'; payload: Record<string, unknown> };

interface Tank {
  id: string; number: number; name: string; capacityKg: number | null; scaleKey: string; state: TankState; version: number;
  serviceReason?: string | null;
  stateStartedAt: string; stateElapsedSeconds: number | null; stateTargetSeconds: number | null; stateAttention: 'OK' | 'WARNING' | 'CRITICAL';
  telemetry: { grossKg: number | null; netKg: number | null; measuredAt: string | null; online: boolean };
  activeLot: null | {
    id: string; manufacturingOrder: string; materialCode: string; description: string; specificWeight: number | null;
    packagingOrders: Array<{ packagingOrder: string; line: string; format: string; startedAt: string }>;
  };
}

interface Config { lines: string[]; formats: string[]; adjustmentReasons: string[] }

const stateLabel: Record<TankState, string> = {
  VACIO: 'Vacío', FABRICANDO: 'Fabricando', LABORATORIO: 'Laboratorio', AJUSTE: 'Ajuste',
  RECHAZADO: 'Rechazado', APROBADO: 'Aprobado', ENVASANDO: 'Envasando', FUERA_DE_SERVICIO: 'Fuera de servicio'
};

const titles: Record<Sector, string> = {
  fabricacion: 'Panel de Fabricación', laboratorio: 'Panel de Laboratorio', envasado: 'Panel de Envasado', monitoreo: 'Visualización de Planta'
};

const emptyForm = {
  manufacturingOrder: '', materialCode: '', description: '', employeeNumber: '', specificWeight: '',
  qualityResult: 'APROBADO', reason: '', recoveryAction: '', packagingOrder: '', line: '', format: '', notes: '',
  plannedQuantityKg: '', priority: 'NORMAL', shift: '', scheduledAt: '', producedKg: '', wasteKg: '', producedUnits: ''
};

export function PlantBoardPage({ sector }: { sector: Sector }) {
  const client = useQueryClient();
  const [selection, setSelection] = useState<{ tank: Tank; action: Action } | null>(null);
  const [pendingRequest, setPendingRequest] = useState<PendingRequest | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const tanks = useQuery({
    queryKey: ['plant-tanks'],
    queryFn: async () => (await api.get<Tank[]>('/plant/tanks')).data,
    refetchInterval: 2000,
    refetchIntervalInBackground: true
  });
  const config = useQuery({ queryKey: ['plant-config'], queryFn: async () => (await api.get<Config>('/plant/config')).data });

  const mutation = useMutation({
    mutationFn: async ({ path, method, payload }: PendingRequest) => api[method](path, payload),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ['plant-tanks'] }); setSelection(null); setPendingRequest(null); setConfirming(false); setForm(emptyForm); setError(null); },
    onError: (requestError: { response?: { data?: { message?: string | string[] } } }) => {
      const message = requestError.response?.data?.message;
      setError(Array.isArray(message) ? message.join('. ') : message ?? 'No se pudo completar la operación.');
    }
  });

  const onlineCount = tanks.data?.filter((tank) => tank.telemetry.online).length ?? 0;
  const openAction = (tank: Tank, action: Action) => {
    setSelection({ tank, action }); setPendingRequest(null); setConfirming(false); setError(null);
    const currentOrder = tank.activeLot?.packagingOrders[0];
    setForm({ ...emptyForm,
      manufacturingOrder: tank.activeLot?.manufacturingOrder ?? '', materialCode: tank.activeLot?.materialCode ?? '',
      description: tank.activeLot?.description ?? '', packagingOrder: action === 'correctOrder' ? currentOrder?.packagingOrder ?? '' : '',
      line: action === 'correctOrder' ? currentOrder?.line ?? '' : config.data?.lines[0] ?? '',
      format: action === 'correctOrder' ? currentOrder?.format ?? '' : config.data?.formats[0] ?? ''
    });
  };

  const actionsFor = (tank: Tank) => {
    if (sector === 'monitoreo') return [] as Array<[string, Action, string]>;
    if (sector === 'fabricacion') {
      if (tank.state === 'VACIO') return [['Iniciar fabricación', 'start', 'primary'], ['Fuera de servicio', 'serviceOut', 'danger']] as Array<[string, Action, string]>;
      if (tank.state === 'FABRICANDO') return [['Enviar a Laboratorio', 'sendLab', 'primary'], ['Corregir datos', 'correctLot', 'secondary']] as Array<[string, Action, string]>;
      if (tank.state === 'AJUSTE') return [['Ajuste realizado', 'sendLab', 'primary']] as Array<[string, Action, string]>;
      if (tank.state === 'RECHAZADO') return [['Registrar vaciado', 'emptyRejected', 'danger']] as Array<[string, Action, string]>;
      if (tank.state === 'FUERA_DE_SERVICIO') return [['Volver a servicio', 'serviceIn', 'success']] as Array<[string, Action, string]>;
    }
    if (sector === 'laboratorio' && tank.state === 'LABORATORIO') return [['Resolver análisis', 'quality', 'warning']] as Array<[string, Action, string]>;
    if (sector === 'envasado') {
      if (tank.state === 'APROBADO') return [['Iniciar envasado', 'packaging', 'primary']] as Array<[string, Action, string]>;
      if (tank.state === 'ENVASANDO') return [['Nueva OE', 'newOrder', 'secondary'], ['Corregir OE', 'correctOrder', 'secondary'], ['Finalizar y vaciar', 'finish', 'danger']] as Array<[string, Action, string]>;
    }
    return [] as Array<[string, Action, string]>;
  };

  const dateFormatter = useMemo(() => new Intl.DateTimeFormat('es-AR', { dateStyle: 'full', timeZone: 'America/Argentina/Buenos_Aires' }), []);
  const timeFormatter = useMemo(() => new Intl.DateTimeFormat('es-AR', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    timeZone: 'America/Argentina/Buenos_Aires'
  }), []);
  const [now, setNow] = useState(new Date());
  useEffect(() => { const id = window.setInterval(() => setNow(new Date()), 1000); return () => window.clearInterval(id); }, []);
  const [clockHours = '00', clockMinutes = '00', clockSeconds = '00'] = timeFormatter.format(now).split(':');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!selection) return;
    const { tank, action } = selection;
    const version = tank.version;
    const map: Record<Action, { path: string; method: 'post' | 'patch'; payload: Record<string, unknown> }> = {
      start: { path: `/plant/tanks/${tank.id}/manufacturing`, method: 'post', payload: { version, manufacturingOrder: form.manufacturingOrder, materialCode: form.materialCode, description: form.description, plannedQuantityKg: form.plannedQuantityKg ? Number(form.plannedQuantityKg) : undefined, priority: form.priority, shift: form.shift || undefined, scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : undefined } },
      sendLab: { path: `/plant/tanks/${tank.id}/send-to-lab`, method: 'post', payload: { version, reason: form.reason || undefined } },
      quality: { path: `/plant/tanks/${tank.id}/quality`, method: 'post', payload: { version, result: form.qualityResult, employeeNumber: form.employeeNumber, specificWeight: form.specificWeight ? Number(form.specificWeight) : undefined, reason: form.reason || undefined, recoveryAction: form.recoveryAction || undefined } },
      packaging: { path: `/plant/tanks/${tank.id}/packaging`, method: 'post', payload: { version, packagingOrder: form.packagingOrder, line: form.line, format: form.format } },
      newOrder: { path: `/plant/tanks/${tank.id}/packaging/new-order`, method: 'post', payload: { version, packagingOrder: form.packagingOrder, line: form.line, format: form.format, reason: form.reason || undefined } },
      correctOrder: { path: `/plant/tanks/${tank.id}/packaging/current`, method: 'patch', payload: { version, packagingOrder: form.packagingOrder, line: form.line, format: form.format, reason: form.reason } },
      finish: { path: `/plant/tanks/${tank.id}/packaging/finish`, method: 'post', payload: { version, producedKg: Number(form.producedKg), wasteKg: form.wasteKg ? Number(form.wasteKg) : undefined, producedUnits: form.producedUnits ? Number(form.producedUnits) : undefined, reason: form.reason || undefined } },
      emptyRejected: { path: `/plant/tanks/${tank.id}/empty-rejected`, method: 'post', payload: { version, reason: form.reason } },
      serviceOut: { path: `/plant/tanks/${tank.id}/service-out`, method: 'post', payload: { version, reason: form.reason, notes: form.notes || undefined } },
      serviceIn: { path: `/plant/tanks/${tank.id}/service-in`, method: 'post', payload: { version, reason: form.reason || undefined } },
      correctLot: { path: `/plant/tanks/${tank.id}/lot`, method: 'patch', payload: { version, manufacturingOrder: form.manufacturingOrder, materialCode: form.materialCode, description: form.description, reason: form.reason } }
    };
    setPendingRequest(map[action]);
    setConfirming(true);
  };

  const closeDialog = () => {
    if (mutation.isPending) return;
    setSelection(null);
    setPendingRequest(null);
    setConfirming(false);
    setError(null);
  };

  return (
    <div className={`plant-page plant-page--${sector}`}>
      <header className="plant-page-head">
        <div><h1>{titles[sector]}</h1></div>
        <div className="plant-health"><Radio size={16}/><span>{onlineCount}/{tanks.data?.length ?? 9} balanzas en línea</span><button onClick={() => tanks.refetch()}><RefreshCw size={16}/></button></div>
      </header>
      {tanks.isError ? <div className="plant-error"><AlertTriangle/> No se pudo leer el estado de la planta.</div> : null}
      <section className="tank-grid">
        {tanks.isLoading ? Array.from({ length: 9 }, (_, i) => <div className="tank-card skeleton" key={i}/>) : tanks.data?.map((tank) => {
          const weight = tank.telemetry.grossKg;
          const fill = tank.capacityKg ? Math.max(0, Math.min(100, ((weight ?? 0) / tank.capacityKg) * 100)) : 0;
          const order = tank.activeLot?.packagingOrders[0];
          return <article className={`tank-card state-${tank.state.toLowerCase()} attention-${tank.stateAttention.toLowerCase()}`} key={tank.id}>
            <div className="tank-card__content">
              <div className="tank-card__title"><h2>{tank.name}</h2>{!tank.telemetry.online ? <span className="tank-offline"><WifiOff size={13}/> Sin señal</span> : null}</div>
              <span className="tank-state">{stateLabel[tank.state]}</span>
              <strong className="tank-weight">{weight === null ? '—' : Math.round(weight).toLocaleString('es-AR')}</strong>
              <small>Kg (bruto)</small>
              <dl>
                <div className="tank-elapsed"><dt>En estado</dt><dd>{formatDuration(tank.stateElapsedSeconds)}</dd></div>
                {tank.activeLot ? <><div><dt>OF</dt><dd>{tank.activeLot.manufacturingOrder}</dd></div><div><dt>Material</dt><dd>{tank.activeLot.materialCode}</dd></div><div><dt>Descripción</dt><dd>{tank.activeLot.description}</dd></div></> : null}
                {tank.activeLot?.specificWeight ? <div><dt>P. específico</dt><dd>{tank.activeLot.specificWeight}</dd></div> : null}
                {order ? <><div><dt>OE</dt><dd>{order.packagingOrder}</dd></div><div><dt>Línea / Formato</dt><dd>{order.line} · {order.format}</dd></div></> : null}
                {tank.serviceReason ? <div><dt>Motivo</dt><dd>{tank.serviceReason}</dd></div> : null}
              </dl>
              <div className="tank-actions">{actionsFor(tank).map(([label, action, variant]) => <Button key={action} size="sm" variant={variant as 'primary'} onClick={() => openAction(tank, action)}>{label}</Button>)}</div>
            </div>
            <div className={`tank-gauge${tank.capacityKg ? '' : ' is-pending'}`} aria-label={tank.capacityKg ? `${fill.toFixed(0)}% de capacidad` : 'Capacidad pendiente'}>
              <div style={{ height: `${fill}%` }}/>
            </div>
            <div className="tank-capacity">
              <span><b>MAX:</b> {tank.capacityKg ? `${tank.capacityKg.toLocaleString('es-AR')} kg` : 'Pendiente'}</span>
              <span><b>MIN:</b> 0</span>
            </div>
          </article>;
        })}
        <article className="plant-clock">
          <Clock3 className="plant-clock__icon" size={20}/>
          <strong className="plant-clock__label">Reloj</strong>
          <div className="plant-clock__time"><span>{clockHours}:{clockMinutes}</span><b>{clockSeconds}</b></div>
          <small>{dateFormatter.format(now)}</small>
          <em>America/Buenos_Aires</em>
        </article>
      </section>

      <Dialog
        open={Boolean(selection)}
        onOpenChange={(open) => !open && closeDialog()}
        disableClose={mutation.isPending}
        title={selection ? confirming ? 'Confirmar operación' : `${actionTitle(selection.action)} · ${selection.tank.name}` : ''}
        description={confirming ? 'Esta acción modifica el estado operativo y quedará registrada.' : 'Revisá los datos. El backend volverá a validar rol, estado y versión antes de guardar.'}
      >
        {confirming && selection ? (
          <div className="plant-confirmation">
            <div className="plant-confirmation__icon"><AlertTriangle size={28}/></div>
            <div className="plant-confirmation__summary">
              <span>ACCIÓN</span><strong>{actionTitle(selection.action)}</strong>
              <span>EQUIPO</span><strong>{selection.tank.name}</strong>
              <p>Verificá físicamente el tanque antes de continuar. La operación no se ejecutará hasta presionar “Sí, confirmar”.</p>
            </div>
            {error ? <div className="plant-form-error">{error}</div> : null}
            <div className="plant-form-actions">
              <Button type="button" variant="secondary" disabled={mutation.isPending} onClick={() => { setConfirming(false); setError(null); }}>Volver</Button>
              <Button type="button" variant="danger" disabled={mutation.isPending || !pendingRequest} onClick={() => pendingRequest && mutation.mutate(pendingRequest)}>{mutation.isPending ? 'Guardando…' : 'Sí, confirmar'}</Button>
            </div>
          </div>
        ) : (
          <form className="plant-action-form" onSubmit={submit}>
            {selection && renderFields(selection.action, form, setForm, config.data)}
            {error ? <div className="plant-form-error">{error}</div> : null}
            <div className="plant-form-actions"><Button type="button" variant="secondary" onClick={closeDialog}>Cancelar</Button><Button type="submit">Continuar</Button></div>
          </form>
        )}
      </Dialog>
    </div>
  );
}

function actionTitle(action: Action) {
  return ({ start: 'Nueva fabricación', sendLab: 'Enviar a Laboratorio', quality: 'Decisión de calidad', packaging: 'Iniciar envasado', newOrder: 'Ingresar nueva OE', correctOrder: 'Corregir OE activa', finish: 'Finalizar envasado', emptyRejected: 'Vaciar rechazado', serviceOut: 'Sacar de servicio', serviceIn: 'Volver a servicio', correctLot: 'Corregir lote' } as Record<Action, string>)[action];
}

function formatDuration(seconds: number | null) {
  if (seconds === null) return '—';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours ? `${hours} h ${minutes} min` : `${minutes} min`;
}

function renderFields(action: Action, form: typeof emptyForm, setForm: (value: typeof emptyForm) => void, config?: Config) {
  const field = (key: keyof typeof form, value: string) => setForm({ ...form, [key]: value });
  if (action === 'start' || action === 'correctLot') return <>
    <label>Orden de fabricación (8 dígitos)<Input value={form.manufacturingOrder} onChange={(e) => field('manufacturingOrder', e.target.value)} pattern="\d{8}" required/></label>
    <label>Material (6 dígitos)<Input value={form.materialCode} onChange={(e) => field('materialCode', e.target.value)} pattern="\d{6}" required/></label>
    <label>Descripción<Input value={form.description} onChange={(e) => field('description', e.target.value)} required maxLength={180}/></label>
    {action === 'start' ? <>
      <label>Cantidad planificada (kg)<Input type="number" min="0.001" step="0.001" value={form.plannedQuantityKg} onChange={(e) => field('plannedQuantityKg', e.target.value)}/></label>
      <label>Prioridad<select value={form.priority} onChange={(e) => field('priority', e.target.value)}><option value="BAJA">Baja</option><option value="NORMAL">Normal</option><option value="ALTA">Alta</option><option value="URGENTE">Urgente</option></select></label>
      <label>Turno<Input value={form.shift} onChange={(e) => field('shift', e.target.value)} placeholder="Ej: Mañana" maxLength={40}/></label>
      <label>Inicio planificado<Input type="datetime-local" value={form.scheduledAt} onChange={(e) => field('scheduledAt', e.target.value)}/></label>
    </> : null}
    {action === 'correctLot' ? <label>Motivo de la corrección<Input value={form.reason} onChange={(e) => field('reason', e.target.value)} required/></label> : null}
  </>;
  if (action === 'quality') return <>
    <label>Resultado<select value={form.qualityResult} onChange={(e) => field('qualityResult', e.target.value)}><option value="APROBADO">Aprobar</option><option value="AJUSTE">Solicitar ajuste</option><option value="RECHAZADO_RECUPERAR">Rechazar a recuperar</option><option value="RECHAZADO_DESTRUIR">Rechazar a destruir</option></select></label>
    <label>Legajo (6 dígitos)<Input value={form.employeeNumber} onChange={(e) => field('employeeNumber', e.target.value)} pattern="\d{6}" required/></label>
    {form.qualityResult === 'APROBADO' ? <label>Peso específico<Input type="number" min="0.001" step="0.001" value={form.specificWeight} onChange={(e) => field('specificWeight', e.target.value)} required/></label> : null}
    {form.qualityResult !== 'APROBADO' ? <label>Motivo<select value={form.reason} onChange={(e) => field('reason', e.target.value)} required><option value="">Seleccionar…</option>{config?.adjustmentReasons.map((reason) => <option key={reason}>{reason}</option>)}</select></label> : null}
    {form.qualityResult === 'RECHAZADO_RECUPERAR' ? <label>Destino<select value={form.recoveryAction} onChange={(e) => field('recoveryAction', e.target.value)} required><option value="">Seleccionar…</option><option>Recuperar en el mismo tanque</option><option>Bajar producto para futuras fabricaciones</option></select></label> : null}
  </>;
  if (action === 'packaging' || action === 'newOrder' || action === 'correctOrder') return <>
    <label>Orden de envasado (8 dígitos)<Input value={form.packagingOrder} onChange={(e) => field('packagingOrder', e.target.value)} pattern="\d{8}" required/></label>
    <label>Línea<select value={form.line} onChange={(e) => field('line', e.target.value)} required>{config?.lines.map((line) => <option key={line}>{line}</option>)}</select></label>
    <label>Formato<select value={form.format} onChange={(e) => field('format', e.target.value)} required>{config?.formats.map((format) => <option key={format}>{format}</option>)}</select></label>
    {action === 'newOrder' || action === 'correctOrder' ? <label>Motivo / observación<Input value={form.reason} onChange={(e) => field('reason', e.target.value)} required={action === 'correctOrder'}/></label> : null}
  </>;
  if (action === 'serviceOut') return <><label>Motivo<Input value={form.reason} onChange={(e) => field('reason', e.target.value)} required/></label><label>Observaciones<textarea value={form.notes} onChange={(e) => field('notes', e.target.value)}/></label></>;
  if (action === 'finish') return <>
    <label>Kilogramos envasados<Input type="number" min="0" step="0.001" value={form.producedKg} onChange={(e) => field('producedKg', e.target.value)} required/></label>
    <label>Merma (kg)<Input type="number" min="0" step="0.001" value={form.wasteKg} onChange={(e) => field('wasteKg', e.target.value)}/></label>
    <label>Unidades producidas<Input type="number" min="0" step="1" value={form.producedUnits} onChange={(e) => field('producedUnits', e.target.value)}/></label>
    <label>Observación<Input value={form.reason} onChange={(e) => field('reason', e.target.value)}/></label>
  </>;
  return <label>Motivo / observación<Input value={form.reason} onChange={(e) => field('reason', e.target.value)} required={action === 'emptyRejected'}/></label>;
}
