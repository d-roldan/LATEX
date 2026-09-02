import { PropsWithChildren, useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface ModalProps {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  subtitle?: string;
  disableClose?: boolean;
  className?: string;
}

export function Modal({ title, subtitle, isOpen, onClose, disableClose, className, children }: PropsWithChildren<ModalProps>) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();
  const subtitleId = useId();

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    panelRef.current?.scrollTo({ top: 0 });
    panelRef.current?.focus({ preventScroll: true });

    return () => previouslyFocused?.focus({ preventScroll: true });
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !disableClose) {
        onClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose, disableClose]);

  if (!isOpen) {
    return null;
  }

  return createPortal(
    <div
      className="modal-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !disableClose) {
          onClose();
        }
      }}
    >
      <div
        ref={panelRef}
        className={`modal-panel ${className || ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={subtitle ? subtitleId : undefined}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <h3 id={titleId}>{title}</h3>
            {subtitle ? <p id={subtitleId}>{subtitle}</p> : null}
          </div>
          <button className="modal-close" type="button" onClick={onClose} disabled={disableClose} aria-label="Cerrar">
            <X size={19} aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}
