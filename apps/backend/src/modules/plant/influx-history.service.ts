import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type WeightHistoryStatus = 'AVAILABLE' | 'NO_DATA' | 'CONFIGURATION_PENDING' | 'UNAVAILABLE';

export interface WeightHistoryPoint {
  timestamp: string;
  grossKg: number;
}

export interface WeightHistory {
  status: WeightHistoryStatus;
  message: string;
  points: WeightHistoryPoint[];
  lastTimestamp: string | null;
}

@Injectable()
export class InfluxHistoryService {
  private readonly logger = new Logger(InfluxHistoryService.name);

  constructor(private readonly config: ConfigService) {}

  async readWeightSeries(scaleKey: string | null, start: Date, stop: Date): Promise<WeightHistory> {
    const url = this.config.get<string>('INFLUXDB_URL')?.replace(/\/$/, '');
    const token = this.config.get<string>('INFLUXDB_TOKEN');
    const org = this.config.get<string>('INFLUXDB_ORG');
    const orgId = this.config.get<string>('INFLUXDB_ORG_ID');
    const bucket = this.config.get<string>('INFLUXDB_BUCKET');

    if (!scaleKey) {
      return this.result('CONFIGURATION_PENDING', 'El tanque no tiene una serie de peso asociada.');
    }
    if (!url || !token || (!org && !orgId) || !bucket) {
      return this.result(
        'CONFIGURATION_PENDING',
        'La consulta histórica de InfluxDB todavía no está configurada.'
      );
    }

    const measurement = this.config.get<string>('INFLUXDB_WEIGHT_MEASUREMENT', 'tank_weight');
    const tankTag = this.config.get<string>('INFLUXDB_TANK_TAG', 'scaleKey')?.trim();
    const weightFieldTemplate = this.config.get<string>('INFLUXDB_WEIGHT_FIELD', 'grossKg');
    const weightField = weightFieldTemplate.split('{scaleKey}').join(scaleKey);
    const effectiveStop = stop > start ? stop : new Date(start.getTime() + 1000);
    const durationSeconds = Math.max(
      1,
      Math.ceil((effectiveStop.getTime() - start.getTime()) / 1000)
    );
    const windowSeconds = Math.max(1, Math.ceil(durationSeconds / 500));
    const query = [
      `data = from(bucket: "${this.escapeFlux(bucket)}")`,
      `  |> range(start: time(v: "${start.toISOString()}"), stop: time(v: "${effectiveStop.toISOString()}"))`,
      `  |> filter(fn: (r) => r._measurement == "${this.escapeFlux(measurement)}")`,
      ...(tankTag
        ? [
            `  |> filter(fn: (r) => r["${this.escapeFlux(tankTag)}"] == "${this.escapeFlux(scaleKey)}")`
          ]
        : []),
      `  |> filter(fn: (r) => r._field == "${this.escapeFlux(weightField)}")`,
      '',
      'union(tables: [',
      `  data |> aggregateWindow(every: ${windowSeconds}s, fn: mean, createEmpty: false, timeSrc: "_start"),`,
      '  data |> last()',
      '])',
      '  |> keep(columns: ["_time", "_value"])',
      '  |> group()',
      '  |> sort(columns: ["_time"])'
    ].join('\n');
    const configuredTimeout = Number(this.config.get<string>('INFLUXDB_QUERY_TIMEOUT_MS', '8000'));
    const timeoutMs = Number.isFinite(configuredTimeout)
      ? Math.min(30_000, Math.max(1000, configuredTimeout))
      : 8000;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const organizationQuery = orgId
        ? `orgID=${encodeURIComponent(orgId)}`
        : `org=${encodeURIComponent(org ?? '')}`;
      const response = await fetch(`${url}/api/v2/query?${organizationQuery}`, {
        method: 'POST',
        headers: {
          Authorization: `Token ${token}`,
          Accept: 'application/csv',
          'Content-Type': 'application/vnd.flux'
        },
        body: query,
        signal: controller.signal
      });
      if (!response.ok) {
        throw new Error(`InfluxDB respondió HTTP ${response.status}`);
      }
      const points = this.parseCsv(await response.text());
      if (!points.length) {
        return this.result('NO_DATA', 'No hay muestras de peso para el período de fabricación.');
      }
      return {
        status: 'AVAILABLE',
        message: `${points.length} muestras disponibles.`,
        points,
        lastTimestamp: points.at(-1)?.timestamp ?? null
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'error desconocido';
      this.logger.warn(`No se pudo consultar el historial de peso: ${reason}`);
      return this.result(
        'UNAVAILABLE',
        'InfluxDB no está disponible en este momento. La trazabilidad operativa se conserva.'
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private parseCsv(csv: string): WeightHistoryPoint[] {
    const lines = csv.split(/\r?\n/).filter((line) => line && !line.startsWith('#'));
    if (lines.length < 2) return [];
    const headers = this.csvRow(lines[0]);
    const timeIndex = headers.indexOf('_time');
    const valueIndex = headers.indexOf('_value');
    if (timeIndex < 0 || valueIndex < 0) return [];

    return lines.slice(1).flatMap((line) => {
      const row = this.csvRow(line);
      const timestamp = row[timeIndex];
      const grossKg = Number(row[valueIndex]);
      return timestamp && Number.isFinite(grossKg) && !Number.isNaN(Date.parse(timestamp))
        ? [{ timestamp: new Date(timestamp).toISOString(), grossKg }]
        : [];
    });
  }

  private csvRow(line: string): string[] {
    const values: string[] = [];
    let value = '';
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const character = line[index];
      if (character === '"' && quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') {
        quoted = !quoted;
      } else if (character === ',' && !quoted) {
        values.push(value);
        value = '';
      } else {
        value += character;
      }
    }
    values.push(value);
    return values;
  }

  private escapeFlux(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  private result(status: WeightHistoryStatus, message: string): WeightHistory {
    return { status, message, points: [], lastTimestamp: null };
  }
}
