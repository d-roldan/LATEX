DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='UserRole' AND e.enumlabel='OWNER') THEN
    ALTER TYPE "UserRole" RENAME VALUE 'OWNER' TO 'DUENO';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='UserRole' AND e.enumlabel='OPERATOR') THEN
    ALTER TYPE "UserRole" RENAME VALUE 'OPERATOR' TO 'OPERARIO';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='QuotationStatus' AND e.enumlabel='DRAFT') THEN
    ALTER TYPE "QuotationStatus" RENAME VALUE 'DRAFT' TO 'BORRADOR';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='QuotationStatus' AND e.enumlabel='SENT') THEN
    ALTER TYPE "QuotationStatus" RENAME VALUE 'SENT' TO 'ENVIADO';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='QuotationStatus' AND e.enumlabel='APPROVED') THEN
    ALTER TYPE "QuotationStatus" RENAME VALUE 'APPROVED' TO 'APROBADO';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='QuotationStatus' AND e.enumlabel='REJECTED') THEN
    ALTER TYPE "QuotationStatus" RENAME VALUE 'REJECTED' TO 'RECHAZADO';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='WorkOrderStatus' AND e.enumlabel='PENDING') THEN
    ALTER TYPE "WorkOrderStatus" RENAME VALUE 'PENDING' TO 'PENDIENTE';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='WorkOrderStatus' AND e.enumlabel='PLANNED') THEN
    ALTER TYPE "WorkOrderStatus" RENAME VALUE 'PLANNED' TO 'PLANIFICADA';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='WorkOrderStatus' AND e.enumlabel='IN_PROGRESS') THEN
    ALTER TYPE "WorkOrderStatus" RENAME VALUE 'IN_PROGRESS' TO 'EN_PROCESO';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='WorkOrderStatus' AND e.enumlabel='PAUSED') THEN
    ALTER TYPE "WorkOrderStatus" RENAME VALUE 'PAUSED' TO 'PAUSADA';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='WorkOrderStatus' AND e.enumlabel='FINISHED') THEN
    ALTER TYPE "WorkOrderStatus" RENAME VALUE 'FINISHED' TO 'FINALIZADA';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='WorkOrderStatus' AND e.enumlabel='DELIVERED') THEN
    ALTER TYPE "WorkOrderStatus" RENAME VALUE 'DELIVERED' TO 'ENTREGADA';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='WorkOrderStatus' AND e.enumlabel='CANCELED') THEN
    ALTER TYPE "WorkOrderStatus" RENAME VALUE 'CANCELED' TO 'CANCELADA';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='WorkOrderStatus' AND e.enumlabel='CANCELLED') THEN
    ALTER TYPE "WorkOrderStatus" RENAME VALUE 'CANCELLED' TO 'CANCELADA';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='ResourceType' AND e.enumlabel='HUMAN') THEN
    ALTER TYPE "ResourceType" RENAME VALUE 'HUMAN' TO 'HUMANO';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='ResourceType' AND e.enumlabel='MACHINE') THEN
    ALTER TYPE "ResourceType" RENAME VALUE 'MACHINE' TO 'MAQUINA';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='ResourceStatus' AND e.enumlabel='AVAILABLE') THEN
    ALTER TYPE "ResourceStatus" RENAME VALUE 'AVAILABLE' TO 'DISPONIBLE';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='ResourceStatus' AND e.enumlabel='BUSY') THEN
    ALTER TYPE "ResourceStatus" RENAME VALUE 'BUSY' TO 'OCUPADO';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='ResourceStatus' AND e.enumlabel='MAINTENANCE') THEN
    ALTER TYPE "ResourceStatus" RENAME VALUE 'MAINTENANCE' TO 'MANTENIMIENTO';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='ResourceStatus' AND e.enumlabel='OFFLINE') THEN
    ALTER TYPE "ResourceStatus" RENAME VALUE 'OFFLINE' TO 'FUERA_DE_LINEA';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='OperationEventType' AND e.enumlabel='WORK_ORDER_CREATED') THEN
    ALTER TYPE "OperationEventType" RENAME VALUE 'WORK_ORDER_CREATED' TO 'OT_CREADA';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='OperationEventType' AND e.enumlabel='ASSIGNED') THEN
    ALTER TYPE "OperationEventType" RENAME VALUE 'ASSIGNED' TO 'ASIGNADO';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='OperationEventType' AND e.enumlabel='START') THEN
    ALTER TYPE "OperationEventType" RENAME VALUE 'START' TO 'INICIO';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='OperationEventType' AND e.enumlabel='PAUSE') THEN
    ALTER TYPE "OperationEventType" RENAME VALUE 'PAUSE' TO 'PAUSA';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='OperationEventType' AND e.enumlabel='RESUME') THEN
    ALTER TYPE "OperationEventType" RENAME VALUE 'RESUME' TO 'REANUDACION';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='OperationEventType' AND e.enumlabel='FINISH') THEN
    ALTER TYPE "OperationEventType" RENAME VALUE 'FINISH' TO 'FINALIZACION';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='OperationEventType' AND e.enumlabel='STATUS_CHANGE') THEN
    ALTER TYPE "OperationEventType" RENAME VALUE 'STATUS_CHANGE' TO 'CAMBIO_ESTADO';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='OperationEventType' AND e.enumlabel='MATERIAL_CONSUMED') THEN
    ALTER TYPE "OperationEventType" RENAME VALUE 'MATERIAL_CONSUMED' TO 'MATERIAL_CONSUMIDO';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='OperationEventType' AND e.enumlabel='NOTE') THEN
    ALTER TYPE "OperationEventType" RENAME VALUE 'NOTE' TO 'NOTA';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='MaterialMovementType' AND e.enumlabel='INBOUND') THEN
    ALTER TYPE "MaterialMovementType" RENAME VALUE 'INBOUND' TO 'ENTRADA';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='MaterialMovementType' AND e.enumlabel='INCOMING') THEN
    ALTER TYPE "MaterialMovementType" RENAME VALUE 'INCOMING' TO 'ENTRADA';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='MaterialMovementType' AND e.enumlabel='ADJUSTMENT') THEN
    ALTER TYPE "MaterialMovementType" RENAME VALUE 'ADJUSTMENT' TO 'AJUSTE';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='MaterialMovementType' AND e.enumlabel='CONSUMPTION') THEN
    ALTER TYPE "MaterialMovementType" RENAME VALUE 'CONSUMPTION' TO 'CONSUMO';
  END IF;
END $$;
