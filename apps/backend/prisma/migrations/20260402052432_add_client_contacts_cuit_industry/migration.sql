-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('DUENO', 'SUPERVISOR', 'OPERARIO', 'ADMIN');

-- CreateEnum
CREATE TYPE "CommercialStatus" AS ENUM ('BORRADOR', 'ENVIADO', 'APROBADO', 'RECHAZADO', 'VENCIDO');

-- CreateEnum
CREATE TYPE "ProductionStatus" AS ENUM ('PENDIENTE', 'PLANIFICADA', 'EN_PROCESO', 'PAUSADA', 'FINALIZADA', 'ENTREGADA', 'CANCELADA', 'RETRABAJO');

-- CreateEnum
CREATE TYPE "ResourceType" AS ENUM ('HUMANO', 'MAQUINA');

-- CreateEnum
CREATE TYPE "ResourceStatus" AS ENUM ('DISPONIBLE', 'OCUPADO', 'MANTENIMIENTO', 'FUERA_DE_LINEA');

-- CreateEnum
CREATE TYPE "OperationEventType" AS ENUM ('OT_CREADA', 'ASIGNADO', 'INICIO', 'PAUSA', 'REANUDACION', 'FINALIZACION', 'CAMBIO_ESTADO', 'MATERIAL_CONSUMIDO', 'NOTA');

-- CreateEnum
CREATE TYPE "MaterialMovementType" AS ENUM ('ENTRADA', 'AJUSTE', 'CONSUMO');

-- CreateEnum
CREATE TYPE "AuditEntityType" AS ENUM ('COMPANY', 'USER', 'CLIENT', 'ORDER', 'RESOURCE', 'MATERIAL', 'AUTH');

-- CreateEnum
CREATE TYPE "AuditActionType" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE', 'ASSIGN', 'DELIVERY_CLOSE', 'PASSWORD_CHANGE', 'ROLE_CHANGE', 'SETTINGS_CHANGE', 'LOGIN');

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "taxId" TEXT,
    "settings" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cuit" TEXT,
    "industry" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientContact" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "purchaseOrderNumber" TEXT,
    "commercialStatus" "CommercialStatus",
    "validUntil" TIMESTAMP(3),
    "deliveryTimeDays" INTEGER,
    "approvedAt" TIMESTAMP(3),
    "estimatedMaterials" TEXT,
    "productionStatus" "ProductionStatus",
    "priority" INTEGER NOT NULL DEFAULT 3,
    "plannedDate" TIMESTAMP(3),
    "commitmentDate" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "closedByUserId" TEXT,
    "deliveryChecklist" TEXT,
    "deliveryNote" TEXT,
    "notes" TEXT,
    "isSigned" BOOLEAN NOT NULL DEFAULT false,
    "dashboardUrl" TEXT,
    "estimatedTimeMin" INTEGER NOT NULL,
    "estimatedCost" DECIMAL(12,2) NOT NULL,
    "attachmentUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unit" TEXT NOT NULL,
    "estimatedUnitCost" DECIMAL(12,2) NOT NULL,
    "estimatedHoursMin" INTEGER,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderCostingHour" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "hours" DECIMAL(8,2) NOT NULL,
    "ratePerHour" DECIMAL(12,2) NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderCostingHour_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderAssignment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "userId" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unassignedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderAttachment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Resource" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" "ResourceType" NOT NULL,
    "name" TEXT NOT NULL,
    "sector" TEXT,
    "status" "ResourceStatus" NOT NULL DEFAULT 'DISPONIBLE',
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Resource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperationLog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "resourceId" TEXT,
    "userId" TEXT,
    "eventType" "OperationEventType" NOT NULL,
    "eventAt" TIMESTAMP(3) NOT NULL,
    "pauseReason" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OperationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Material" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "unit" TEXT NOT NULL,
    "unitCost" DECIMAL(12,2) NOT NULL,
    "stock" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialMovement" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "type" "MaterialMovementType" NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unitCost" DECIMAL(12,2) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialConsumption" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unitCostSnapshot" DECIMAL(12,2) NOT NULL,
    "note" TEXT,
    "consumedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialConsumption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT,
    "entityType" "AuditEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" "AuditActionType" NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Company_name_idx" ON "Company"("name");

