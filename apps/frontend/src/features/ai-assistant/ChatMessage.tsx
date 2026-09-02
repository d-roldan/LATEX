import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bot, Check, Clock3, Copy, Database, ExternalLink, ShieldAlert, UserRound } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export interface AiEvidence {
  label: string;
  value: string;
  detail?: string | null;
  entityType?: 'order' | 'material' | 'client' | 'operator' | 'report' | null;
  entityId?: string | null;
  entityCode?: string | null;
  route?: string | null;
}

export interface ChatMessageItem {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  evidence?: AiEvidence[];
  contextUsed?: Array<{ name: string; description: string }>;
  suggestions?: string[];
  caveats?: string[];
  model?: string | null;
  latencyMs?: number | null;
  isFallback?: boolean;
  createdAt?: string;
}

interface ChatMessageProps {
  message: ChatMessageItem;
  onSuggestion?: (suggestion: string) => void;
  disabled?: boolean;
}

export function ChatMessage({ message, onSuggestion, disabled }: ChatMessageProps) {
  const isAssistant = message.role === 'assistant';
  const [copied, setCopied] = useState(false);

  const copyAnswer = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <article className={`ai-message ${isAssistant ? 'ai-message--assistant' : 'ai-message--user'}`}>
      <div className="ai-message__avatar" aria-hidden="true">
        {isAssistant ? <Bot size={18} /> : <UserRound size={18} />}
      </div>
      <div className="ai-message__body">
        <div className="ai-message__heading">
          <p className="ai-message__author">{isAssistant ? 'Copiloto DISAL' : 'Vos'}</p>
          {isAssistant && (
            <button type="button" className="ai-message__copy unstyled-button" onClick={() => void copyAnswer()} aria-label="Copiar respuesta">
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
          )}
        </div>

        <div className="ai-message__content">
          <ReactMarkdown>{message.content}</ReactMarkdown>
        </div>

        {isAssistant && message.evidence?.length ? (
          <section className="ai-evidence" aria-label="Evidencia consultada">
            <div className="ai-evidence__title"><Database size={14} /> Evidencia en el sistema</div>
            <div className="ai-evidence__grid">
              {message.evidence.map((evidence, index) => {
                const card = (
                  <>
                    <span>{evidence.label}</span>
                    <strong>{evidence.value}</strong>
                    {evidence.detail && <small>{evidence.detail}</small>}
                    {evidence.route && <ExternalLink size={13} aria-hidden="true" />}
                  </>
                );
                return evidence.route ? (
                  <Link
                    key={`${evidence.label}-${index}`}
                    className="ai-evidence__card ai-evidence__card--link"
                    to={evidence.route}
                    state={{
                      tab: evidence.entityType === 'order' ? 'production' : undefined,
                      orderId: evidence.entityType === 'order' ? evidence.entityId : undefined,
                      highlightOrderId: evidence.entityType === 'order' ? evidence.entityId : undefined
                    }}
                  >
                    {card}
                  </Link>
                ) : (
                  <div key={`${evidence.label}-${index}`} className="ai-evidence__card">{card}</div>
                );
              })}
            </div>
          </section>
        ) : null}

        {isAssistant && message.caveats?.length ? (
          <div className="ai-caveats">
            <ShieldAlert size={15} />
            <div>{message.caveats.map((caveat) => <p key={caveat}>{caveat}</p>)}</div>
          </div>
        ) : null}

        {isAssistant && message.contextUsed?.length ? (
          <div className="ai-context-used">
            {message.contextUsed.map((context) => (
              <span key={context.name} title={context.description}>{context.description}</span>
            ))}
          </div>
        ) : null}

        {isAssistant && (
          <footer className="ai-message__meta">
            {message.isFallback ? <span>Resumen calculado localmente</span> : message.model ? <span>Analizado con {message.model}</span> : null}
            {message.latencyMs ? <span><Clock3 size={12} /> {(message.latencyMs / 1000).toFixed(1)} s</span> : null}
          </footer>
        )}

        {isAssistant && message.suggestions?.length && onSuggestion ? (
          <div className="ai-followups" aria-label="Preguntas relacionadas">
            {message.suggestions.map((suggestion) => (
              <button key={suggestion} type="button" onClick={() => onSuggestion(suggestion)} disabled={disabled}>
                {suggestion}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}
