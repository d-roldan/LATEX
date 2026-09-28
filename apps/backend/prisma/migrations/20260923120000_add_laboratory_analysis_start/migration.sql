-- Separa la recepción física de la muestra del inicio efectivo del análisis.
ALTER TYPE "LaboratorySampleStatus" ADD VALUE 'ANALYZING' BEFORE 'RESOLVED';
