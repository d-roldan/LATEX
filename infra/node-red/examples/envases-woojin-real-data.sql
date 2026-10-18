-- Consulta de la rama principal del flujo externo completo.
-- Lectura fija de cinco IP; no acepta SQL ni filtros de mensajes entrantes.
-- El sufijo -03:00 debe cotejarse con NOW() y UTC_TIMESTAMP() en ese servidor.
SELECT
    r.Machine_IP,
    r.Machine_Name,
    m.Machine_Nickname AS Modelo,
    DATE_FORMAT(r.Time_Stamp, '%Y-%m-%dT%H:%i:%s-03:00') AS cms_timestamp_iso,
    r.Motor_Status,
    r.Heater_Status,
    r.Operation_Status,
    r.Cycle_Time_Before,
    r.Cycle_Time_Current,
    r.Production_Time_Hour,
    r.Production_Time_Min,
    r.Total_Quantity,
    r.Current_Quantity,
    r.Avg_Quantity_Per_Hour,
    r.Alarm_Status,
    TIMESTAMPDIFF(SECOND, r.Time_Stamp, NOW()) AS cms_age_seconds
FROM disal_cms.real_data AS r
LEFT JOIN disal_cms.itgr_machine_list AS m ON m.Machine_IP = r.Machine_IP
WHERE r.Machine_IP IN (
    '172.16.0.141', '172.16.0.143', '172.16.0.144',
    '172.16.0.145', '172.16.0.146'
)
ORDER BY m.idx
LIMIT 5;
