import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle, Bot, BrainCircuit, Clock3, Database, History, Menu,
  MessageSquarePlus, PanelLeftClose, Sparkles, Trash2, X
} from 'lucide-react';
import { api } from '../../shared/api/http';
import { ChatInput } from './ChatInput';
import { ChatMessage, ChatMessageItem } from './ChatMessage';

interface ConversationSummary {
  id: string;
  title: string;
  preview: string;
  messageCount: number;
  lastMessageAt: string;
}

interface ConversationDetail {
  id: string;
  title: string;
  messages: ChatMessageItem[];
  lastMessageAt: string;
}

interface SendMessageResponse {
  conversationId: string;
  conversationTitle: string;
  message: ChatMessageItem;
}

const suggestedPrompts = [
  { title: 'Estado de producción', prompt: '¿Cómo viene la producción de los últimos 30 días y qué requiere atención?' },
  { title: 'Entregas en riesgo', prompt: '¿Qué casillas están atrasadas o corren riesgo de incumplir la fecha de entrega?' },
  { title: 'Desvíos principales', prompt: '¿Cuáles son los mayores desvíos de horas y costos, y qué impacto tienen?' },
  { title: 'Carga operativa', prompt: '¿Cómo está distribuida la carga entre operarios y sectores?' },
  { title: 'Materiales y costos', prompt: '¿Qué materiales tienen mayor impacto económico en el inventario?' },
  { title: 'Rentabilidad', prompt: '¿Qué órdenes y clientes muestran mejor margen en el período actual?' }
];

function relativeTime(value: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return 'Ahora';
  if (seconds < 3600) return `Hace ${Math.floor(seconds / 60)} min`;
  if (seconds < 86400) return `Hace ${Math.floor(seconds / 3600)} h`;
  return `Hace ${Math.floor(seconds / 86400)} d`;
}

