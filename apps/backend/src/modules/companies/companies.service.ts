import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  ACCESS_MATRIX,
  CompanySettings,
  DEFAULT_COMPANY_SETTINGS
} from './companies.constants';
import { UpdateCompanySettingsDto } from './dto/update-company-settings.dto';
import { Prisma } from '@prisma/client';
import { JwtUser } from '../../common/auth/jwt-user.interface';

@Injectable()
export class CompaniesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  getStatus() {
    return { module: 'companies', status: 'ready' };
  }

  async me(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId }
    });

    if (!company) {
      throw new NotFoundException('Empresa no encontrada');
    }

    return {
      ...company,
      settings: this.resolveSettings(company.settings)
    };
  }

  getAccessMatrix() {
    return ACCESS_MATRIX;
  }

  async updateSettings(user: JwtUser, dto: UpdateCompanySettingsDto) {
    const company = await this.prisma.company.findUnique({
      where: { id: user.companyId },
      select: {
        id: true,
        settings: true
      }
    });

    if (!company) {
      throw new NotFoundException('Empresa no encontrada');
    }

    const before = this.resolveSettings(company.settings);
    const nextSettings: CompanySettings = {
      ...before,
      ...dto,
      workOrderCodePrefix: dto.workOrderCodePrefix?.trim() || before.workOrderCodePrefix
    };

    const updated = await this.prisma.company.update({
      where: { id: user.companyId },
      data: {
        settings: nextSettings as unknown as Prisma.InputJsonValue
      }
    });

    await this.auditService.log({
      companyId: user.companyId,
      userId: user.sub,
      entityType: 'COMPANY',
      entityId: user.companyId,
      action: 'SETTINGS_CHANGE',
      before: before as unknown as Prisma.InputJsonValue,
      after: nextSettings as unknown as Prisma.InputJsonValue
    });

    return {
      ...updated,
      settings: this.resolveSettings(updated.settings)
    };
  }

  async getSettings(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        settings: true
      }
    });

    if (!company) {
      throw new NotFoundException('Empresa no encontrada');
    }

    return this.resolveSettings(company.settings);
  }

  private resolveSettings(raw: unknown): CompanySettings {
    if (!raw || typeof raw !== 'object') {
      return DEFAULT_COMPANY_SETTINGS;
    }

    return {
      ...DEFAULT_COMPANY_SETTINGS,
      ...(raw as Partial<CompanySettings>)
    };
  }
}
