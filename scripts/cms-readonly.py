"""Consultas acotadas de diagnóstico a Woojin CMS, sin guardar credenciales.

Ejemplos:
  python scripts/cms-readonly.py status
  python scripts/cms-readonly.py shots --file cuerpo_4l_iml_JCA.db --limit 5
  python scripts/cms-readonly.py shot 919551

La contraseña se obtiene de CMS_DB_PASSWORD o de un prompt local.
"""

from __future__ import annotations

import argparse
import getpass
import os
import sys
from pathlib import Path

try:
    import pymysql
except ImportError:
    tools_dir = Path(__file__).resolve().parents[1] / "output" / "mysql-tools"
    if tools_dir.is_dir():
        sys.path.insert(0, str(tools_dir))
        import pymysql
    else:
        raise SystemExit("Falta PyMySQL. Instalar con: python -m pip install pymysql")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default=os.getenv("CMS_DB_HOST", "10.1.0.105"))
    parser.add_argument("--user", default=os.getenv("CMS_DB_USER", "cms"))
    parser.add_argument("--database", default=os.getenv("CMS_DB_NAME", "disal_cms"))
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("status", help="Hora, frescura y contadores actuales")
    shots = commands.add_parser("shots", help="Últimos disparos, opcionalmente por archivo")
    shots.add_argument("--file", help="Nombre exacto de Additional_Info_1")
    shots.add_argument("--limit", type=int, default=10)
    shot = commands.add_parser("shot", help="Buscar un Shot_Number en ambas tablas")
    shot.add_argument("number", type=int)
    shot.add_argument("--limit", type=int, default=20)
    args = parser.parse_args()
    if hasattr(args, "limit") and not 1 <= args.limit <= 100:
        parser.error("--limit debe estar entre 1 y 100")

    password = os.getenv("CMS_DB_PASSWORD") or getpass.getpass("Contraseña CMS: ")
    connection = pymysql.connect(
        host=args.host,
        user=args.user,
        password=password,
        database=args.database,
        connect_timeout=6,
        read_timeout=12,
        autocommit=False,
    )
    try:
        with connection.cursor() as cursor:
            cursor.execute("SET SESSION TRANSACTION READ ONLY")
            cursor.execute("START TRANSACTION READ ONLY")
            if args.command == "status":
                cursor.execute(
                    "SELECT NOW(), MAX(TimeStamp), COUNT(*) FROM shot_data"
                )
                now, last_shot, count = cursor.fetchone()
                print(f"CMS: {now} | último disparo: {last_shot} | filas: {count}")
                cursor.execute(
                    "SELECT Additional_Info_1, COUNT(*), MAX(TimeStamp) "
                    "FROM shot_data WHERE TimeStamp >= CURDATE() "
                    "GROUP BY Additional_Info_1 ORDER BY MAX(TimeStamp) DESC"
                )
                for filename, rows, last_seen in cursor.fetchall():
                    print(f"Captura de hoy: {filename} | filas={rows} | último={last_seen}")
                cursor.execute(
                    "SELECT Machine_IP, Time_Stamp, Current_Quantity, Operation_Status "
                    "FROM real_data ORDER BY Machine_IP"
                )
                for ip, timestamp, quantity, mode in cursor.fetchall():
                    print(f"{ip} | {timestamp} | Current_Quantity={quantity} | modo={mode}")
            elif args.command == "shots":
                where = "WHERE s.Additional_Info_1 = %s" if args.file else ""
                params = (args.file, args.limit) if args.file else (args.limit,)
                cursor.execute(
                    "SELECT s.idx, s.TimeStamp, s.Shot_Number, s.Additional_Info_1, "
                    "s.Machine_Name, "
                    "CASE WHEN r.rec_idx IS NULL THEN 'SIN_RECETA' "
                    "WHEN r.Shot_Number = s.Shot_Number "
                    "AND r.TimeStamp = s.TimeStamp "
                    "AND r.Additional_Info_1 = s.Additional_Info_1 "
                    "THEN 'RECETA_OK' ELSE 'RECETA_DIFERENTE' END "
                    f"FROM shot_data s LEFT JOIN shot_data_rec r ON r.rec_idx = s.idx {where} "
                    "ORDER BY s.idx DESC LIMIT %s",
                    params,
                )
                for row in cursor.fetchall():
                    print(" | ".join(map(str, row)))
            else:
                for table, index in (("shot_data", "idx"), ("shot_data_rec", "rec_idx")):
                    cursor.execute(
                        f"SELECT {index}, TimeStamp, Shot_Number, Additional_Info_1, Machine_Name "
                        f"FROM {table} WHERE Shot_Number = %s "
                        f"ORDER BY {index} DESC LIMIT %s",
                        (args.number, args.limit),
                    )
                    rows = cursor.fetchall()
                    print(f"{table}: {len(rows)} coincidencias")
                    for row in rows:
                        print(" | ".join(map(str, row)))
        connection.rollback()
    finally:
        connection.close()


if __name__ == "__main__":
    main()
