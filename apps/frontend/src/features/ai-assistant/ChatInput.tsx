import { FormEvent, KeyboardEvent, useRef, useState } from 'react';
import { SendHorizontal } from 'lucide-react';

interface ChatInputProps {
  disabled?: boolean;
  onSend: (message: string) => void;
}

const MAX_LENGTH = 1000;

export function ChatInput({ disabled, onSend }: ChatInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    const message = value.trim();
    if (!message || disabled) return;
    onSend(message);
    setValue('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  const resize = (element: HTMLTextAreaElement) => {
    element.style.height = 'auto';
    element.style.height = `${Math.min(element.scrollHeight, 144)}px`;
  };

  return (
    <form className="ai-chat-input" onSubmit={submit}>
      <div className="ai-chat-input__field">
        <label htmlFor="ai-message-input" className="sr-only">Escribí una pregunta para el Copiloto DISAL</label>
        <textarea
          ref={textareaRef}
          id="ai-message-input"
          value={value}
          disabled={disabled}
          maxLength={MAX_LENGTH}
          onChange={(event) => {
            setValue(event.target.value);
            resize(event.target);
          }}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder="Preguntá por órdenes, etapas, atrasos, costos, operarios o materiales…"
        />
        <span className="ai-chat-input__hint">
          Enter para enviar · Shift + Enter para nueva línea
          {value.length > 850 && <em>{value.length}/{MAX_LENGTH}</em>}
        </span>
      </div>
      <button type="submit" disabled={disabled || !value.trim()} aria-label="Enviar pregunta">
        <SendHorizontal size={18} />
      </button>
    </form>
  );
}