-- CreateIndex
CREATE INDEX "User_companyId_role_idx" ON "User"("companyId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "User_companyId_email_key" ON "User"("companyId", "email");

-- CreateIndex
CREATE INDEX "Client_companyId_name_idx" ON "Client"("companyId", "name");

-- CreateIndex
CREATE INDEX "Client_companyId_isActive_idx" ON "Client"("companyId", "isActive");

-- CreateIndex
CREATE INDEX "ClientContact_clientId_idx" ON "ClientContact"("clientId");

-- CreateIndex
CREATE INDEX "Order_companyId_commercialStatus_idx" ON "Order"("companyId", "commercialStatus");

-- CreateIndex
CREATE INDEX "Order_companyId_productionStatus_idx" ON "Order"("companyId", "productionStatus");

-- CreateIndex
CREATE INDEX "Order_companyId_commitmentDate_idx" ON "Order"("companyId", "commitmentDate");

-- CreateIndex
CREATE UNIQUE INDEX "Order_companyId_code_key" ON "Order"("companyId", "code");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_position_idx" ON "OrderItem"("orderId", "position");

-- CreateIndex
CREATE INDEX "OrderCostingHour_orderId_position_idx" ON "OrderCostingHour"("orderId", "position");

-- CreateIndex
CREATE INDEX "OrderAssignment_companyId_orderId_idx" ON "OrderAssignment"("companyId", "orderId");

-- CreateIndex
CREATE INDEX "OrderAssignment_companyId_resourceId_idx" ON "OrderAssignment"("companyId", "resourceId");

-- CreateIndex
CREATE INDEX "OrderAttachment_orderId_idx" ON "OrderAttachment"("orderId");

-- CreateIndex
CREATE INDEX "Resource_companyId_type_isActive_idx" ON "Resource"("companyId", "type", "isActive");

-- CreateIndex
CREATE INDEX "Resource_companyId_status_idx" ON "Resource"("companyId", "status");

-- CreateIndex
CREATE INDEX "OperationLog_companyId_orderId_eventAt_idx" ON "OperationLog"("companyId", "orderId", "eventAt");

-- CreateIndex
CREATE INDEX "Material_companyId_name_idx" ON "Material"("companyId", "name");

-- CreateIndex
CREATE INDEX "Material_companyId_isActive_idx" ON "Material"("companyId", "isActive");

-- CreateIndex
CREATE INDEX "MaterialMovement_companyId_materialId_createdAt_idx" ON "MaterialMovement"("companyId", "materialId", "createdAt");

-- CreateIndex
CREATE INDEX "MaterialConsumption_companyId_orderId_consumedAt_idx" ON "MaterialConsumption"("companyId", "orderId", "consumedAt");

-- CreateIndex
CREATE INDEX "AuditLog_companyId_createdAt_idx" ON "AuditLog"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_companyId_entityType_entityId_idx" ON "AuditLog"("companyId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_companyId_action_idx" ON "AuditLog"("companyId", "action");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientContact" ADD CONSTRAINT "ClientContact_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_closedByUserId_fkey" FOREIGN KEY ("closedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderCostingHour" ADD CONSTRAINT "OrderCostingHour_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderAssignment" ADD CONSTRAINT "OrderAssignment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderAssignment" ADD CONSTRAINT "OrderAssignment_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderAssignment" ADD CONSTRAINT "OrderAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderAttachment" ADD CONSTRAINT "OrderAttachment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationLog" ADD CONSTRAINT "OperationLog_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationLog" ADD CONSTRAINT "OperationLog_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationLog" ADD CONSTRAINT "OperationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Material" ADD CONSTRAINT "Material_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialMovement" ADD CONSTRAINT "MaterialMovement_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialConsumption" ADD CONSTRAINT "MaterialConsumption_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialConsumption" ADD CONSTRAINT "MaterialConsumption_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialConsumption" ADD CONSTRAINT "MaterialConsumption_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