export function AiAssistantPage() {
  const queryClient = useQueryClient();
  const [activeConversationId, setActiveConversationId] = useState<string | null | undefined>(undefined);
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [thinkingSeconds, setThinkingSeconds] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const conversations = useQuery({
    queryKey: ['ai-conversations'],
    queryFn: async () => (await api.get<ConversationSummary[]>('/ai-assistant/conversations')).data
  });

  const activeConversation = useQuery({
    queryKey: ['ai-conversation', activeConversationId],
    queryFn: async () => (
      await api.get<ConversationDetail>(`/ai-assistant/conversations/${activeConversationId}`)
    ).data,
    enabled: Boolean(activeConversationId)
  });

  useEffect(() => {
    if (activeConversationId === undefined && conversations.data) {
      setActiveConversationId(conversations.data[0]?.id ?? null);
    }
  }, [activeConversationId, conversations.data]);

  useEffect(() => {
    if (activeConversation.data && !isLoading) setMessages(activeConversation.data.messages);
    if (activeConversationId === null && !isLoading) setMessages([]);
  }, [activeConversation.data, activeConversationId, isLoading]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      setThinkingSeconds(0);
      return;
    }
    const timer = window.setInterval(() => setThinkingSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [isLoading]);

  const currentTitle = activeConversation.data?.title
    ?? conversations.data?.find((item) => item.id === activeConversationId)?.title
    ?? 'Nueva conversación';

  const lastAssistant = useMemo(
    () => [...messages].reverse().find((message) => message.role === 'assistant'),
    [messages]
  );

  const startNewConversation = () => {
    setActiveConversationId(null);
    setMessages([]);
    setError(null);
    setSidebarOpen(false);
  };

  const selectConversation = (id: string) => {
    if (isLoading) return;
    setActiveConversationId(id);
    setError(null);
    setSidebarOpen(false);
  };

  const sendMessage = async (content: string) => {
    if (isLoading) return;
    setIsLoading(true);
    setError(null);

    const optimisticMessage: ChatMessageItem = {
      id: `pending-${crypto.randomUUID()}`,
      role: 'user',
      content,
      createdAt: new Date().toISOString()
    };
    setMessages((current) => [...current, optimisticMessage]);

    try {
      let conversationId = activeConversationId;
      if (!conversationId) {
        const created = (await api.post<{ id: string }>('/ai-assistant/conversations', {})).data;
        conversationId = created.id;
        setActiveConversationId(created.id);
      }

      const response = await api.post<SendMessageResponse>(
        `/ai-assistant/conversations/${conversationId}/messages`,
        { message: content },
        { timeout: 90000 }
      );
      setMessages((current) => [...current, response.data.message]);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['ai-conversations'] }),
        queryClient.invalidateQueries({ queryKey: ['ai-conversation', conversationId] })
      ]);
    } catch (err: any) {
      const responseMessage = err?.response?.data?.message;
      setError(Array.isArray(responseMessage)
        ? responseMessage.join(' ')
        : responseMessage || 'No pude completar el análisis. Tu pregunta quedó visible para que puedas intentarlo nuevamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteConversation = async () => {
    if (!activeConversationId) return;
    if (!window.confirm('¿Eliminar esta conversación y todo su historial?')) return;
    await api.delete(`/ai-assistant/conversations/${activeConversationId}`);
    setActiveConversationId(undefined);
    setMessages([]);
    await queryClient.invalidateQueries({ queryKey: ['ai-conversations'] });
  };

  const thinkingLabel = thinkingSeconds < 3
    ? 'Interpretando tu consulta…'
    : thinkingSeconds < 8
      ? 'Consultando datos de DISAL…'
      : 'Contrastando cifras y preparando evidencia…';

  return (
    <div className="ai-assistant-page page-enter">
      <header className="ai-assistant-header">
        <div>
          <span className="ai-assistant-header__eyebrow"><Sparkles size={14} /> Inteligencia operativa</span>
          <h2>Copiloto DISAL</h2>
          <p>Respuestas verificables con datos actuales de producción, costos y planta.</p>
        </div>
        <div className="ai-assistant-status">
          <span><i /> Conectado</span>
          <small><Database size={13} /> Sólo lectura</small>
        </div>
      </header>

      <section className={`ai-workspace${sidebarOpen ? ' ai-workspace--sidebar-open' : ''}`}>
        <aside className="ai-conversation-sidebar" aria-label="Historial de conversaciones">
          <div className="ai-conversation-sidebar__header">
            <strong><History size={17} /> Conversaciones</strong>
            <button className="unstyled-button ai-sidebar-close" type="button" onClick={() => setSidebarOpen(false)} aria-label="Cerrar historial">
              <X size={18} />
            </button>
          </div>
          <button className="ai-new-chat" type="button" onClick={startNewConversation}>
            <MessageSquarePlus size={17} /> Nueva conversación
          </button>

          <div className="ai-conversation-list">
            {conversations.isLoading ? (
              <div className="ai-conversation-list__empty">Cargando historial…</div>
            ) : !conversations.data?.length ? (
              <div className="ai-conversation-list__empty">
                <Bot size={22} />
                Tus análisis aparecerán acá.
              </div>
            ) : conversations.data.map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                className={conversation.id === activeConversationId ? 'is-active' : ''}
                onClick={() => selectConversation(conversation.id)}
              >
                <strong>{conversation.title}</strong>
                <span>{conversation.preview || `${conversation.messageCount} mensajes`}</span>
                <time>{relativeTime(conversation.lastMessageAt)}</time>
              </button>
            ))}
          </div>
        </aside>

        <div className="ai-chat-panel">
          <div className="ai-chat-topbar">
            <div>
              <button type="button" className="unstyled-button ai-sidebar-trigger" onClick={() => setSidebarOpen(true)} aria-label="Abrir historial">
                <Menu size={18} />
              </button>
              <span><Bot size={18} /> {currentTitle}</span>
            </div>
            <div className="ai-chat-topbar__actions">
              {lastAssistant?.isFallback && <small className="ai-mode-badge ai-mode-badge--fallback">Modo local</small>}
              {!lastAssistant?.isFallback && lastAssistant?.model && <small className="ai-mode-badge">IA + datos DISAL</small>}
              {activeConversationId && (
                <button type="button" className="unstyled-button ai-delete-chat" onClick={() => void deleteConversation()} disabled={isLoading} aria-label="Eliminar conversación">
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          </div>

          <div className="ai-chat-scroll" ref={scrollRef} aria-live="polite">
            {!messages.length && !activeConversation.isLoading ? (
              <div className="ai-welcome">
                <div className="ai-welcome__icon"><BrainCircuit size={30} /></div>
                <h3>¿Qué necesitás entender de la planta?</h3>
                <p>El Copiloto consulta información actual, presenta evidencia y te lleva al registro que respalda cada conclusión.</p>
                <div className="ai-starter-grid">
                  {suggestedPrompts.map((item) => (
                    <button key={item.title} type="button" onClick={() => void sendMessage(item.prompt)} disabled={isLoading}>
                      <strong>{item.title}</strong>
                      <span>{item.prompt}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {messages.map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
                onSuggestion={(suggestion) => void sendMessage(suggestion)}
                disabled={isLoading}
              />
            ))}

            {isLoading ? (
              <div className="ai-thinking" role="status">
                <BrainCircuit size={17} className="ai-thinking-icon" />
                <div>
                  <strong>{thinkingLabel}</strong>
                  <span>Puede demorar algunos segundos según la complejidad.</span>
                </div>
                <div className="ai-thinking-dots"><span /><span /><span /></div>
                <time><Clock3 size={12} /> {thinkingSeconds}s</time>
              </div>
            ) : null}

            {error ? (
              <div className="ai-error" role="alert">
                <AlertTriangle size={16} />
                <span>{error}</span>
              </div>
            ) : null}
          </div>

          <div className="ai-chat-input-wrap">
            <ChatInput disabled={isLoading} onSend={(message) => void sendMessage(message)} />
            <p>El Copiloto puede equivocarse. Verificá decisiones críticas con la evidencia enlazada.</p>
          </div>
        </div>

        {sidebarOpen && <button className="ai-sidebar-backdrop" type="button" onClick={() => setSidebarOpen(false)} aria-label="Cerrar historial" />}
      </section>
    </div>
  );
}
