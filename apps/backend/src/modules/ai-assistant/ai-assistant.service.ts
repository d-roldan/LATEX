import { createHash } from 'crypto';
import { HttpException, HttpStatus, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, ProductionStatus } from '@prisma/client';
import { ReportsService } from '../reports/reports.service';
import { JwtUser } from '../../common/auth/jwt-user.interface';
import { PrismaService } from '../../prisma/prisma.service';

type Evidence = {
  label: string;
  value: string;
  detail: string | null;
  entityType: 'order' | 'material' | 'client' | 'operator' | 'report' | null;
  entityId: string | null;
  entityCode: string | null;
  route: string | null;
};

type AssistantAnswer = {
  answer: string;
  evidence: Evidence[];
  caveats: string[];
  suggestions: string[];
};

type ToolCall = {
  type: 'function_call';
  call_id: string;
  name: string;
  arguments: string;
};

const DEFAULT_TITLE = 'Nueva conversación';
const MAX_HISTORY_MESSAGES = 12;
const MAX_HISTORY_CHARS = 24_000;
const MAX_TOOL_TURNS = 3;
const OPENAI_TIMEOUT_MS = 60_000;
const MAX_CONCURRENT_REQUESTS_PER_USER = 2;

@Injectable()
export class AiAssistantService {
  private readonly logger = new Logger(AiAssistantService.name);
  private readonly activeRequests = new Map<string, number>();

  constructor(
    private readonly configService: ConfigService,
    private readonly reportsService: ReportsService,
    private readonly prisma: PrismaService
  ) {}

  async listConversations(user: JwtUser) {
    const conversations = await this.prisma.aiConversation.findMany({
      where: { companyId: user.companyId, userId: user.sub },
      orderBy: { lastMessageAt: 'desc' },
      take: 50,
      include: {
        _count: { select: { messages: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { content: true } }
      }
    });

    return conversations.map((conversation) => ({
      id: conversation.id,
      title: conversation.title,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      lastMessageAt: conversation.lastMessageAt,
      messageCount: conversation._count.messages,
      preview: conversation.messages[0]?.content.slice(0, 120) ?? ''
    }));
  }

  async createConversation(user: JwtUser, title?: string) {
    return this.prisma.aiConversation.create({
      data: {
        companyId: user.companyId,
        userId: user.sub,
        title: title?.trim() || DEFAULT_TITLE
      },
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
        lastMessageAt: true
      }
    });
  }

  async getConversation(user: JwtUser, id: string) {
    const conversation = await this.prisma.aiConversation.findFirst({
      where: { id, companyId: user.companyId, userId: user.sub },
      include: { messages: { orderBy: { createdAt: 'asc' } } }
    });
    if (!conversation) throw new NotFoundException('Conversación no encontrada.');

    return {
      id: conversation.id,
      title: conversation.title,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      lastMessageAt: conversation.lastMessageAt,
      messages: conversation.messages.map((message) => ({
        id: message.id,
        role: message.role === 'USER' ? 'user' : 'assistant',
        content: message.content,
        evidence: this.jsonArray<Evidence>(message.evidence),
        contextUsed: this.jsonArray<{ name: string; description: string }>(message.contextUsed),
        suggestions: this.jsonArray<string>(message.suggestions),
        caveats: this.jsonArray<string>(message.caveats),
        model: message.model,
        latencyMs: message.latencyMs,
        isFallback: message.isFallback,
        createdAt: message.createdAt
      }))
    };
  }

  async deleteConversation(user: JwtUser, id: string) {
    const result = await this.prisma.aiConversation.deleteMany({
      where: { id, companyId: user.companyId, userId: user.sub }
    });
    if (!result.count) throw new NotFoundException('Conversación no encontrada.');
    return { success: true };
  }

  async chat(user: JwtUser, message: string, conversationId?: string) {
    const conversation = conversationId
      ? await this.requireConversation(user, conversationId)
      : await this.createConversation(user);
    return this.sendMessage(user, conversation.id, message);
  }

