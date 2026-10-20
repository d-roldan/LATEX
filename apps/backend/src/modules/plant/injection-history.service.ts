import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  InjectionMachineReadingDto,
  InjectionTechnicalCycleDto
} from './dto/injection-machine.dto';

export type InjectionHistoryMetric = 'cycle' | 'quantity' | 'temperature' | 'state';
type HistoryStatus = 'AVAILABLE' | 'NO_DATA' | 'CONFIGURATION_PENDING' | 'UNAVAILABLE';

@Injectable()
export class InjectionHistoryService {
  private readonly logger = new Logger(InjectionHistoryService.name);
  private readonly lastState = new Map<string, { value: number; timestamp: number }>();

  constructor(private readonly config: ConfigService) {}

  async record(
    code: string,
    source: string,
    reading: InjectionMachineReadingDto,
    shot: InjectionTechnicalCycleDto | null,
    writeStatus = true
  ): Promise<boolean> {
    const connection = this.connection();
    if (!connection) return false;
    const lines: string[] = [];
    const timestamp = Date.parse(reading.cms_timestamp);
    const state = this.operatingState(reading.operation_status_text);
    const stateKey = `${source}:${code}`;
    const lastState = this.lastState.get(stateKey);
    const writeState =
      writeStatus &&
      reading.cms_row_fresh !== false &&
      Number.isFinite(timestamp) &&
      state !== null &&
      (!lastState || lastState.value !== state || timestamp - lastState.timestamp >= 30_000);
    if (writeStatus && reading.cms_row_fresh !== false && Number.isFinite(timestamp)) {
      const fields = this.fields({
        cycle_current: reading.cycle_time_current,
        current_quantity: reading.current_quantity,
        total_quantity: reading.total_quantity,
        target_quantity: reading.target_quantity,
        defective_quantity: reading.defective_quantity,
        avg_quantity_per_hour: reading.avg_quantity_per_hour,
        operation_status: reading.operation_status_code
      });
      if (fields)
        lines.push(`woojin_status,machine=${code},source=${source} ${fields} ${timestamp}`);
      if (writeState)
        lines.push(
          `woojin_operating_state,machine=${code},source=${source} producing=${state}i ${timestamp}`
        );
      if (reading.telemetry_origin === 'DBS_API') {
        const temperatureFields: Record<string, number | null | undefined> = {};
        for (const item of reading.dbs_temperature_zones ?? []) {
          const key = item.zone.toLowerCase();
          temperatureFields[`${key}_current`] = item.current;
          temperatureFields[`${key}_setting`] = item.setting;
        }
        const temperatureValues = this.fields(temperatureFields);
        if (temperatureValues)
          lines.push(
            `woojin_dbs_temperature,machine=${code},source=${source} ${temperatureValues} ${timestamp}`
          );
      }
    }
    if (shot) {
      const shotTimestamp = Date.parse(shot.timestamp);
      const barrelTargets = this.targets(shot.recipe?.barrel_temperature, [7, 8]);
      const moldTargets = this.targets(shot.recipe?.mold_temperature, [12]);
      const values: Record<string, number | null | undefined> = {
        shot_number: shot.shot_number,
        cycle_time: shot.cycle_time,
        hopper_measured: shot.hopper_temperature,
        hopper_target: barrelTargets?.[7]
      };
      for (let index = 0; index < 7; index += 1) {
        values[`barrel_${index + 1}_measured`] = shot.barrel_temperatures?.[index];
        values[`barrel_${index + 1}_target`] = barrelTargets?.[index];
      }
      for (let index = 0; index < 12; index += 1) {
        values[`mold_${index + 1}_measured`] = shot.mold_temperatures?.[index];
        values[`mold_${index + 1}_target`] = moldTargets?.[index];
      }
      const fields = this.fields(values);
      if (fields && Number.isFinite(shotTimestamp))
        lines.push(`woojin_shot,machine=${code},source=${source} ${fields} ${shotTimestamp}`);
    }
    if (!lines.length) return false;
    try {
      const response = await fetch(
        `${connection.url}/api/v2/write?${connection.orgQuery}&bucket=${encodeURIComponent(connection.bucket)}&precision=ms`,
        {
          method: 'POST',
          headers: { Authorization: `Token ${connection.token}`, 'Content-Type': 'text/plain' },
          body: lines.join('\n'),
          signal: AbortSignal.timeout(1500)
        }
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (writeState) this.lastState.set(stateKey, { value: state!, timestamp });
      return true;
    } catch (error) {
      this.logger.warn(`No se pudo registrar el historial Woojin: ${String(error)}`);
      return false;
    }
  }

  async read(
    code: string,
    source: string,
    metric: InjectionHistoryMetric,
    hours: number,
    zone = 1
  ) {
    const connection = this.connection();
    const empty = (status: HistoryStatus, message: string) => ({ status, message, points: [] });
    if (!connection)
      return empty('CONFIGURATION_PENDING', 'Falta configurar el bucket histórico de ENVASES.');
    const measurement =
      metric === 'temperature'
        ? 'woojin_shot'
        : metric === 'state'
          ? 'woojin_operating_state'
          : 'woojin_status';
    const fields =
      metric === 'state'
        ? ['producing']
        : metric === 'cycle'
          ? ['cycle_current']
          : metric === 'quantity'
            ? ['current_quantity']
            : zone === 8
              ? ['hopper_target', 'hopper_measured']
              : zone > 8
                ? [`mold_${zone - 8}_target`, `mold_${zone - 8}_measured`]
                : [`barrel_${zone}_target`, `barrel_${zone}_measured`];
    const escapedBucket = this.escapeFlux(connection.bucket);
    const query = [
      `from(bucket: "${escapedBucket}")`,
      `  |> range(start: -${hours}h)`,
      `  |> filter(fn: (r) => r._measurement == "${measurement}" and r.machine == "${code}" and r.source == "${source}")`,
      `  |> filter(fn: (r) => ${fields.map((field) => `r._field == "${field}"`).join(' or ')})`,
      ...(metric === 'state'
        ? []
        : [
            `  |> aggregateWindow(every: ${Math.max(1, Math.ceil((hours * 60) / 360))}m, fn: last, createEmpty: false)`
          ]),
      '  |> keep(columns: ["_time", "_field", "_value"])',
      '  |> group()',
      '  |> sort(columns: ["_time"])'
    ].join('\n');
    try {
      const response = await fetch(`${connection.url}/api/v2/query?${connection.orgQuery}`, {
        method: 'POST',
        headers: {
          Authorization: `Token ${connection.token}`,
          Accept: 'application/csv',
          'Content-Type': 'application/vnd.flux'
        },
        body: query,
        signal: AbortSignal.timeout(8000)
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const points = this.parseCsv(await response.text(), fields);
      return points.length
        ? {
            status: 'AVAILABLE' as const,
            message: `${points.length} muestras disponibles.`,
            points
          }
        : empty('NO_DATA', 'Todavía no hay muestras para este equipo y período.');
    } catch (error) {
      this.logger.warn(`No se pudo consultar el historial Woojin: ${String(error)}`);
      return empty('UNAVAILABLE', 'El historial no está disponible en este momento.');
    }
  }

  private connection() {
    const url = this.config.get<string>('INFLUXDB_URL')?.replace(/\/$/, '');
    const token =
      this.config.get<string>('INFLUXDB_ENVASES_TOKEN') ||
      this.config.get<string>('INFLUXDB_TOKEN');
    const org = this.config.get<string>('INFLUXDB_ORG');
    const orgId = this.config.get<string>('INFLUXDB_ORG_ID');
    const bucket = this.config.get<string>('INFLUXDB_ENVASES_BUCKET');
    const orgQuery = orgId
      ? `orgID=${encodeURIComponent(orgId)}`
      : org
        ? `org=${encodeURIComponent(org)}`
        : null;
    return url && token && orgQuery && bucket ? { url, token, orgQuery, bucket } : null;
  }

  private operatingState(mode: string | null | undefined): number | null {
    switch (mode?.trim().toUpperCase()) {
      case 'AUTO':
        return 1;
      case 'MANUAL':
      case 'PARO':
      case 'STOP':
        return 0;
      default:
        return null;
    }
  }

  private fields(values: Record<string, number | null | undefined>): string {
    return Object.entries(values)
      .filter(([, value]) => typeof value === 'number' && Number.isFinite(value))
      .map(([key, value]) => `${key}=${value}`)
      .join(',');
  }

  private targets(value: string | null | undefined, lengths: number[]) {
    if (!value) return null;
    const parts = value.split('/').map((part) => (part.trim() ? Number(part.trim()) : NaN));
    return lengths.includes(parts.length) && parts.every(Number.isFinite) ? parts : null;
  }

  private escapeFlux(value: string) {
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  private parseCsv(csv: string, fields: string[]) {
    const points = new Map<
      string,
      { timestamp: string; target?: number; measured?: number; value?: number }
    >();
    let indexes: { time: number; field: number; value: number } | null = null;
    for (const line of csv.split(/\r?\n/)) {
      if (!line || line.startsWith('#')) continue;
      const row = this.csvRow(line);
      if (row.includes('_time') && row.includes('_field') && row.includes('_value')) {
        indexes = {
          time: row.indexOf('_time'),
          field: row.indexOf('_field'),
          value: row.indexOf('_value')
        };
        continue;
      }
      if (!indexes) continue;
      const timestamp = row[indexes.time];
      const field = row[indexes.field];
      if (row[indexes.value] === '') continue;
      const value = Number(row[indexes.value]);
      if (
        !fields.includes(field) ||
        !timestamp ||
        Number.isNaN(Date.parse(timestamp)) ||
        !Number.isFinite(value)
      )
        continue;
      const point = points.get(timestamp) ?? { timestamp };
      if (field.endsWith('_target')) point.target = value;
      else if (field.endsWith('_measured')) point.measured = value;
      else point.value = value;
      points.set(timestamp, point);
    }
    return [...points.values()].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  private csvRow(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const character = line[index];
      if (character === '"' && quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else if (character === '"') quoted = !quoted;
      else if (character === ',' && !quoted) {
        result.push(current);
        current = '';
      } else current += character;
    }
    result.push(current);
    return result;
  }
}
