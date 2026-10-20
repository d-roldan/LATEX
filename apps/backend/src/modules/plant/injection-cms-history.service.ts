import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as mysql from 'mysql2/promise';
import { RowDataPacket } from 'mysql2';

interface CmsShotRow extends RowDataPacket {
  idx: number;
  timestamp: string;
  shotNumber: number | string;
  cycleTime: number | string | null;
  cavity: number | string | null;
  injectionTime: number | string | null;
  maxInjectionPressure: number | string | null;
  resinWeight: number | string | null;
  recipeBarrelTemperature: string | null;
  recipeInjVelocity: string | null;
  recipeInjPressure: string | null;
  recipeLinked: number;
}

@Injectable()
export class InjectionCmsHistoryService {
  private readonly logger = new Logger(InjectionCmsHistoryService.name);

  constructor(private readonly config: ConfigService) {}

  async readByFile(file: string, before?: number) {
    const host = this.config.get<string>('CMS_DB_HOST');
    const user = this.config.get<string>('CMS_DB_USER');
    const password = this.config.get<string>('CMS_DB_PASSWORD');
    const database = this.config.get<string>('CMS_DB_NAME') || 'disal_cms';
    const port = Number(this.config.get<string>('CMS_DB_PORT') || 3306);
    if (!host || !user || !password || !Number.isInteger(port) || port < 1 || port > 65535)
      return { status: 'CONFIGURATION_PENDING', file, rows: [], nextCursor: null };
    if (
      !file ||
      file.length > 100 ||
      (before !== undefined && (!Number.isSafeInteger(before) || before < 1))
    )
      return { status: 'NO_DATA', file, rows: [], nextCursor: null };

    let connection: mysql.Connection | undefined;
    try {
      connection = await mysql.createConnection({
        host,
        port,
        user,
        password,
        database,
        connectTimeout: 3000,
        multipleStatements: false,
        dateStrings: true,
        decimalNumbers: true
      });
      await connection.query('SET SESSION TRANSACTION READ ONLY');
      await connection.query('START TRANSACTION READ ONLY');
      const [records] = await connection.execute<CmsShotRow[]>(
        `SELECT s.idx,
                DATE_FORMAT(s.TimeStamp, '%Y-%m-%dT%H:%i:%s-03:00') AS timestamp,
                s.Shot_Number AS shotNumber,
                s.Cycle_Time AS cycleTime,
                s.Cavity AS cavity,
                s.Injection_Time AS injectionTime,
                s.Max_Injection_Pressure AS maxInjectionPressure,
                s.Resin_weight AS resinWeight,
                p.Barrel_Temperature AS recipeBarrelTemperature,
                p.Inj_Velocity AS recipeInjVelocity,
                p.Inj_Pressure AS recipeInjPressure,
                CASE WHEN p.rec_idx IS NULL THEN 0 ELSE 1 END AS recipeLinked
         FROM shot_data s
         LEFT JOIN shot_data_rec p ON p.rec_idx = s.idx
           AND p.Shot_Number = s.Shot_Number
           AND p.TimeStamp = s.TimeStamp
           AND p.Additional_Info_1 = s.Additional_Info_1
         WHERE s.Additional_Info_1 = ? AND (? IS NULL OR s.idx < ?)
         ORDER BY s.idx DESC LIMIT 151`,
        [file, before ?? null, before ?? null]
      );
      await connection.rollback();

      const rows: Array<{
        idx: number;
        timestamp: string;
        shotNumber: number;
        cycleTime: number | null;
        cavity: number | null;
        injectionTime: number | null;
        maxInjectionPressure: number | null;
        resinWeight: number | null;
        recipeBarrelTemperature: string | null;
        recipeInjVelocity: string | null;
        recipeInjPressure: string | null;
        recipeLinked: boolean;
      }> = [];
      const seen = new Set<string>();
      const numeric = (value: number | string | null) =>
        value == null || !Number.isFinite(Number(value)) ? null : Number(value);
      for (const record of records) {
        const identity = String(record.shotNumber);
        if (seen.has(identity)) continue;
        seen.add(identity);
        rows.push({
          idx: record.idx,
          timestamp: record.timestamp,
          shotNumber: Number(record.shotNumber),
          cycleTime: numeric(record.cycleTime),
          cavity: numeric(record.cavity),
          injectionTime: numeric(record.injectionTime),
          maxInjectionPressure: numeric(record.maxInjectionPressure),
          resinWeight: numeric(record.resinWeight),
          recipeBarrelTemperature: record.recipeBarrelTemperature,
          recipeInjVelocity: record.recipeInjVelocity,
          recipeInjPressure: record.recipeInjPressure,
          recipeLinked: Number(record.recipeLinked) === 1
        });
        if (rows.length === 50) break;
      }
      return {
        status: rows.length ? 'AVAILABLE' : 'NO_DATA',
        attribution: 'CURRENT_FILE_MATCH',
        file,
        rows,
        nextCursor:
          rows.length === 50 && records.some((row) => row.idx < rows[49].idx) ? rows[49].idx : null
      };
    } catch (error) {
      this.logger.warn(`No se pudo leer el histórico CMS por archivo: ${String(error)}`);
      return { status: 'UNAVAILABLE', file, rows: [], nextCursor: null };
    } finally {
      await connection?.end();
    }
  }
}