  async sendMessage(user: JwtUser, conversationId: string, message: string) {
    const concurrencyKey = `${user.companyId}:${user.sub}`;
    const active = this.activeRequests.get(concurrencyKey) ?? 0;
    if (active >= MAX_CONCURRENT_REQUESTS_PER_USER) {
      throw new HttpException(
        'Ya hay demasiadas consultas de IA en curso. Esperá a que finalicen.',
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    this.activeRequests.set(concurrencyKey, active + 1);
    try {
      return await this.processMessage(user, conversationId, message);
    } finally {
      const remaining = (this.activeRequests.get(concurrencyKey) ?? 1) - 1;
      if (remaining > 0) this.activeRequests.set(concurrencyKey, remaining);
      else this.activeRequests.delete(concurrencyKey);
    }
  }

  private async processMessage(user: JwtUser, conversationId: string, message: string) {
    const conversation = await this.requireConversation(user, conversationId);
    const cleanMessage = message.trim();
    const startedAt = Date.now();

    await this.prisma.aiMessage.create({
      data: { conversationId, role: 'USER', content: cleanMessage }
    });

    const history = await this.prisma.aiMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: MAX_HISTORY_MESSAGES
    });
    history.reverse();

    const result = await this.generateAnswer(
      user,
      this.buildContextWindow(history.map((item) => ({
        role: item.role === 'USER' ? 'user' as const : 'assistant' as const,
        content: item.content
      })))
    );
    const latencyMs = Date.now() - startedAt;

    const assistantMessage = await this.prisma.aiMessage.create({
      data: {
        conversationId,
        role: 'ASSISTANT',
        content: result.answer.answer,
        evidence: result.answer.evidence as unknown as Prisma.InputJsonValue,
        contextUsed: result.contextUsed as unknown as Prisma.InputJsonValue,
        suggestions: result.answer.suggestions as unknown as Prisma.InputJsonValue,
        caveats: result.answer.caveats as unknown as Prisma.InputJsonValue,
        model: result.model,
        latencyMs,
        isFallback: result.isFallback
      }
    });

    const title = conversation.title === DEFAULT_TITLE
      ? this.buildConversationTitle(cleanMessage)
      : conversation.title;
    await this.prisma.aiConversation.update({
      where: { id: conversationId },
      data: { title, lastMessageAt: new Date() }
    });

    return {
      conversationId,
      conversationTitle: title,
      message: {
        id: assistantMessage.id,
        role: 'assistant',
        content: result.answer.answer,
        evidence: result.answer.evidence,
        contextUsed: result.contextUsed,
        suggestions: result.answer.suggestions,
        caveats: result.answer.caveats,
        model: result.model,
        latencyMs,
        isFallback: result.isFallback,
        createdAt: assistantMessage.createdAt
      }
    };
  }

  private async requireConversation(user: JwtUser, id: string) {
    const conversation = await this.prisma.aiConversation.findFirst({
      where: { id, companyId: user.companyId, userId: user.sub }
    });
    if (!conversation) throw new NotFoundException('Conversación no encontrada.');
    return conversation;
  }

