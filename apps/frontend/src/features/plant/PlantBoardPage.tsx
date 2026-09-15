import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Clock3, Radio, RefreshCw, WifiOff } from 'lucide-react';
import { api } from '../../shared/api/http';
import { Button } from '../../shared/ui/Button';
import { Dialog } from '../../shared/ui/Dialog';
import { Input } from '../../shared/ui/Input';
import { useLocation } from 'react-router-dom';
import { useHighlightTarget } from '../../shared/utils/highlightTarget';
import { useActivePlant } from './useActivePlant';

type Sector = 'fabricacion' | 'laboratorio' | 'envasado' | 'monitoreo';
type TankState = 'VACIO' | 'FABRICANDO' | 'LABORATORIO' | 'AJUSTE' | 'RECHAZADO' | 'APROBADO' | 'ENVASANDO' | 'TRASVASANDO' | 'FUERA_DE_SERVICIO';
type Action = 'start' | 'sendLab' | 'quality' | 'packaging' | 'newOrder' | 'correctOrder' | 'finish' | 'startTransfer' | 'finishTransfer' | 'emptyRejected' | 'serviceOut' | 'serviceIn' | 'correctLot';
type PendingRequest = { path: string; method: 'post' | 'patch'; payload: Record<string, unknown> };

interface Tank {
  id: string; number: number; name: string; capacityKg: number | null; scaleKey: string | null; equipmentType: 'TANK' | 'DISPERSER'; telemetryMode: 'AUTOMATIC' | 'NOT_INSTALLED' | 'PENDING'; state: TankState; version: number;
  serviceReason?: string | null;
  stateStartedAt: string; stateElapsedSeconds: number | null; stateTargetSeconds: number | null; stateAttention: 'OK' | 'WARNING' | 'CRITICAL';
  telemetry: { grossKg: number | null; netKg: number | null; measuredAt: string | null; online: boolean | null; status: string };
  activeLot: null | {
    id: string; manufacturingOrder: string; materialCode: string; description: string; specificWeight: number | null;
    packagingOrders: Array<{ packagingOrder: string; materialCode: string | null; line: string; format: string; description: string; startedAt: string }>;
  };
}

interface Config { lines: string[]; formats: string[]; adjustmentReasons: string[]; finalOperation: 'PACKAGING' | 'TRANSFER' }

const stateLabel: Record<TankState, string> = {
  VACIO: 'Vacío', FABRICANDO: 'Fabricando', LABORATORIO: 'Laboratorio', AJUSTE: 'Ajuste',
  RECHAZADO: 'Rechazado', APROBADO: 'Aprobado', ENVASANDO: 'Envasando', TRASVASANDO: 'Trasvase', FUERA_DE_SERVICIO: 'Fuera de servicio'
};

const titles: Record<Sector, string> = {
  fabricacion: 'Panel de Fabricación', laboratorio: 'Panel de Laboratorio', envasado: 'Panel de Envasado', monitoreo: 'Visualización de Planta'
};

const equipmentCountByPlant: Record<string, number> = { LATEX: 9, TERPLAST: 4, SLURRY: 2, ENDUIDO: 2 };

const emptyForm = {
  manufacturingOrder: '', materialCode: '', packagingMaterialCode: '', description: '', employeeNumber: '', specificWeight: '',
  qualityResult: 'APROBADO', reason: '', recoveryAction: '', packagingOrder: '', line: '', format: '', notes: '',
  plannedQuantityKg: '', producedKg: '', wasteKg: '', producedUnits: ''
};