  private async generateAnswer(
    user: JwtUser,
    history: Array<{ role: 'user' | 'assistant'; content: string }>
  ): Promise<{
    answer: AssistantAnswer;
    contextUsed: Array<{ name: string; description: string }>;
    model: string | null;
    isFallback: boolean;
  }> {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    const model = this.configService.get<string>('OPENAI_MODEL', 'gpt-4o-mini');
    if (!apiKey) return this.fallbackAnswer(user, 'OpenAI no está configurado.');

    const contextUsed = new Map<string, string>();
    let input: any[] = history.map((message) => ({
      role: message.role,
      content: [{
        type: message.role === 'assistant' ? 'output_text' : 'input_text',
        text: message.content
      }]
    }));

    try {
      for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
        const response = await fetch('https://api.openai.com/v1/responses', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          signal: AbortSignal.timeout(OPENAI_TIMEOUT_MS),
          body: JSON.stringify({
            model,
            store: false,
            max_output_tokens: 1800,
            safety_identifier: createHash('sha256').update(`${user.companyId}:${user.sub}`).digest('hex'),
            instructions: this.systemPrompt(user),
            input,
            tools: this.tools(),
            tool_choice: 'auto',
            parallel_tool_calls: true,
            text: { format: this.answerFormat() }
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          this.logger.warn(`OpenAI API error ${response.status}: ${errorText.slice(0, 800)}`);
          return this.fallbackAnswer(user, 'OpenAI no pudo completar la consulta.');
        }

        const payload = await response.json() as any;
        const calls = (payload.output ?? []).filter((item: any) => item.type === 'function_call') as ToolCall[];
        if (!calls.length) {
          const text = this.responseText(payload);
          return {
            answer: this.parseAnswer(text),
            contextUsed: Array.from(contextUsed, ([name, description]) => ({ name, description })),
            model,
            isFallback: false
          };
        }

        const toolOutputs = await Promise.all(calls.map(async (call) => {
          const args = this.parseArguments(call.arguments);
          const result = await this.executeTool(call.name, args, user);
          contextUsed.set(call.name, this.toolDescription(call.name));
          return {
            type: 'function_call_output',
            call_id: call.call_id,
            output: JSON.stringify(result)
          };
        }));
        input = [...input, ...(payload.output ?? []), ...toolOutputs];
      }

      // Si el modelo agotó las rondas consultando herramientas, obligamos una
      // síntesis final con la evidencia ya reunida. Volver al resumen local en
      // este punto perdería la intención concreta de la pregunta del usuario.
      const synthesisResponse = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(OPENAI_TIMEOUT_MS),
        body: JSON.stringify({
          model,
          store: false,
          max_output_tokens: 1800,
          safety_identifier: createHash('sha256').update(`${user.companyId}:${user.sub}`).digest('hex'),
          instructions: `${this.systemPrompt(user)}
Ya consultaste el máximo de fuentes permitido. Respondé ahora la pregunta concreta sin solicitar más herramientas.`,
          input,
          text: { format: this.answerFormat() }
        })
      });
      if (synthesisResponse.ok) {
        const payload = await synthesisResponse.json() as any;
        return {
          answer: this.parseAnswer(this.responseText(payload)),
          contextUsed: Array.from(contextUsed, ([name, description]) => ({ name, description })),
          model,
          isFallback: false
        };
      }

      const synthesisError = await synthesisResponse.text();
      this.logger.warn(
        `OpenAI synthesis error ${synthesisResponse.status}: ${synthesisError.slice(0, 800)}`
      );
    } catch (error) {
      this.logger.error(`AI assistant failure: ${error instanceof Error ? error.message : String(error)}`);
      return this.fallbackAnswer(user, 'El servicio de IA no estuvo disponible.');
    }

    return this.fallbackAnswer(user, 'La consulta alcanzó el límite de análisis.');
  }

  private tools() {
    return [
      {
        type: 'function',
        name: 'get_executive_overview',
        description: 'Obtiene KPIs ejecutivos, alertas, atrasos, rentabilidad y carga para un período.',
        strict: true,
        parameters: {
          type: 'object',
          additionalProperties: false,
          properties: {
            from: { type: ['string', 'null'], description: 'Fecha inicial YYYY-MM-DD o null.' },
            to: { type: ['string', 'null'], description: 'Fecha final YYYY-MM-DD o null.' }
          },
          required: ['from', 'to']
        }
      },
      {
        type: 'function',
        name: 'get_production_analytics',
        description: 'Analiza producción por casilla, etapa, sector y operario. Para comparar eficiencia de operarios usa efficiencyPct, completedStages y completedWorkedHours; no confunde carga horaria con desempeño.',
        strict: true,
        parameters: {
          type: 'object',
          additionalProperties: false,
          properties: {
            from: { type: ['string', 'null'] },
            to: { type: ['string', 'null'] },
            modelId: { type: ['string', 'null'] },
            sector: { type: ['string', 'null'] },
            operatorId: { type: ['string', 'null'] }
          },
          required: ['from', 'to', 'modelId', 'sector', 'operatorId']
        }
      },
      {
        type: 'function',
        name: 'get_operator_ranking',
        description: 'Herramienta obligatoria para rankings o comparaciones de trabajadores por horas, eficiencia o actividad. Devuelve el ranking ya calculado y aclara cuando hay menos operarios medibles que los solicitados.',
        strict: true,
        parameters: {
          type: 'object',
          additionalProperties: false,
          properties: {
            metric: { type: 'string', enum: ['worked_hours', 'efficiency', 'activity'] },
            limit: { type: 'integer', minimum: 1, maximum: 10 },
            from: { type: ['string', 'null'] },
            to: { type: ['string', 'null'] }
          },
          required: ['metric', 'limit', 'from', 'to']
        }
      },
      {
        type: 'function',
        name: 'search_orders',
        description: 'Busca órdenes por código, título, cliente o estado y devuelve datos verificables.',
        strict: true,
        parameters: {
          type: 'object',
          additionalProperties: false,
          properties: {
            query: { type: ['string', 'null'] },
            status: {
              type: ['string', 'null'],
              enum: [...Object.values(ProductionStatus), null]
            },
            limit: { type: 'integer', minimum: 1, maximum: 15 }
          },
          required: ['query', 'status', 'limit']
        }
      },
      {
        type: 'function',
        name: 'get_order_detail',
        description: 'Obtiene detalle productivo, etapas, responsables, consumos y tiempos de una orden.',
        strict: true,
        parameters: {
          type: 'object',
          additionalProperties: false,
          properties: { orderCode: { type: 'string' } },
          required: ['orderCode']
        }
      },
      {
        type: 'function',
        name: 'get_material_snapshot',
        description: 'Consulta inventario, costos y materiales de mayor valor o bajo stock.',
        strict: true,
        parameters: {
          type: 'object',
          additionalProperties: false,
          properties: {
            query: { type: ['string', 'null'] },
            limit: { type: 'integer', minimum: 1, maximum: 15 }
          },
          required: ['query', 'limit']
        }
      }
    ];
  }

  private async executeTool(name: string, args: Record<string, unknown>, user: JwtUser) {
    switch (name) {
      case 'get_executive_overview':
        return this.getExecutiveOverview(user, this.dateArg(args.from), this.dateArg(args.to));
      case 'get_production_analytics':
        return this.getProductionAnalytics(user, args);
      case 'get_operator_ranking':
        return this.getOperatorRanking(user, args);
      case 'search_orders':
        return this.searchOrders(user, args);
      case 'get_order_detail':
        return this.getOrderDetail(user, String(args.orderCode ?? ''));
      case 'get_material_snapshot':
        return this.getMaterialSnapshot(user, args);
      default:
        return { error: 'Herramienta no disponible.' };
    }
  }

  private async getExecutiveOverview(user: JwtUser, from?: string, to?: string) {
    const data = await this.reportsService.dashboard(user, from && to ? undefined : 6, from, to);
    return {
      asOf: new Date().toISOString(),
      period: { from: from ?? 'últimos 6 meses', to: to ?? new Date().toISOString().slice(0, 10) },
      kpis: data.kpis,
      management: data.managementAnnual,
      executiveSummary: data.executiveSummary,
      delayedOrders: data.delayedOrders.slice(0, 10).map((order: any) => ({
        id: order.id,
        code: order.code,
        title: order.title,
        client: order.client?.name,
        status: order.productionStatus,
        commitmentDate: order.commitmentDate,
        route: '/orders'
      })),
      deviations: data.deviationAlerts.slice(0, 10),
      operatorLoad: data.operatorLoad.slice(0, 12),
      profitableJobs: data.profitableJobs.slice(0, 8),
      profitableClients: data.profitableClients.slice(0, 8)
    };
  }

  private async getProductionAnalytics(user: JwtUser, args: Record<string, unknown>) {
    const data = await this.reportsService.rarAnalytics(user.companyId, {
      from: this.dateArg(args.from),
      to: this.dateArg(args.to),
      modelId: this.stringArg(args.modelId),
      sector: this.stringArg(args.sector),
      operatorId: this.stringArg(args.operatorId)
    });
    return {
      asOf: new Date().toISOString(),
      period: data.period,
      kpis: data.kpis,
      orders: data.orders.slice(0, 12).map((order) => ({ ...order, route: '/orders' })),
      stages: data.stages.slice(0, 12),
      sectors: data.sectors.slice(0, 12),
      operators: data.operators.slice(0, 12).map((operator) => ({
        ...operator,
        metricDefinition: operator.efficiencyPct === null
          ? 'Sin etapas terminadas suficientes para estimar eficiencia.'
          : 'Eficiencia estimada: horas estándar reconocidas de etapas terminadas / horas reales registradas.',
        sampleWarning: operator.completedStages < 3
          ? 'Muestra pequeña: interpretar con cautela.'
          : null
      })),
      operatorMetricGuidance: {
        efficiencyPct: 'Comparación estimada de tiempo estándar contra tiempo real, sólo sobre etapas terminadas.',
        workedHours: 'Carga o actividad registrada; no representa por sí sola productividad ni calidad.',
        limitations: 'No incluye calidad, retrabajos, complejidad individual ni evaluación humana. No afirmar quién es el mejor sin aclarar período y muestra.'
      }
    };
  }

  private async getOperatorRanking(user: JwtUser, args: Record<string, unknown>) {
    const metric = ['worked_hours', 'efficiency', 'activity'].includes(String(args.metric))
      ? String(args.metric) as 'worked_hours' | 'efficiency' | 'activity'
      : 'worked_hours';
    const requestedLimit = Math.min(10, Math.max(1, Number(args.limit) || 3));
    const data = await this.reportsService.rarAnalytics(user.companyId, {
      from: this.dateArg(args.from),
      to: this.dateArg(args.to)
    });

    const measurable = data.operators
      .filter((operator) => {
        if (metric === 'efficiency') return operator.efficiencyPct !== null && operator.completedStages > 0;
        if (metric === 'activity') return operator.sessions > 0;
        return operator.workedHours > 0;
      })
      .sort((a, b) => {
        if (metric === 'efficiency') return (b.efficiencyPct ?? 0) - (a.efficiencyPct ?? 0);
        if (metric === 'activity') return b.sessions - a.sessions;
        return b.workedHours - a.workedHours;
      });

    return {
      asOf: new Date().toISOString(),
      period: data.period,
      metric,
      metricDefinition: metric === 'efficiency'
        ? 'Horas estándar reconocidas / horas reales, exclusivamente en etapas terminadas.'
        : metric === 'activity'
          ? 'Cantidad de sesiones de trabajo registradas; no equivale a eficiencia.'
          : 'Duración real de sesiones de etapa registradas en el período.',
      requestedCount: requestedLimit,
      measurableOperators: measurable.length,
      hasEnoughForRequestedRanking: measurable.length >= requestedLimit,
      availabilityMessage: measurable.length
        ? `Hay ${measurable.length} operario(s) con datos medibles; se solicitaron ${requestedLimit}.`
        : 'No hay operarios con datos medibles para esta métrica y período.',
      ranking: measurable.slice(0, requestedLimit).map((operator, index) => ({
        rank: index + 1,
        id: operator.id,
        name: operator.name,
        workedHours: operator.workedHours,
        sessions: operator.sessions,
        distinctStageTypes: operator.stages,
        completedStages: operator.completedStages,
        completedWorkedHours: operator.completedWorkedHours,
        efficiencyPct: operator.efficiencyPct,
        route: '/reports'
      })),
      limitations: metric === 'efficiency'
        ? ['No mide calidad, retrabajos ni complejidad.', 'Una muestra pequeña no permite concluir quién es el mejor trabajador.']
        : ['Las horas registradas miden carga de trabajo, no calidad ni eficiencia.']
    };
  }

  private async searchOrders(user: JwtUser, args: Record<string, unknown>) {
    const query = this.stringArg(args.query);
    const status = this.stringArg(args.status) as ProductionStatus | undefined;
    const limit = Math.min(15, Math.max(1, Number(args.limit) || 8));
    const orders = await this.prisma.order.findMany({
      where: {
        companyId: user.companyId,
        productionStatus: status ?? { not: null },
        OR: query ? [
          { code: { contains: query, mode: 'insensitive' } },
          { title: { contains: query, mode: 'insensitive' } },
          { client: { name: { contains: query, mode: 'insensitive' } } }
        ] : undefined
      },
      select: {
        id: true,
        code: true,
        title: true,
        productionStatus: true,
        priority: true,
        progressPct: true,
        commitmentDate: true,
        estimatedTimeMin: true,
        estimatedCost: true,
        client: { select: { id: true, name: true } },
        cabinModelRevision: { select: { cabinModel: { select: { code: true, name: true } } } },
        _count: { select: { stages: true, materialConsumptions: true } }
      },
      orderBy: [{ priority: 'desc' }, { commitmentDate: 'asc' }],
      take: limit
    });
    return {
      asOf: new Date().toISOString(),
      count: orders.length,
      orders: orders.map((order) => ({
        ...order,
        estimatedCost: Number(order.estimatedCost),
        estimatedHours: order.estimatedTimeMin / 60,
        route: '/orders'
      }))
    };
  }

  private async getOrderDetail(user: JwtUser, orderCode: string) {
    const order = await this.prisma.order.findFirst({
      where: { companyId: user.companyId, code: { equals: orderCode, mode: 'insensitive' } },
      include: {
        client: { select: { id: true, name: true } },
        cabinModelRevision: { include: { cabinModel: { select: { code: true, name: true } } } },
        stages: {
          orderBy: { position: 'asc' },
          include: {
            assignments: {
              where: { unassignedAt: null },
              include: { user: { select: { id: true, fullName: true } } }
            },
            workSessions: { include: { user: { select: { fullName: true } } } }
          }
        },
        materialConsumptions: { include: { material: { select: { name: true, unit: true } } } }
      }
    });
    if (!order) return { error: `No se encontró la orden ${orderCode}.` };

    return {
      asOf: new Date().toISOString(),
      order: {
        id: order.id,
        code: order.code,
        title: order.title,
        client: order.client.name,
        model: order.cabinModelRevision?.cabinModel,
        status: order.productionStatus,
        progressPct: order.progressPct,
        priority: order.priority,
        commitmentDate: order.commitmentDate,
        estimatedHours: order.estimatedTimeMin / 60,
        estimatedCost: Number(order.estimatedCost),
        route: '/orders',
        stages: order.stages.map((stage) => ({
          id: stage.id,
          code: stage.code,
          name: stage.name,
          sector: stage.sector,
          status: stage.status,
          progressPct: stage.progressPct,
          estimatedHours: stage.estimatedTimeMin / 60,
          startedAt: stage.startedAt,
          finishedAt: stage.finishedAt,
          pauseReason: stage.pauseReason,
          assignedTo: stage.assignments.map((assignment) => assignment.user?.fullName).filter(Boolean),
          workedHours: stage.workSessions.reduce((sum, session) => {
            const end = session.endedAt ?? new Date();
            return sum + Math.max(0, end.getTime() - session.startedAt.getTime()) / 3600000;
          }, 0)
        })),
        materialCost: order.materialConsumptions.reduce(
          (sum, item) => sum + Number(item.quantity) * Number(item.unitCostSnapshot), 0
        ),
        materials: order.materialConsumptions.slice(0, 20).map((item) => ({
          name: item.material.name,
          quantity: Number(item.quantity),
          unit: item.material.unit,
          unitCost: Number(item.unitCostSnapshot)
        }))
      }
    };
  }

  private async getMaterialSnapshot(user: JwtUser, args: Record<string, unknown>) {
    const query = this.stringArg(args.query);
    const limit = Math.min(15, Math.max(1, Number(args.limit) || 10));
    const materials = await this.prisma.material.findMany({
      where: {
        companyId: user.companyId,
        isActive: true,
        name: query ? { contains: query, mode: 'insensitive' } : undefined
      },
      select: {
        id: true,
        name: true,
        category: true,
        unit: true,
        stock: true,
        unitCost: true,
        updatedAt: true
      },
      take: 100
    });
    return {
      asOf: new Date().toISOString(),
      materials: materials
        .map((material) => ({
          id: material.id,
          name: material.name,
          category: material.category,
          unit: material.unit,
          stock: Number(material.stock),
          unitCost: Number(material.unitCost),
          stockValue: Number(material.stock) * Number(material.unitCost),
          updatedAt: material.updatedAt,
          route: '/materials'
        }))
        .sort((a, b) => b.stockValue - a.stockValue)
        .slice(0, limit)
    };
  }

  private systemPrompt(user: JwtUser) {
    const today = new Intl.DateTimeFormat('es-AR', {
      dateStyle: 'full',
      timeStyle: 'short',
      timeZone: 'America/Argentina/Buenos_Aires'
    }).format(new Date());
    return [
      'Sos el Copiloto de gestión de DISAL Industria Metalúrgica.',
      `Usuario: ${user.fullName || 'Usuario'}; rol: ${user.role}; fecha actual: ${today}.`,
      'Respondé en español rioplatense profesional, claro y directo.',
      'Para toda afirmación sobre datos de la empresa, usá una o más herramientas en este turno.',
      'Nunca inventes cifras, códigos, clientes, fechas, causas ni conclusiones no respaldadas.',
      'Si una herramienta no devuelve lo necesario, explicá la limitación y pedí el dato faltante.',
      'Respondé exactamente la pregunta. No uses órdenes, KPIs u otros datos como relleno si no son evidencia relevante.',
      'Para desempeño de operarios, diferenciá carga de trabajo y eficiencia. Horas o sesiones no significan que alguien sea mejor.',
      'Para cualquier lista, top o comparación de trabajadores, usá get_operator_ranking y respetá su ranking.',
      'La salida más reciente de una herramienta prevalece sobre afirmaciones anteriores de la conversación.',
      'Si el ranking contiene menos personas que las solicitadas, mostrá todas las disponibles y decí cuántas faltan. Nunca digas que no hay datos cuando measurableOperators es mayor que cero.',
      'Si comparás eficiencia, usá efficiencyPct sólo con etapas terminadas, informá período y tamaño de muestra, y advertí que no mide calidad ni complejidad.',
      'Priorizá alertas, impacto operativo y acciones concretas. Diferenciá hechos de recomendaciones.',
      'Usá fechas absolutas y aclarar el período analizado.',
      'Incluí evidencia verificable para las cifras y registros importantes.',
      'Los enlaces internos deben apuntar sólo a rutas devueltas por las herramientas.',
      'No menciones SQL, tablas, prompts, herramientas internas ni detalles de implementación.',
      'No afirmes que modificaste datos: este copiloto sólo analiza información.',
      'Las preguntas de seguimiento deben ser breves, útiles y relacionadas con el resultado.'
    ].join('\n');
  }

  private answerFormat() {
    return {
      type: 'json_schema',
      name: 'DISAL_copilot_answer',
      strict: true,
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          answer: { type: 'string' },
          evidence: {
            type: 'array',
            maxItems: 10,
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                label: { type: 'string' },
                value: { type: 'string' },
                detail: { type: ['string', 'null'] },
                entityType: {
                  type: ['string', 'null'],
                  enum: ['order', 'material', 'client', 'operator', 'report', null]
                },
                entityId: { type: ['string', 'null'] },
                entityCode: { type: ['string', 'null'] },
                route: { type: ['string', 'null'] }
              },
              required: ['label', 'value', 'detail', 'entityType', 'entityId', 'entityCode', 'route']
            }
          },
          caveats: { type: 'array', maxItems: 4, items: { type: 'string' } },
          suggestions: { type: 'array', minItems: 2, maxItems: 4, items: { type: 'string' } }
        },
        required: ['answer', 'evidence', 'caveats', 'suggestions']
      }
    };
  }

  private async fallbackAnswer(user: JwtUser, reason: string) {
    const overview = await this.getExecutiveOverview(user);
    const delayed = overview.delayedOrders.length;
    const answer: AssistantAnswer = {
      answer: [
        '### Resumen operativo disponible',
        `- Órdenes abiertas: **${overview.kpis.openCount}**.`,
        `- En proceso o pausadas: **${overview.kpis.inProcessCount}**.`,
        `- Entregas atrasadas detectadas: **${delayed}**.`,
        '',
        'La respuesta avanzada no estuvo disponible; este resumen fue calculado directamente con los datos del sistema.'
      ].join('\n'),
      evidence: [
        {
          label: 'Órdenes abiertas',
          value: String(overview.kpis.openCount),
          detail: 'Estado operativo actual',
          entityType: 'report',
          entityId: null,
          entityCode: null,
          route: '/dashboard'
        },
        {
          label: 'Entregas atrasadas',
          value: String(delayed),
          detail: 'Órdenes activas con compromiso vencido',
          entityType: 'report',
          entityId: null,
          entityCode: null,
          route: '/orders'
        }
      ],
      caveats: [reason],
      suggestions: ['¿Qué órdenes están atrasadas?', '¿Dónde están los mayores desvíos?']
    };
    return {
      answer,
      contextUsed: [{ name: 'Resumen ejecutivo', description: 'Datos calculados directamente por el sistema.' }],
      model: null,
      isFallback: true
    };
  }

  private responseText(payload: any) {
    if (typeof payload.output_text === 'string') return payload.output_text;
    for (const item of payload.output ?? []) {
      if (item.type !== 'message') continue;
      for (const content of item.content ?? []) {
        if (content.type === 'output_text' && typeof content.text === 'string') return content.text;
      }
    }
    return '';
  }

  private parseAnswer(text: string): AssistantAnswer {
    try {
      const parsed = JSON.parse(text);
      return {
        answer: String(parsed.answer ?? ''),
        evidence: Array.isArray(parsed.evidence) ? parsed.evidence.slice(0, 10) : [],
        caveats: Array.isArray(parsed.caveats) ? parsed.caveats.slice(0, 4).map(String) : [],
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 4).map(String) : []
      };
    } catch {
      return {
        answer: text.trim() || 'No pude elaborar una respuesta verificable.',
        evidence: [],
        caveats: ['La respuesta no incluyó evidencia estructurada.'],
        suggestions: ['¿Podés analizar el estado general de producción?', '¿Qué órdenes requieren atención?']
      };
    }
  }

  private parseArguments(value: string) {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {};
    } catch {
      return {};
    }
  }

  private toolDescription(name: string) {
    const descriptions: Record<string, string> = {
      get_executive_overview: 'Resumen ejecutivo, alertas y rentabilidad del período.',
      get_production_analytics: 'Analítica de producción y desempeño operativo.',
      get_operator_ranking: 'Ranking verificable de operarios.',
      search_orders: 'Órdenes filtradas por código, cliente o estado.',
      get_order_detail: 'Detalle verificable de una orden y sus etapas.',
      get_material_snapshot: 'Inventario, costos y valor de materiales.'
    };
    return descriptions[name] ?? 'Datos operativos del sistema.';
  }

  private jsonArray<T>(value: Prisma.JsonValue | null): T[] {
    return Array.isArray(value) ? value as unknown as T[] : [];
  }

  private buildContextWindow(
    messages: Array<{ role: 'user' | 'assistant'; content: string }>
  ) {
    const selected: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    let usedChars = 0;

    // Se prioriza siempre lo más reciente. El historial completo permanece en
    // PostgreSQL, pero sólo esta ventana acotada se envía al proveedor de IA.
    for (let index = messages.length - 1; index >= 0; index--) {
      const message = messages[index];
      const remaining = MAX_HISTORY_CHARS - usedChars;
      if (remaining <= 0) break;

      const content = message.content.length > remaining
        ? message.content.slice(message.content.length - remaining)
        : message.content;
      selected.unshift({ ...message, content });
      usedChars += content.length;
    }

    return selected;
  }

  private buildConversationTitle(message: string) {
    const compact = message.replace(/\s+/g, ' ').trim();
    return compact.length > 58 ? `${compact.slice(0, 55)}…` : compact;
  }

  private stringArg(value: unknown) {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }

  private dateArg(value: unknown) {
    const text = this.stringArg(value);
    return text && /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : undefined;
  }
}