export function PlantBoardPage({ sector }: { sector: Sector }) {
  const location = useLocation();
  const { active } = useActivePlant();
  const plantCode = active?.code ?? new URLSearchParams(location.search).get('plant')?.toUpperCase() ?? 'LATEX';
  const base = `/plants/${plantCode}`;
  const navigationState = location.state as { highlightTankId?: string; highlightNonce?: number } | null;
  useHighlightTarget(navigationState?.highlightTankId ? `tank-${navigationState.highlightTankId}` : null, `${location.key}:${navigationState?.highlightNonce ?? ''}`);
  const client = useQueryClient();
  const [selection, setSelection] = useState<{ tank: Tank; action: Action } | null>(null);
  const [pendingRequest, setPendingRequest] = useState<PendingRequest | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { setSelection(null); setPendingRequest(null); setConfirming(false); setForm(emptyForm); setError(null); }, [plantCode]);
  const tanks = useQuery({
    queryKey: [sector === 'monitoreo' ? 'plant-tv-tanks' : 'plant-tanks', plantCode],
    queryFn: async () => (await api.get<Tank[]>(sector === 'monitoreo' ? `${base}/tv` : `${base}/tanks`)).data,
    refetchInterval: 2000,
    refetchIntervalInBackground: true
  });
  const config = useQuery({
    queryKey: ['plant-config', plantCode],
    queryFn: async () => (await api.get<Config>(`${base}/config`)).data,
    enabled: sector !== 'monitoreo'
  });

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
      packagingMaterialCode: action === 'correctOrder' ? currentOrder?.materialCode ?? '' : '',
      description: action === 'correctOrder' ? currentOrder?.description ?? '' : action === 'correctLot' ? tank.activeLot?.description ?? '' : '', packagingOrder: action === 'correctOrder' ? currentOrder?.packagingOrder ?? '' : '',
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
      if (tank.state === 'APROBADO' && config.data?.finalOperation === 'TRANSFER') return [['Iniciar trasvase', 'startTransfer', 'primary']] as Array<[string, Action, string]>;
      if (tank.state === 'TRASVASANDO') return [['Finalizar trasvase', 'finishTransfer', 'danger']] as Array<[string, Action, string]>;
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
      start: { path: `${base}/tanks/${tank.id}/manufacturing`, method: 'post', payload: { version, manufacturingOrder: form.manufacturingOrder, materialCode: form.materialCode, description: form.description, plannedQuantityKg: form.plannedQuantityKg ? Number(form.plannedQuantityKg) : undefined } },
      sendLab: { path: `${base}/tanks/${tank.id}/send-to-lab`, method: 'post', payload: { version, reason: form.reason || undefined } },
      quality: { path: `${base}/tanks/${tank.id}/quality`, method: 'post', payload: { version, result: form.qualityResult, employeeNumber: form.employeeNumber, specificWeight: form.specificWeight ? Number(form.specificWeight) : undefined, reason: form.reason || undefined, recoveryAction: form.recoveryAction || undefined } },
      packaging: { path: `${base}/tanks/${tank.id}/packaging`, method: 'post', payload: { version, packagingOrder: form.packagingOrder, materialCode: form.packagingMaterialCode, line: form.line, format: form.format, description: form.description } },
      newOrder: { path: `${base}/tanks/${tank.id}/packaging/new-order`, method: 'post', payload: { version, packagingOrder: form.packagingOrder, materialCode: form.packagingMaterialCode, line: form.line, format: form.format, description: form.description, reason: form.reason || undefined } },
      correctOrder: { path: `${base}/tanks/${tank.id}/packaging/current`, method: 'patch', payload: { version, packagingOrder: form.packagingOrder, materialCode: form.packagingMaterialCode, line: form.line, format: form.format, description: form.description, reason: form.reason } },
      finish: { path: `${base}/tanks/${tank.id}/packaging/finish`, method: 'post', payload: { version, producedKg: Number(form.producedKg), wasteKg: form.wasteKg ? Number(form.wasteKg) : undefined, producedUnits: form.producedUnits ? Number(form.producedUnits) : undefined, reason: form.reason || undefined } },
      startTransfer: { path: `${base}/tanks/${tank.id}/transfer`, method: 'post', payload: { version, reason: form.reason || undefined } },
      finishTransfer: { path: `${base}/tanks/${tank.id}/transfer/finish`, method: 'post', payload: { version, reason: form.reason || undefined } },
      emptyRejected: { path: `${base}/tanks/${tank.id}/empty-rejected`, method: 'post', payload: { version, reason: form.reason } },
      serviceOut: { path: `${base}/tanks/${tank.id}/service-out`, method: 'post', payload: { version, reason: form.reason, notes: form.notes || undefined } },
      serviceIn: { path: `${base}/tanks/${tank.id}/service-in`, method: 'post', payload: { version, reason: form.reason || undefined } },
      correctLot: { path: `${base}/tanks/${tank.id}/lot`, method: 'patch', payload: { version, manufacturingOrder: form.manufacturingOrder, materialCode: form.materialCode, description: form.description, reason: form.reason } }
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
    <div className={`plant-page plant-page--${sector} plant-page--${plantCode.toLowerCase()}`}>
      <header className="plant-page-head">
        <div><h1>{titles[sector]}</h1></div>
        <div className="plant-health"><Radio size={16}/><span>{tanks.data?.some(t => t.telemetryMode === 'AUTOMATIC') ? `${onlineCount}/${tanks.data.filter(t => t.telemetryMode === 'AUTOMATIC').length} balanzas en línea` : tanks.data?.some(t => t.telemetryMode === 'PENDING') ? 'Mapeo de peso pendiente' : 'Sin medición de peso'}</span>{sector !== 'monitoreo' ? <button onClick={() => tanks.refetch()} aria-label="Actualizar estado"><RefreshCw size={16}/></button> : null}</div>
      </header>
      {tanks.isError ? <div className="plant-error"><AlertTriangle/> No se pudo leer el estado de la planta.</div> : null}
      <section className="tank-grid">
        {tanks.isLoading ? Array.from({ length: equipmentCountByPlant[plantCode] ?? 9 }, (_, i) => <div className="tank-card skeleton" key={i}/>) : tanks.data?.map((tank) => {
          const weight = tank.telemetry.grossKg;
          const fill = tank.capacityKg ? Math.max(0, Math.min(100, ((weight ?? 0) / tank.capacityKg) * 100)) : 0;
          const order = tank.activeLot?.packagingOrders[0];
          return <article id={`tank-${tank.id}`} className={`tank-card state-${tank.state.toLowerCase()} attention-${tank.stateAttention.toLowerCase()}${order ? ' has-packaging' : ''}`} key={tank.id}>
            <div className="tank-card__content">
              <div className="tank-card__title"><h2>{tank.name}</h2>{tank.telemetryMode === 'AUTOMATIC' && !tank.telemetry.online ? <span className="tank-offline"><WifiOff size={13}/> Sin señal</span> : null}</div>
              <span className="tank-state">{stateLabel[tank.state]}</span>
              {tank.telemetryMode !== 'NOT_INSTALLED' ? <><strong className="tank-weight">{weight === null ? '—' : Math.round(weight).toLocaleString('es-AR')}</strong><small>Kg (bruto)</small></> : <small>Sin medición de peso</small>}
              <dl>
                <div className="tank-elapsed"><dt>En estado</dt><dd>{formatDuration(tank.stateElapsedSeconds)}</dd></div>
                {tank.activeLot ? tank.state === 'ENVASANDO' && order ? <><div><dt>Material</dt><dd>{order.materialCode ?? 'Sin informar'}</dd></div><div><dt>Descripción</dt><dd>{order.description}</dd></div></> : <><div><dt>OF</dt><dd>{tank.activeLot.manufacturingOrder}</dd></div><div><dt>Material</dt><dd>{tank.activeLot.materialCode}</dd></div><div><dt>Descripción</dt><dd>{tank.activeLot.description}</dd></div></> : null}
                {tank.activeLot?.specificWeight ? <div><dt>P. específico</dt><dd>{tank.activeLot.specificWeight}</dd></div> : null}
                {order ? <><div><dt>OE</dt><dd>{order.packagingOrder}</dd></div><div><dt>Celda / Formato</dt><dd>{order.line} · {order.format}</dd></div></> : null}
                {tank.serviceReason ? <div><dt>Motivo</dt><dd>{tank.serviceReason}</dd></div> : null}
              </dl>
              <div className="tank-actions">{actionsFor(tank).map(([label, action, variant]) => <Button key={action} size="sm" variant={variant as 'primary'} onClick={() => openAction(tank, action)}>{label}</Button>)}</div>
            </div>
            {tank.telemetryMode !== 'NOT_INSTALLED' ? <><div className={`tank-gauge${tank.capacityKg ? '' : ' is-pending'}`} aria-label={tank.capacityKg ? `${fill.toFixed(0)}% de capacidad` : 'Capacidad pendiente'}>
              <div style={{ height: `${fill}%` }}/>
            </div>
            <div className="tank-capacity">
              <span><b>MAX:</b> {tank.capacityKg ? `${tank.capacityKg.toLocaleString('es-AR')} kg` : 'Pendiente'}</span>
              {sector !== 'monitoreo' ? <span><b>MIN:</b> 0</span> : null}
            </div></> : null}
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
        title={selection ? confirming ? `Confirmar operación · ${active?.name ?? plantCode}` : `${actionTitle(selection.action)} · ${selection.tank.name} · ${active?.name ?? plantCode}` : ''}
        description={confirming ? 'Esta acción modifica el estado operativo y quedará registrada.' : 'Revisá los datos. El backend volverá a validar rol, estado y versión antes de guardar.'}
      >
        {confirming && selection ? (
          <div className="plant-confirmation">
            <div className="plant-confirmation__icon"><AlertTriangle size={28}/></div>
            <div className="plant-confirmation__summary">
              <span>ACCIÓN</span><strong>{actionTitle(selection.action)}</strong>
              <span>EQUIPO</span><strong>{selection.tank.name}</strong>
              <span>PLANTA</span><strong>{active?.name ?? plantCode}</strong>
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
  return ({ start: 'Nueva fabricación', sendLab: 'Enviar a Laboratorio', quality: 'Decisión de calidad', packaging: 'Iniciar envasado', newOrder: 'Ingresar nueva OE', correctOrder: 'Corregir OE activa', finish: 'Finalizar envasado', startTransfer: 'Iniciar trasvase', finishTransfer: 'Finalizar trasvase', emptyRejected: 'Vaciar rechazado', serviceOut: 'Sacar de servicio', serviceIn: 'Volver a servicio', correctLot: 'Corregir lote' } as Record<Action, string>)[action];
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
    <label>Orden de envasado (6 dígitos)<Input value={form.packagingOrder} onChange={(e) => field('packagingOrder', e.target.value)} pattern="\d{6}" inputMode="numeric" maxLength={6} required/></label>
    <label>Material de envasado (4 dígitos)<Input value={form.packagingMaterialCode} onChange={(e) => field('packagingMaterialCode', e.target.value.replace(/\D/g, '').slice(0, 4))} pattern="\d{4}" inputMode="numeric" maxLength={4} required/></label>
    <label>Celda<select value={form.line} onChange={(e) => field('line', e.target.value)} required>{config?.lines.map((line) => <option key={line}>{line}</option>)}</select></label>
    <label>Formato<select value={form.format} onChange={(e) => field('format', e.target.value)} required>{config?.formats.map((format) => <option key={format}>{format}</option>)}</select></label>
    <label>Descripción de envasado<Input value={form.description} onChange={(e) => field('description', e.target.value)} required maxLength={180}/></label>
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
